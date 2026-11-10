export interface Item {
  /** Stable id derived from the question and first answer, so progress survives re-imports. */
  id: string
  q: string
  /** Accepted answers. The first one is the canonical answer shown after a miss. */
  a: string[]
  hint?: string
}

export interface Deck {
  id: string
  title: string
  description?: string
  items: Item[]
  source: 'builtin' | 'user'
  updatedAt?: number
}

export type Verdict = 'correct' | 'almost' | 'wrong'
export type Mode = 'mixed' | 'type' | 'choice' | 'tiles'
export type ChallengeKind = 'type' | 'choice' | 'tiles'
