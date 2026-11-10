import { computed, ref } from 'vue'
import type { Deck, Mode } from './types'
import type { Summary } from './session'
import { builtinDecks } from './builtin'

const KEYS = {
  decks: 'czech.decks.v1',
  progress: 'czech.progress.v1',
  stats: 'czech.stats.v1',
  prefs: 'czech.prefs.v1',
}

export interface Prefs {
  mode: Mode
  length: number
  hearts: boolean
  strict: boolean
  sound: boolean
  /** Only pick or build answers; never type. */
  noTyping: boolean
  /** Tapping an answer checks it straight away, with no Check button. */
  quickPick: boolean
  /** Show speaker buttons and read sentences aloud. */
  audio: boolean
  /** Read the full sentence aloud after each answer. */
  autoPlay: boolean
  /** Speech speed, 1 is normal. */
  rate: number
  /** Voice names chosen by the learner; empty means the best one found. */
  csVoice: string
  enVoice: string
}
export interface DeckBest {
  stars: number
  accuracy: number
  plays: number
}
export interface Stats {
  xp: number
  sessions: number
  streakDays: number
  lastDay: string
  best: Record<string, DeckBest>
}

const defaultPrefs = (): Prefs => ({
  mode: 'mixed',
  length: 10,
  hearts: false,
  strict: false,
  sound: true,
  noTyping: true,
  quickPick: false,
  audio: true,
  autoPlay: true,
  rate: 0.9,
  csVoice: '',
  enVoice: '',
})
const defaultStats = (): Stats => ({ xp: 0, sessions: 0, streakDays: 0, lastDay: '', best: {} })

const userDecks = ref<Deck[]>([])
/** item id → mastery box 0..3 (0 = still shaky) */
const progress = ref<Record<string, number>>({})
const stats = ref<Stats>(defaultStats())
const prefs = ref<Prefs>(defaultPrefs())
let loaded = false

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback
  } catch {
    return fallback
  }
}
function readList<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key)
    const v = raw ? JSON.parse(raw) : []
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage full or blocked: the session still works, it just will not persist */
  }
}

const pad = (n: number) => String(n).padStart(2, '0')
export function dayKey(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
export function levelOf(xp: number) {
  return { level: Math.floor(xp / 100) + 1, into: xp % 100 }
}

export function useStore() {
  function init() {
    if (loaded) return
    loaded = true
    userDecks.value = readList<Deck>(KEYS.decks).filter((d) => d && Array.isArray(d.items))
    progress.value = read<Record<string, number>>(KEYS.progress, {})
    stats.value = read<Stats>(KEYS.stats, defaultStats())
    prefs.value = read<Prefs>(KEYS.prefs, defaultPrefs())
  }

  const allDecks = computed<Deck[]>(() => [...builtinDecks, ...userDecks.value])

  function savePrefs() {
    write(KEYS.prefs, prefs.value)
  }

  function saveDeck(deck: Deck) {
    const next = userDecks.value.filter((d) => d.id !== deck.id)
    next.push({ ...deck, source: 'user', updatedAt: Date.now() })
    userDecks.value = next
    write(KEYS.decks, next)
  }

  function removeDeck(id: string) {
    userDecks.value = userDecks.value.filter((d) => d.id !== id)
    write(KEYS.decks, userDecks.value)
  }

  function newDeckId() {
    return `user:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  }

  function mastery(deck: Deck): number {
    if (!deck.items.length) return 0
    const solid = deck.items.filter((i) => (progress.value[i.id] ?? 0) >= 2).length
    return solid / deck.items.length
  }

  /** `scoreboard` is false for "practise mistakes" runs so they do not overwrite a deck's best result. */
  function recordSession(deckId: string, summary: Summary, scoreboard = true) {
    const s = stats.value
    s.xp += summary.xp
    s.sessions += 1
    const today = dayKey()
    if (s.lastDay !== today) {
      const y = new Date()
      y.setDate(y.getDate() - 1)
      s.streakDays = s.lastDay === dayKey(y) ? s.streakDays + 1 : 1
      s.lastDay = today
    }
    if (scoreboard) {
      const b = s.best[deckId] ?? { stars: 0, accuracy: 0, plays: 0 }
      s.best[deckId] = {
        stars: Math.max(b.stars, summary.stars),
        accuracy: Math.max(b.accuracy, summary.accuracy),
        plays: b.plays + 1,
      }
    }
    for (const [id, first] of Object.entries(summary.firstTryById)) {
      const box = progress.value[id] ?? 0
      progress.value[id] = first ? Math.min(3, box + 1) : 0
    }
    write(KEYS.stats, s)
    write(KEYS.progress, progress.value)
  }

  function resetProgress() {
    stats.value = defaultStats()
    progress.value = {}
    write(KEYS.stats, stats.value)
    write(KEYS.progress, progress.value)
  }

  return { init, allDecks, userDecks, progress, stats, prefs, savePrefs, saveDeck, removeDeck, newDeckId, mastery, recordSession, resetProgress }
}
