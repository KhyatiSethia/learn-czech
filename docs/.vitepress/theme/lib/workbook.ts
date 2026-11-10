import type { Item } from './types'
import { hashId } from './parse'
import { normalize } from './text'

/**
 * Reads an exercise the way it is printed in a workbook: numbered or lettered items with
 * blanks to fill in, followed by an answer key.
 *
 *   Pracujte podle vzoru. a) (ty) Kam ........ (jít – chodit) na procházku? b) ...
 *   * a) chodíš, b) jezdíme, ...
 *
 * The labels can be a) b) c), A), a., 1. 2. 3., 1) 2) or (1) (2). Items can sit on one line or
 * many. The key can follow the exercise (starting with * or "Klíč:", or simply restarting the
 * numbering) or be pasted separately. Items with several blanks become one question per blank.
 * Items followed by a), b), c) choices keep those choices as the options.
 */

export interface WorkbookResult {
  items: Item[]
  /** A short name taken from the instruction line, e.g. "Pracujte podle vzoru". */
  title?: string
  /** The instruction line(s) that came before the first item. */
  description?: string
  warnings: string[]
  stats: {
    questions: number
    /** Questions in the exercise that are fill-in-the-blank. */
    gaps: number
    answers: number
    labels: string
    options: boolean
    keyFound: boolean
  }
}

type SchemeName = 'alphaParen' | 'digitParen' | 'digitDot' | 'alphaDot'

interface Scheme {
  name: SchemeName
  re: RegExp
  alpha: boolean
  example: string
}

const SCHEMES: Scheme[] = [
  { name: 'alphaParen', re: /(?<![\p{L}\p{N}])\(?([a-zA-Z])\)/gu, alpha: true, example: 'a) b) c)' },
  { name: 'digitParen', re: /(?<![\p{L}\p{N}])\(?(\d{1,3})\)/gu, alpha: false, example: '1) 2) 3)' },
  { name: 'digitDot', re: /(?<![\p{L}\p{N}.,/:])(\d{1,3})\.(?=\s|$)/gu, alpha: false, example: '1. 2. 3.' },
  { name: 'alphaDot', re: /(?<![\p{L}\p{N}.])([a-zA-Z])\.(?=\s)/gu, alpha: true, example: 'a. b. c.' },
]

interface Label {
  value: number
  start: number
  end: number
}

/** Words that, right before "3.", mean the number is a page or exercise number, not an item label. */
const NOT_A_LABEL = /(?:cvičení|cviceni|úkol|ukol|lekce|lekci|strana|strany|str|exercise|task|lesson|page|unit|část|cast|č|no)\s*$/iu

function labelsFor(text: string, scheme: Scheme): Label[] {
  const out: Label[] = []
  for (const m of text.matchAll(scheme.re)) {
    const raw = m[1]
    const value = scheme.alpha ? raw.toLowerCase().charCodeAt(0) - 96 : Number(raw)
    if (value < 1) continue
    const start = m.index ?? 0
    if (!scheme.alpha && NOT_A_LABEL.test(text.slice(Math.max(0, start - 14), start))) continue
    out.push({ value, start, end: start + m[0].length })
  }
  return out
}

/** Split labels into runs that count 1, 2, 3, … Stray labels that break the count are ignored. */
function runsOf(labels: Label[]): Label[][] {
  const runs: Label[][] = []
  let cur: Label[] | null = null
  for (const l of labels) {
    if (!cur) {
      if (l.value === 1) cur = [l]
      continue
    }
    const last = cur[cur.length - 1]
    if (l.value === last.value + 1) cur.push(l)
    else if (l.value === 1) {
      runs.push(cur)
      cur = [l]
    }
  }
  if (cur) runs.push(cur)
  return runs
}

interface Layout {
  scheme: Scheme
  runs: Label[][]
}

/** Does every run of `inner` sit between two consecutive labels of `outer`? Then `inner` are the choices inside the items. */
function nestedIn(inner: Layout, outer: Layout): boolean {
  const outerLabels = outer.runs.flat()
  return inner.runs.every((run) => {
    const lo = run[0].start
    const hi = run[run.length - 1].end
    return !outerLabels.some((o) => o.start > lo && o.start < hi)
  })
}

function chooseLayout(text: string): Layout | null {
  const cands: Layout[] = []
  for (const scheme of SCHEMES) {
    const runs = runsOf(labelsFor(text, scheme))
    if (runs.length && runs[0].length >= 2) cands.push({ scheme, runs })
  }
  if (!cands.length) return null
  const outer = cands.filter((c) => !cands.some((o) => o !== c && nestedIn(c, o) && !nestedIn(o, c)))
  const pool = outer.length ? outer : cands
  return pool.reduce((best, c) => (c.runs[0].length > best.runs[0].length ? c : best))
}

// ---- answer key ----------------------------------------------------------------------------

const WORD_MARKER = /(?:^|[\s])(?:klíč|klic|řešení|reseni|odpovědi|odpovedi|key|answer key|answers?|solutions?)\s*[:.\-–]\s*/giu
const STAR_MARKER = /(?:^|\n)[ \t]*[*•▪►]+[ \t]*|(?<=\s)\*+\s*(?=\(?(?:[aA]|1)[).])/g

interface Marker {
  index: number
  end: number
  word: boolean
}

function findMarkers(text: string, from: number): Marker[] {
  const found: Marker[] = []
  for (const re of [STAR_MARKER, WORD_MARKER]) {
    for (const m of text.matchAll(re)) {
      const index = (m.index ?? 0) + (m[0].startsWith('\n') ? 1 : 0)
      if (index > from) found.push({ index, end: (m.index ?? 0) + m[0].length, word: re === WORD_MARKER })
    }
  }
  return found.sort((a, b) => a.index - b.index)
}

/** Separate the answer key from the exercise when both were pasted together. */
function splitKey(text: string, layout: Layout | null): { body: string; key: string } | null {
  const from = layout ? layout.runs[0][0].start : 0
  const markers = findMarkers(text, from)
  for (let i = markers.length - 1; i >= 0; i--) {
    const rest = text.slice(markers[i].end)
    const hasLabel = SCHEMES.some((s) => labelsFor(rest, s).length > 0) || compactLetterKey(rest) !== null
    if (hasLabel || !layout || (markers[i].word && rest.trim())) return { body: text.slice(0, markers[i].index), key: rest }
  }
  if (layout && layout.runs.length >= 2) {
    const start = layout.runs[1][0].start
    return { body: text.slice(0, start), key: text.slice(start) }
  }
  // No labels at all: a last paragraph after a blank line is the key.
  if (!layout) {
    const paras = text.split(/\n[ \t]*\n/)
    if (paras.length >= 2) return { body: paras.slice(0, -1).join('\n\n'), key: paras[paras.length - 1] }
  }
  return null
}

function cleanEntry(s: string, stripPeriod: boolean): string {
  let t = s.replace(/\s+/g, ' ').trim()
  t = t.replace(/^[-–—:=]\s*/, '').replace(/[,;]+$/, '').trim()
  if (stripPeriod) t = t.replace(/\.$/, '').trim()
  return t
}

const COMPACT_PAIR = /(\d{1,3})\s*[-–.):]?\s*([a-zA-Z])(?![\p{L}\p{N}])/gu

/** "1b 2a 3c" → {1:'b', 2:'a', 3:'c'} when the whole key looks like that. */
function compactLetterKey(key: string): Map<number, string> | null {
  const pairs = [...key.matchAll(COMPACT_PAIR)]
  if (pairs.length < 2) return null
  const leftover = key.replace(COMPACT_PAIR, '').replace(/[\s,;.()*\-–]/g, '')
  if (leftover.length > 2) return null
  return new Map(pairs.map((m) => [Number(m[1]), m[2]]))
}

/** Labels that keep counting up, gaps allowed ("a) … c) …" when b is missing from the key). */
function risingLabels(labels: Label[], maxValue: number): Label[] {
  const out: Label[] = []
  for (const l of labels) {
    const last = out[out.length - 1]
    if (l.value > maxValue + 3) continue
    if (!last || l.value > last.value) out.push(l)
  }
  return out
}

function keyEntries(key: string, preferred: SchemeName | null, maxValue: number): Map<number, string> {
  const compact = compactLetterKey(key)
  if (compact) return compact
  let best: Label[] = []
  for (const scheme of SCHEMES) {
    const labels = risingLabels(labelsFor(key, scheme), maxValue)
    if (labels.length > best.length || (labels.length === best.length && labels.length > 0 && scheme.name === preferred)) best = labels
  }
  const out = new Map<number, string>()
  best.forEach((l, i) => out.set(l.value, key.slice(l.end, best[i + 1]?.start ?? key.length)))
  return out
}

// ---- items --------------------------------------------------------------------------------

/** A blank: dots, ellipsis, underscores or long dashes. Blanks split by spaces count as one. */
const GAP = /(?:[.…·_]{3,}|_{2,}|-{4,}|…+)(?:[ \t]+[.…·_]{3,})*/gu

/** The sentence with every blank filled in and the bracketed hints removed. */
function sentenceWith(stem: string, gaps: RegExpMatchArray[], answers: string[]): string {
  let out = ''
  let cursor = 0
  gaps.forEach((g, j) => {
    out += stem.slice(cursor, g.index) + ' ' + (answers[j] ?? '') + ' '
    cursor = (g.index ?? 0) + g[0].length
  })
  out += stem.slice(cursor)
  return tidy(out.replace(/\([^()]*\)/gu, ' '))
}

function hasGap(s: string): boolean {
  return new RegExp(GAP.source, 'u').test(s)
}

function groupKeyOf(bracket: string): string | undefined {
  if (!/[–—-]|\//.test(bracket)) return undefined
  const words = (bracket.toLowerCase().match(/\p{L}+/gu) ?? []).map((w) => (w.length > 3 && w.startsWith('ne') ? w.slice(2) : w))
  if (words.length < 2) return undefined
  return Array.from(new Set(words)).sort().join(' ')
}

function groupFor(text: string, nearIndex: number): string | undefined {
  const brackets = [...text.matchAll(/\(([^()]{3,60})\)/gu)].map((m) => ({ at: m.index ?? 0, key: groupKeyOf(m[1]) })).filter((b) => b.key)
  if (!brackets.length) return undefined
  const after = brackets.find((b) => b.at >= nearIndex)
  return (after ?? brackets[0]).key
}

function tidy(s: string): string {
  return s
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim()
}

function splitAnswers(entry: string): string[] {
  return entry
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean)
}

interface Parsed {
  items: Item[]
  gaps: number
  answers: number
  options: boolean
}

function innerOptions(seg: string, outer: Scheme): { stem: string; options: string[] } | null {
  let best: { run: Label[]; labels: Label[] } | null = null
  for (const scheme of SCHEMES) {
    if (scheme.name === outer.name) continue
    const labels = labelsFor(seg, scheme)
    const runs = runsOf(labels)
    if (runs.length && runs[0].length >= 2 && (!best || runs[0].length > best.run.length)) best = { run: runs[0], labels }
  }
  if (!best) return null
  const run = best.run
  const options = run.map((l, i) => tidy(seg.slice(l.end, run[i + 1]?.start ?? seg.length)).replace(/[,;]+$/, '').trim())
  if (options.some((o) => !o)) return null
  return { stem: seg.slice(0, run[0].start), options }
}

function optionFor(entry: string, options: string[]): string | null {
  const m = /^\(?([a-zA-Z])\)?[.:)]?$/u.exec(entry.trim())
  if (m) {
    const idx = m[1].toLowerCase().charCodeAt(0) - 97
    if (idx >= 0 && idx < options.length) return options[idx]
  }
  const n = /^\(?(\d{1,2})\)?[.:)]?$/u.exec(entry.trim())
  if (n) {
    const idx = Number(n[1]) - 1
    if (idx >= 0 && idx < options.length) return options[idx]
  }
  const key = normalize(entry)
  return options.find((o) => normalize(o) === key) ?? null
}

function buildFromLabelled(body: string, layout: Layout, key: Map<number, string>, warnings: string[]): Parsed {
  const run = layout.runs[0]
  const items: Item[] = []
  const seen = new Set<string>()
  let gaps = 0
  let answers = 0
  let usedOptions = false

  const push = (item: Item) => {
    if (seen.has(item.id)) return
    seen.add(item.id)
    items.push(item)
  }

  run.forEach((label, idx) => {
    const seg = body.slice(label.end, run[idx + 1]?.start ?? body.length)
    const name = layout.scheme.alpha ? String.fromCharCode(96 + label.value) : String(label.value)
    const inner = innerOptions(seg, layout.scheme)
    const stem = inner ? inner.stem : seg
    const found = [...stem.matchAll(GAP)]
    const entryRaw = key.get(label.value)

    if (inner) usedOptions = true
    if (found.length) gaps += found.length > 1 && !inner ? found.length : 1

    if (entryRaw === undefined || !cleanEntry(entryRaw, found.length > 0)) {
      warnings.push(`No answer found for ${name}`)
      return
    }
    const entry = cleanEntry(entryRaw, found.length > 0)

    // Items that come with their own choices.
    if (inner) {
      const right = optionFor(entry, inner.options)
      if (!right) {
        warnings.push(`The answer for ${name} ("${entry}") is not one of its choices`)
        return
      }
      let q = tidy(stem)
      const g = [...q.matchAll(GAP)]
      if (g.length) q = tidy(q.slice(0, g[0].index) + ' ___ ' + q.slice((g[0].index ?? 0) + g[0][0].length).replace(GAP, '……'))
      const it: Item = { id: hashId(`${q}\u0001${right}`), q, a: [right], options: inner.options }
      if (found.length) it.say = sentenceWith(stem, found, [right, ...found.slice(1).map(() => '')])
      answers += 1
      push(it)
      return
    }

    if (!found.length) {
      const q = tidy(stem)
      if (!q) return
      answers += 1
      push({ id: hashId(`${q}\u0001${entry.split(/\s+\/\s+/)[0]}`), q, a: entry.split(/\s+\/\s+/).map((s) => s.trim()).filter(Boolean) })
      return
    }

    // Fill-in-the-blank. One blank takes the whole entry; several blanks take one part each.
    const parts =
      found.length === 1
        ? [splitAnswers(entry)]
        : (entry.includes(';') ? entry.split(';') : entry.split(',')).map((p) => splitAnswers(p.trim())).filter((p) => p.length)
    if (found.length > 1 && parts.length !== found.length) {
      warnings.push(`${name}) has ${found.length} blanks but ${parts.length} answer${parts.length === 1 ? '' : 's'} ("${entry}")`)
      return
    }
    found.forEach((g, k) => {
      const answer = parts[k]
      if (!answer?.length) return
      let q = ''
      let cursor = 0
      found.forEach((other, j) => {
        q += stem.slice(cursor, other.index)
        q += j === k ? ' ___ ' : ' …… '
        cursor = (other.index ?? 0) + other[0].length
      })
      q += stem.slice(cursor)
      q = tidy(q)
      const group = groupFor(stem, g.index ?? 0)
      const item: Item = { id: hashId(`${q}\u0001${answer[0]}`), q, a: answer }
      item.say = sentenceWith(
        stem,
        found,
        parts.map((p) => p?.[0] ?? ''),
      )
      if (group) item.group = group
      answers += 1
      push(item)
    })
  })

  return { items, gaps, answers, options: usedOptions }
}

function firstSentence(s: string): string {
  const m = /^(.{3,80}?)(?:[.!?:]\s|$)/u.exec(s.trim())
  return (m ? m[1] : s.slice(0, 60)).replace(/[.:\s]+$/u, '').trim()
}

export function parseWorkbook(input: string, answersInput = ''): WorkbookResult {
  const warnings: string[] = []
  const clean = (s: string) =>
    s
      .replace(/^﻿/, '')
      .replace(/\r\n?/g, '\n')
      .replace(/[  ​­]/g, (c) => (c === '​' || c === '­' ? '' : ' '))
  const text = clean(input).trim()
  const answersText = clean(answersInput).trim()

  const empty = (extra: Partial<WorkbookResult['stats']> = {}): WorkbookResult => ({
    items: [],
    warnings,
    stats: { questions: 0, gaps: 0, answers: 0, labels: '', options: false, keyFound: false, ...extra },
  })
  if (!text) return empty()

  let layout = chooseLayout(text)
  let body = text
  let keyText = answersText
  let keyFound = !!answersText

  if (!answersText) {
    const split = splitKey(text, layout)
    if (split) {
      body = split.body
      keyText = split.key.trim()
      keyFound = keyText !== ''
      layout = chooseLayout(body) ?? layout
    }
  } else if (layout && layout.runs.length >= 2) {
    // The key was pasted in its own box, so ignore a repeated list in the exercise box.
    body = text.slice(0, layout.runs[1][0].start)
    layout = chooseLayout(body) ?? layout
  }

  if (layout) {
    const run = layout.runs[0]
    const prelude = tidy(body.slice(0, run[0].start))
    const result: WorkbookResult = empty({ questions: run.length, labels: layout.scheme.example, keyFound })
    if (prelude) {
      result.title = firstSentence(prelude)
      result.description = prelude.length > 220 ? prelude.slice(0, 217).replace(/\s+\S*$/, '') + '…' : prelude
    }
    result.stats.gaps = run.reduce((n, l, i) => n + (hasGap(body.slice(l.end, run[i + 1]?.start ?? body.length)) ? 1 : 0), 0)
    if (!keyFound) {
      warnings.push('No answer key found. Paste it after the exercise (start it with * or "Klíč:") or in the answer box.')
      return result
    }
    const maxLabel = run[run.length - 1].value
    const key = keyEntries(keyText, layout.scheme.name, maxLabel)
    const parsed = buildFromLabelled(body, layout, key, warnings)
    result.items = parsed.items
    result.stats.answers = parsed.answers
    result.stats.options = parsed.options
    const extra = [...key.keys()].filter((v) => !run.some((l) => l.value === v))
    if (extra.length) warnings.push(`The answer key has ${extra.length} more entr${extra.length === 1 ? 'y' : 'ies'} than the exercise has questions`)
    return result
  }

  // No labels: one question per line, answers in the same order.
  const lines = (s: string) =>
    s
      .split('\n')
      .map((l) => l.replace(/^[\s*•▪►\-–\d.)]+(?=\p{L})/u, '').trim())
      .filter(Boolean)
  const qs = lines(body)
  const as = lines(keyText.replace(WORD_MARKER, ' '))
  if (!keyFound || qs.length < 2 || as.length < 2) {
    warnings.push('Could not find numbered questions. Label them a) b) c) or 1. 2. 3., or use the question | answer format.')
    return empty({ questions: qs.length, keyFound })
  }
  if (qs.length !== as.length) warnings.push(`${qs.length} questions but ${as.length} answers. Check that each line has a partner.`)
  const result = empty({ questions: qs.length, keyFound, labels: 'one per line' })
  const seen = new Set<string>()
  qs.slice(0, Math.min(qs.length, as.length)).forEach((raw, i) => {
    const found = [...raw.matchAll(GAP)]
    let q = tidy(raw)
    if (found.length) q = tidy(raw.slice(0, found[0].index) + ' ___ ' + raw.slice((found[0].index ?? 0) + found[0][0].length).replace(GAP, '……'))
    const a = found.length ? splitAnswers(cleanEntry(as[i], true)) : as[i].split(/\s+\/\s+/).map((x) => x.trim()).filter(Boolean)
    if (!a.length) return
    const item: Item = { id: hashId(`${q}\u0001${a[0]}`), q, a }
    if (!seen.has(item.id)) {
      seen.add(item.id)
      result.items.push(item)
    }
  })
  result.stats.answers = result.items.length
  result.stats.gaps = qs.filter((l) => /(?:[.…_]{3,}|…)/.test(l)).length
  return result
}

/** Cheap check used to suggest the exercise mode when someone pastes a whole workbook page. */
export function looksLikeWorkbook(text: string): boolean {
  const r = parseWorkbook(text)
  return r.stats.questions >= 2 && (r.stats.gaps > 0 || r.stats.keyFound)
}

/** A small made-up exercise, used by the importer's "Fill in an example" button. */
export const WORKBOOK_EXAMPLE = `Doplňte správný tvar. Vzor: (já) Každé ráno ...piju... (pít) kávu.
a) (my) Dnes večer ................................ (jít – chodit) do kina.
b) (ty) Kam ................................ (jet – jezdit) každé léto?
c) (já) Teď nemám čas, ................................ (jít – chodit) na poštu.
d) Paní Nováková ................................ (jet – jezdit) do práce tramvají.
e) Proč ................................ (nejít – nechodit) Petr s námi na výlet?
f) Moji rodiče ................................ (jet – jezdit) o víkendu na chalupu a já ................................ (jít – chodit) k babičce.

* a) jdeme, b) jezdíš, c) jdu, d) jezdí, e) nejde, f) jedou, jdu`
