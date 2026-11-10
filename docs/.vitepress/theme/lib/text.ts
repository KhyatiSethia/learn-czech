import type { Verdict } from './types'

/** Remove combining marks: č→c, ř→r, ů→u, ď→d … */
export function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC')
}

/** Lower-case, drop punctuation, collapse whitespace. Keeps letters (with their marks) and digits. */
export function normalize(s: string): string {
  return s
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    prev = cur
  }
  return prev[b.length]
}

export interface Grade {
  verdict: Verdict
  /** Why it was not a clean pass. */
  reason?: 'diacritics' | 'typo'
  /** The accepted answer that was matched, or the closest one on a miss. */
  expected: string
}

export interface GradeOptions {
  /** Strict mode: only an exact match (ignoring case and punctuation) passes. */
  strict?: boolean
}

export function gradeAnswer(input: string, answers: string[], opts: GradeOptions = {}): Grade {
  const fallback = answers[0] ?? ''
  const n = normalize(input)
  if (!n) return { verdict: 'wrong', expected: fallback }

  for (const ans of answers) {
    if (n === normalize(ans)) return { verdict: 'correct', expected: ans }
  }

  const sn = stripDiacritics(n)
  for (const ans of answers) {
    if (sn === stripDiacritics(normalize(ans))) {
      return opts.strict
        ? { verdict: 'wrong', reason: 'diacritics', expected: ans }
        : { verdict: 'almost', reason: 'diacritics', expected: ans }
    }
  }

  let closest = fallback
  let closestDist = Infinity
  for (const ans of answers) {
    const sa = stripDiacritics(normalize(ans))
    const d = levenshtein(sn, sa)
    if (d < closestDist) {
      closestDist = d
      closest = ans
    }
    const limit = sa.length >= 12 ? 2 : sa.length >= 5 ? 1 : 0
    if (!opts.strict && limit > 0 && d <= limit) {
      return { verdict: 'almost', reason: 'typo', expected: ans }
    }
  }
  return { verdict: 'wrong', expected: closest }
}

export interface Seg {
  t: string
  /** The character carries a háček, čárka or kroužek. */
  dia: boolean
  /** The character differs from the same position in `against`. */
  off: boolean
}

function hasMark(ch: string): boolean {
  return /[̀-ͯ]/.test(ch.normalize('NFD'))
}

/**
 * Split text into per-character segments so the UI can tint diacritics and, when
 * `against` has the same length, flag the characters that differ.
 */
export function markSegments(text: string, against?: string): Seg[] {
  const chars = Array.from(text.normalize('NFC'))
  const ref = against === undefined ? null : Array.from(against.normalize('NFC'))
  const comparable = ref !== null && ref.length === chars.length
  return chars.map((t, i) => ({
    t,
    dia: hasMark(t),
    off: comparable && ref![i].toLowerCase() !== t.toLowerCase(),
  }))
}
