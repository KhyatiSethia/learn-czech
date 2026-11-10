import type { ChallengeKind, Item, Mode, Verdict } from './types'
import { gradeAnswer, normalize } from './text'

export interface Tile {
  id: number
  text: string
}

export interface Challenge {
  key: string
  item: Item
  kind: ChallengeKind
  /** 0 for the first time the item is shown, 1+ for retries after a miss. */
  attempt: number
  options?: string[]
  tiles?: Tile[]
}

export interface SessionOptions {
  mode: Mode
  hearts: boolean
  strict: boolean
  /** Never ask for typed answers: every question is a pick-one or a build-the-sentence. */
  noTyping?: boolean
}

export interface AnswerResult {
  verdict: Verdict
  reason?: 'diacritics' | 'typo'
  expected: string
  given: string
  xp: number
  item: Item
  kind: ChallengeKind
  attempt: number
  /** The item was put back in the queue to be tried again shortly. */
  retry: boolean
  finished: boolean
  failed: boolean
}

export interface Summary {
  total: number
  firstTry: number
  accuracy: number
  stars: 0 | 1 | 2 | 3
  xp: number
  bestStreak: number
  failed: boolean
  missed: Item[]
  /** item id → answered correctly on the first attempt */
  firstTryById: Record<string, boolean>
}

type Rng = () => number

export function shuffle<T>(list: readonly T[], rng: Rng = Math.random): T[] {
  const a = list.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function wordsOf(s: string): string[] {
  return s.trim().split(/\s+/).filter(Boolean)
}

const stripEdges = (w: string) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')

/**
 * Choose which items to practise. Items the learner keeps missing (low "box")
 * are more likely to be picked; mastered ones still show up occasionally.
 */
export function pickItems(items: Item[], boxes: Record<string, number>, count: number, rng: Rng = Math.random): Item[] {
  const scored = items.map((it) => {
    const box = Math.min(3, Math.max(0, boxes[it.id] ?? 0))
    return { it, key: Math.pow(rng(), 1 / (4 - box)) }
  })
  scored.sort((x, y) => y.key - x.key)
  return scored.slice(0, count).map((s) => s.it)
}

/**
 * Wrong answers to offer next to the right one. Answers of other questions in the same group
 * (for example other forms of jít/chodit) come first because they are the realistic mix-ups;
 * after that, answers of a similar length from the rest of the set.
 */
export function distractorsFor(item: Item, pool: Item[], n: number, rng: Rng = Math.random): string[] {
  const own = new Set(item.a.map(normalize))
  const seen = new Set<string>()
  const same: string[] = []
  const rest: string[] = []
  for (const p of pool) {
    if (p.id === item.id) continue
    const a = p.a[0]
    const k = normalize(a)
    if (!k || own.has(k) || seen.has(k)) continue
    seen.add(k)
    ;(item.group && p.group === item.group ? same : rest).push(a)
  }
  const len = wordsOf(item.a[0]).length
  const near = rest.filter((c) => Math.abs(wordsOf(c).length - len) <= 1)
  const far = rest.filter((c) => !near.includes(c))
  return [...shuffle(same, rng), ...shuffle(near, rng), ...shuffle(far, rng)].slice(0, n)
}

/** The choices printed in the workbook, if the item has them and the right answer is one of them. */
function printedOptions(item: Item): string[] | null {
  const opts = item.options
  if (!opts || opts.length < 2) return null
  const right = new Set(item.a.map(normalize))
  return opts.some((o) => right.has(normalize(o))) ? opts : null
}

export function buildTiles(item: Item, pool: Item[], rng: Rng = Math.random): Tile[] {
  const words = wordsOf(item.a[0]).map(stripEdges).filter(Boolean)
  const extraCount = Math.min(2, Math.floor(words.length / 3))
  const used = new Set(words.map(normalize))
  const extras: string[] = []
  for (const p of shuffle(pool, rng)) {
    if (extras.length >= extraCount) break
    if (p.id === item.id) continue
    const cand = wordsOf(p.a[0]).slice(1).map(stripEdges).filter(Boolean)
    for (const w of shuffle(cand, rng)) {
      const k = normalize(w)
      if (k && !used.has(k)) {
        used.add(k)
        extras.push(w)
        break
      }
    }
  }
  const all = [...words, ...extras].map((text, i) => ({ id: i, text }))
  let tiles = shuffle(all, rng)
  // Avoid handing over the answer in the right order.
  for (let tries = 0; tries < 5 && words.length > 1 && tiles.slice(0, words.length).every((t, i) => t.text === words[i]); tries++) {
    tiles = shuffle(all, rng)
  }
  return tiles
}

function chooseKind(item: Item, pool: Item[], mode: Mode, attempt: number, rng: Rng, noTyping: boolean): ChallengeKind {
  const wordCount = wordsOf(item.a[0]).length
  const printed = !!printedOptions(item)
  const canTiles = !printed && wordCount >= 3 && wordCount <= 12
  const canChoice = printed || distractorsFor(item, pool, 3, rng).length >= 2
  // Without typing, anything that cannot be a pick or a build still has to be typed. It is rare:
  // it only happens for a set of fewer than three questions.
  const noType = (): ChallengeKind => (canChoice ? 'choice' : canTiles ? 'tiles' : 'type')
  switch (mode) {
    case 'type':
      return noTyping ? noType() : 'type'
    case 'choice':
      return canChoice ? 'choice' : noTyping ? noType() : 'type'
    case 'tiles':
      return canTiles ? 'tiles' : canChoice && noTyping ? 'choice' : noTyping ? noType() : 'type'
    default: {
      if (attempt > 0) return canTiles ? 'tiles' : canChoice ? 'choice' : 'type'
      const weights: [ChallengeKind, number][] = [
        ['type', noTyping ? 0 : 2],
        ['choice', canChoice ? 2 : 0],
        ['tiles', canTiles ? 3 : 0],
      ]
      const total = weights.reduce((s, [, w]) => s + w, 0)
      if (total === 0) return 'type'
      let r = rng() * total
      for (const [kind, w] of weights) {
        if ((r -= w) < 0) return kind
      }
      return 'type'
    }
  }
}

export function buildChallenge(item: Item, pool: Item[], mode: Mode, attempt = 0, rng: Rng = Math.random, noTyping = false): Challenge {
  const kind = chooseKind(item, pool, mode, attempt, rng, noTyping)
  const ch: Challenge = { key: `${item.id}:${attempt}`, item, kind, attempt }
  if (kind === 'choice') {
    const printed = printedOptions(item)
    // Keep the workbook's own order for printed choices, so they match what the book shows.
    ch.options = printed ? printed.slice() : shuffle([item.a[0], ...distractorsFor(item, pool, 3, rng)], rng)
  }
  if (kind === 'tiles') ch.tiles = buildTiles(item, pool, rng)
  return ch
}

export const MAX_RETRIES = 2
export const START_LIVES = 3

/** The rules of one practice run, kept free of any UI so it can be tested. */
export class Session {
  readonly total: number
  queue: Challenge[]
  doneIds: string[] = []
  lives = START_LIVES
  streak = 0
  bestStreak = 0
  xp = 0
  missed: Item[] = []
  firstTryById: Record<string, boolean> = {}
  failed = false

  private readonly pool: Item[]
  private readonly opts: SessionOptions
  private readonly rng: Rng

  constructor(items: Item[], pool: Item[], opts: SessionOptions, rng: Rng = Math.random) {
    this.pool = pool
    this.opts = opts
    this.rng = rng
    this.total = items.length
    this.queue = items.map((it) => buildChallenge(it, pool, opts.mode, 0, rng, !!opts.noTyping))
  }

  get current(): Challenge | undefined {
    return this.queue[0]
  }

  get progress(): number {
    return this.total === 0 ? 1 : this.doneIds.length / this.total
  }

  get finished(): boolean {
    return this.failed || this.queue.length === 0
  }

  submit(response: string | string[], hintUsed = false): AnswerResult {
    const ch = this.queue[0]
    if (!ch || this.finished) throw new Error('There is no active question')

    const given = Array.isArray(response) ? response.join(' ') : response
    // Choices and tiles are exact by construction, so only typed answers get leniency.
    const grade = gradeAnswer(given, ch.item.a, { strict: ch.kind === 'type' ? this.opts.strict : true })
    const ok = grade.verdict !== 'wrong'
    const id = ch.item.id

    if (!(id in this.firstTryById)) this.firstTryById[id] = ok && ch.attempt === 0

    let xp = 0
    let retry = false
    this.queue.shift()

    if (ok) {
      xp = grade.verdict === 'correct' ? 10 + Math.min(this.streak, 5) * 2 : 6
      if (ch.attempt > 0) xp = Math.round(xp / 2)
      if (hintUsed) xp = Math.max(1, Math.round(xp / 2))
      this.streak += 1
      this.bestStreak = Math.max(this.bestStreak, this.streak)
      this.xp += xp
      this.doneIds.push(id)
    } else {
      this.streak = 0
      if (!this.missed.some((m) => m.id === id)) this.missed.push(ch.item)
      if (this.opts.hearts) {
        this.lives -= 1
        if (this.lives <= 0) this.failed = true
      }
      if (ch.attempt < MAX_RETRIES) {
        const next = buildChallenge(ch.item, this.pool, this.opts.mode, ch.attempt + 1, this.rng, !!this.opts.noTyping)
        this.queue.splice(Math.min(2, this.queue.length), 0, next)
        retry = true
      } else {
        // Retire the item so the run always ends; it stays in the missed list.
        this.doneIds.push(id)
      }
    }

    return {
      verdict: grade.verdict,
      reason: grade.reason,
      expected: grade.expected,
      given,
      xp,
      item: ch.item,
      kind: ch.kind,
      attempt: ch.attempt,
      retry,
      finished: this.finished,
      failed: this.failed,
    }
  }

  summary(): Summary {
    const firstTry = Object.values(this.firstTryById).filter(Boolean).length
    const accuracy = this.total ? firstTry / this.total : 0
    const stars: Summary['stars'] = this.failed ? 0 : accuracy >= 0.9 ? 3 : accuracy >= 0.7 ? 2 : 1
    return {
      total: this.total,
      firstTry,
      accuracy,
      stars,
      xp: this.xp,
      bestStreak: this.bestStreak,
      failed: this.failed,
      missed: this.missed.slice(),
      firstTryById: { ...this.firstTryById },
    }
  }
}

/** A short nudge for a hint: the author's hint if there is one, otherwise the shape of the answer. */
export function hintFor(item: Item): string {
  if (item.hint) return item.hint
  const shape = wordsOf(item.a[0])
    .map((w) => {
      const core = stripEdges(w)
      return core ? core[0] + '·'.repeat(Math.max(0, Array.from(core).length - 1)) : w
    })
    .join('  ')
  return shape
}
