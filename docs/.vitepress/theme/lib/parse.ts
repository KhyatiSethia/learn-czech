import type { Item } from './types'

export type DelimiterChoice = 'auto' | 'tab' | 'pipe' | 'semicolon' | 'comma' | 'arrow' | 'colons'

export const DELIMITERS: Record<Exclude<DelimiterChoice, 'auto'>, string> = {
  tab: '\t',
  pipe: '|',
  arrow: '=>',
  colons: '::',
  semicolon: ';',
  comma: ',',
}

/** Order matters: the first delimiter that appears on (nearly) every line wins. */
const AUTO_ORDER: Exclude<DelimiterChoice, 'auto'>[] = ['tab', 'pipe', 'arrow', 'colons', 'semicolon', 'comma']

export const MAX_ITEMS = 2000

export interface Skipped {
  line: number
  text: string
  reason: string
}

export interface ParseResult {
  items: Item[]
  skipped: Skipped[]
  delimiter: Exclude<DelimiterChoice, 'auto'> | 'json' | 'none'
  header: boolean
  title?: string
  description?: string
}

export function hashId(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

export function makeItem(q: string, answers: string[], hint?: string): Item {
  const a = answers.map((x) => x.trim()).filter(Boolean)
  const item: Item = { id: hashId(`${q}\u0001${a[0] ?? ''}`), q: q.trim(), a }
  if (hint && hint.trim()) item.hint = hint.trim()
  return item
}

/** "Dobrý den / Ahoj" → ["Dobrý den", "Ahoj"]. Only a slash with spaces around it separates alternatives. */
export function splitAlternatives(raw: string): string[] {
  return raw.split(/\s+\/\s+/).map((s) => s.trim()).filter(Boolean)
}

interface Row {
  fields: string[]
  line: number
}

/** Delimited-text scanner with RFC 4180 style quoting (quotes may span lines). */
function scanRows(text: string, delim: string): Row[] {
  const rows: Row[] = []
  let fields: string[] = []
  let cur = ''
  let inQuotes = false
  let line = 1
  let rowLine = 1

  const endRow = () => {
    fields.push(cur)
    if (fields.some((f) => f.trim() !== '')) rows.push({ fields, line: rowLine })
    fields = []
    cur = ''
  }

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"'
          i++
        } else inQuotes = false
      } else {
        cur += c
        if (c === '\n') line++
      }
      continue
    }
    if (c === '"' && cur === '') {
      inQuotes = true
      continue
    }
    if (text.startsWith(delim, i)) {
      fields.push(cur)
      cur = ''
      i += delim.length - 1
      continue
    }
    if (c === '\r') continue
    if (c === '\n') {
      endRow()
      line++
      rowLine = line
      continue
    }
    cur += c
  }
  endRow()
  return rows
}

const HEADER_WORDS = new Set([
  'question', 'questions', 'q', 'prompt', 'front', 'term', 'english', 'en',
  'czech', 'cs', 'česky', 'čeština', 'answer', 'answers', 'a', 'solution', 'back',
  'translation', 'definition', 'hint', 'hints', 'clue', 'note', 'notes', 'tip',
  'explanation', 'otázka', 'odpověď', 'nápověda',
])
const HINT_WORDS = new Set(['hint', 'hints', 'clue', 'note', 'notes', 'tip', 'explanation', 'nápověda'])

function detectDelimiter(lines: string[]): Exclude<DelimiterChoice, 'auto'> | null {
  if (!lines.length) return null
  for (const name of AUTO_ORDER) {
    const d = DELIMITERS[name]
    const hits = lines.filter((l) => l.includes(d)).length
    if (hits / lines.length >= 0.8) return name
  }
  return null
}

function fromObject(o: unknown): { q: string; a: string; hint?: string } | null {
  if (Array.isArray(o)) {
    if (o.length >= 2 && typeof o[0] === 'string' && typeof o[1] === 'string') {
      return { q: o[0], a: o[1], hint: typeof o[2] === 'string' ? o[2] : undefined }
    }
    return null
  }
  if (!o || typeof o !== 'object') return null
  const r = o as Record<string, unknown>
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = r[k]
      if (typeof v === 'string' && v.trim()) return v
      if (Array.isArray(v) && v.every((x) => typeof x === 'string') && v.length) return (v as string[]).join(' / ')
    }
    return undefined
  }
  const q = pick('question', 'q', 'prompt', 'front', 'term')
  const a = pick('answer', 'a', 'answers', 'solution', 'back', 'translation')
  if (!q || !a) return null
  return { q, a, hint: pick('hint', 'clue', 'note', 'tip') }
}

function parseJson(text: string): ParseResult | null {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return null
  }
  let list: unknown[] | null = null
  let title: string | undefined
  let description: string | undefined
  if (Array.isArray(data)) list = data
  else if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>
    const inner = d.items ?? d.questions ?? d.cards ?? d.exercises
    if (Array.isArray(inner)) list = inner
    if (typeof d.title === 'string') title = d.title
    if (typeof d.description === 'string') description = d.description
  }
  if (!list) return null
  const result: ParseResult = { items: [], skipped: [], delimiter: 'json', header: false, title, description }
  const seen = new Set<string>()
  list.forEach((entry, idx) => {
    const o = fromObject(entry)
    if (!o) {
      result.skipped.push({ line: idx + 1, text: JSON.stringify(entry).slice(0, 80), reason: 'Needs a question and an answer' })
      return
    }
    const item = makeItem(o.q, splitAlternatives(o.a), o.hint)
    if (!item.q || !item.a.length) {
      result.skipped.push({ line: idx + 1, text: o.q.slice(0, 80), reason: 'Question or answer is empty' })
      return
    }
    if (seen.has(item.id)) return
    seen.add(item.id)
    result.items.push(item)
  })
  result.items = result.items.slice(0, MAX_ITEMS)
  return result
}

/**
 * Turn whatever the learner pasted or uploaded into exercise items.
 *
 * Accepts rows copied from a spreadsheet (tab separated), CSV exports (comma or
 * semicolon), simple `question | answer | hint` or `question => answer` lines,
 * and JSON. Lines starting with `#` are comments; `# title:` and
 * `# description:` set the deck's name.
 */
export function parseDeckText(input: string, delimiter: DelimiterChoice = 'auto'): ParseResult {
  const text = input.replace(/^﻿/, '')
  const trimmed = text.trimStart()
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    const json = parseJson(text)
    if (json) return json
  }

  let title: string | undefined
  let description: string | undefined
  const lines = text.split('\n').map((raw) => {
    const line = raw.replace(/\r$/, '')
    const t = line.trim()
    if (t.startsWith('#')) {
      const m = /^#\s*(title|description)\s*:\s*(.*)$/i.exec(t)
      if (m) {
        if (m[1].toLowerCase() === 'title') title = m[2].trim()
        else description = m[2].trim()
      }
      return '' // keep line numbers stable
    }
    return line
  })

  const dataLines = lines.filter((l) => l.trim() !== '')
  const chosen: Exclude<DelimiterChoice, 'auto'> | null =
    delimiter === 'auto' ? detectDelimiter(dataLines) : delimiter

  const result: ParseResult = {
    items: [],
    skipped: [],
    delimiter: chosen ?? 'none',
    header: false,
    title,
    description,
  }
  if (!dataLines.length) return result

  if (!chosen) {
    dataLines.forEach((l, i) =>
      result.skipped.push({
        line: i + 1,
        text: l.slice(0, 80),
        reason: 'No separator found. Put a tab, |, ;, comma or => between the question and the answer',
      }),
    )
    return result
  }

  const rows = scanRows(lines.join('\n'), DELIMITERS[chosen])
  let qCol = 0
  let aCol = 1
  let hintCol = 2

  if (rows.length) {
    const first = rows[0].fields.map((f) => f.trim().toLowerCase())
    const nonEmpty = first.filter(Boolean)
    if (nonEmpty.length >= 2 && nonEmpty.every((f) => HEADER_WORDS.has(f))) {
      result.header = true
      const content: number[] = []
      let hc = -1
      first.forEach((name, idx) => {
        if (HINT_WORDS.has(name)) hc = idx
        else content.push(idx)
      })
      if (content.length >= 2) {
        qCol = content[0]
        aCol = content[1]
      }
      hintCol = hc >= 0 ? hc : qCol === 0 && aCol === 1 ? 2 : -1
      rows.shift()
    }
  }

  const seen = new Set<string>()
  for (const row of rows) {
    const q = (row.fields[qCol] ?? '').trim()
    const aRaw = (row.fields[aCol] ?? '').trim()
    const hint = hintCol >= 0 ? (row.fields[hintCol] ?? '').trim() : ''
    const preview = row.fields.join(' ¦ ').slice(0, 80)
    if (row.fields.length < 2) {
      result.skipped.push({ line: row.line, text: preview, reason: 'Needs both a question and an answer' })
      continue
    }
    if (!q || !aRaw) {
      result.skipped.push({ line: row.line, text: preview, reason: 'Question or answer is empty' })
      continue
    }
    const item = makeItem(q, splitAlternatives(aRaw), hint)
    if (seen.has(item.id)) continue
    seen.add(item.id)
    result.items.push(item)
  }
  if (result.items.length > MAX_ITEMS) {
    result.skipped.push({ line: 0, text: '', reason: `Only the first ${MAX_ITEMS} rows were kept` })
    result.items = result.items.slice(0, MAX_ITEMS)
  }
  return result
}

function quoteField(s: string): string {
  return /[\t\n\r"]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Tab-separated text that parseDeckText reads back unchanged (and that pastes into a spreadsheet). */
export function serializeItems(items: Item[]): string {
  return items
    .map((it) => [it.q, it.a.join(' / '), it.hint ?? ''].map(quoteField).join('\t').replace(/\t+$/, ''))
    .join('\n')
}
