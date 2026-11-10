export interface Item {
  /** Stable id derived from the question and first answer, so progress survives re-imports. */
  id: string
  q: string
  /** Accepted answers. The first one is the canonical answer shown after a miss. */
  a: string[]
  hint?: string
  /**
   * Items in the same group are similar on purpose (for example all answers for the verb pair
   * "jít – chodit"), so the wrong options offered in pick-one questions are tempting ones.
   */
  group?: string
  /**
   * Ready-made choices from the workbook, including the right one. When present, pick-one
   * questions use these instead of borrowing wrong answers from other items.
   */
  options?: string[]
  /** The whole sentence with every blank filled in, for reading aloud after a fill-in-the-blank question. */
  say?: string
}

export type Lang = 'cs' | 'en'

export interface Deck {
  id: string
  title: string
  description?: string
  items: Item[]
  source: 'builtin' | 'user'
  updatedAt?: number
  /** Spoken language of the questions and of the answers. Guessed per item when missing. */
  langs?: { q: Lang; a: Lang }
  /** The pasted workbook text this set was made from, so Edit can show it again exactly as it was. */
  workbook?: { text: string; answers: string }
}

export type Verdict = 'correct' | 'almost' | 'wrong'
export type Mode = 'mixed' | 'type' | 'choice' | 'tiles'
export type ChallengeKind = 'type' | 'choice' | 'tiles'
