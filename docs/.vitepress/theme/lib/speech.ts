import { computed, ref } from 'vue'
import { LANG_TAG, detectLang, type Lang } from './lang'

/* ------------------------------------------------------------------------------------------
 * Pure text helpers (no browser needed, so they can be unit tested)
 * ---------------------------------------------------------------------------------------- */

/** Abbreviations after which a full stop does not end a sentence. */
const ABBREVIATIONS = new Set(
  'např tzn tj tzv apod atd cca resp str obr č p pí pí. ing mgr dr prof doc mudr judr phdr bc kč mr mrs ms dr st'.split(' '),
)

/**
 * Split text into sentences for reading aloud. Line breaks always separate. A full stop after a number
 * ("1. května") or a common abbreviation ("např.") does not.
 */
export function splitSentences(text: string): string[] {
  const out: string[] = []
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    let start = 0
    const re = /[.!?…]+["”»)\]]*(?=\s+\S|$)/gu
    for (const m of trimmed.matchAll(re)) {
      const end = (m.index ?? 0) + m[0].length
      const before = trimmed.slice(start, m.index ?? 0)
      const lastWord = (/([\p{L}\p{N}]+)$/u.exec(before)?.[1] ?? '').toLowerCase()
      const isStop = m[0].startsWith('.') && !/[!?…]/.test(m[0])
      if (isStop && (/^\d{1,3}$/.test(lastWord) || ABBREVIATIONS.has(lastWord) || (lastWord.length === 1 && /\p{L}/u.test(lastWord)))) continue
      const piece = trimmed.slice(start, end).trim()
      if (piece) out.push(piece)
      start = end
    }
    const rest = trimmed.slice(start).trim()
    if (rest) out.push(rest)
  }
  return out
}

/** Break a long sentence into pieces a speech engine will read without cutting off (Chrome stops long ones). */
export function chunkForSpeech(sentence: string, maxLen = 200): string[] {
  const s = sentence.trim()
  if (s.length <= maxLen) return s ? [s] : []
  const pieces: string[] = []
  let rest = s
  while (rest.length > maxLen) {
    const window = rest.slice(0, maxLen)
    let cut = Math.max(window.lastIndexOf(', '), window.lastIndexOf('; '), window.lastIndexOf(': '))
    if (cut < maxLen * 0.4) cut = window.lastIndexOf(' ')
    if (cut <= 0) cut = maxLen
    pieces.push(rest.slice(0, cut + 1).trim())
    rest = rest.slice(cut + 1).trim()
  }
  if (rest) pieces.push(rest)
  return pieces.filter(Boolean)
}

/** Things a voice should not read: blanks, the verb hints in brackets, stray markup. */
const BLANK = /_{2,}|[.…·]{2,}|-{4,}/gu

/** An exercise question as it should sound: gaps become a short pause and bracketed hints are dropped. */
export function speakableQuestion(q: string): string {
  return q
    .replace(/\([^()]*\)/gu, ' ')
    .replace(BLANK, ' , ')
    .replace(/\s+,/g, ',')
    .replace(/,\s*,/g, ',')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/^[,\s]+/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** The sentence with its gap filled in, ready to be read as the model answer. */
export function speakableAnswer(q: string, answer: string, say?: string): string {
  if (say?.trim()) return say.trim()
  const gap = /_{3,}/u.exec(q)
  if (!gap) return answer.trim()
  const filled = q.slice(0, gap.index) + ' ' + answer + ' ' + q.slice(gap.index + gap[0].length)
  return speakableQuestion(filled)
}

export interface Part {
  text: string
  lang: Lang
}

/** Sentences with a language each. With `forced` every sentence uses it; otherwise each is guessed from its own text. */
export function toParts(text: string, forced: Lang | 'auto', fallback: Lang = 'cs'): Part[] {
  const sentences = splitSentences(text)
  let previous: Lang = fallback
  return sentences.map((s) => {
    const lang = forced === 'auto' ? detectLang(s, previous) : forced
    previous = lang
    return { text: s, lang }
  })
}

/* ------------------------------------------------------------------------------------------
 * Browser layer: the Web Speech API
 * ---------------------------------------------------------------------------------------- */

export type SpeakResult = 'done' | 'cancelled' | 'unavailable' | 'error'

export interface SpeakOptions {
  rate?: number
  /** voiceURI or name of a voice picked by the learner; falls back to the best match. */
  voice?: string
  /** Called with the index of the part that is about to be read. */
  onPart?: (index: number) => void
}

const voices = ref<SpeechSynthesisVoice[]>([])
const supported = ref(false)
const speaking = ref(false)
const paused = ref(false)
/** Set when the last attempt to speak could not happen, so any screen can explain why. */
const problem = ref<{ lang: Lang; reason: 'no-voice' | 'error' | 'unsupported' } | null>(null)
const activeId = ref<string | null>(null)
let started = false
let token = 0

const synth = (): SpeechSynthesis | null =>
  typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window ? window.speechSynthesis : null

function refresh() {
  const s = synth()
  if (!s) return
  const list = s.getVoices()
  if (list.length) voices.value = list.slice()
}

/** Call once from a mounted component. Voices load late in some browsers, so this keeps listening. */
export function initSpeech() {
  const s = synth()
  if (!s) return
  supported.value = true
  refresh()
  if (started) return
  started = true
  s.addEventListener?.('voiceschanged', refresh)
  // Some browsers never fire the event; look a few more times.
  for (const ms of [250, 1000, 2500]) setTimeout(refresh, ms)
}

const tagOf = (v: SpeechSynthesisVoice) => v.lang.replace('_', '-').toLowerCase()
const isLang = (v: SpeechSynthesisVoice, lang: Lang) => tagOf(v) === lang || tagOf(v).startsWith(lang + '-')

/** Higher is better: natural-sounding voices first, then ones that work offline. */
function quality(v: SpeechSynthesisVoice, lang: Lang): number {
  let q = 0
  if (/natural|neural|online|premium|enhanced/i.test(v.name)) q += 4
  if (/google/i.test(v.name)) q += 2
  if (v.localService) q += 1
  if (lang === 'en' && tagOf(v).startsWith('en-gb')) q += 1
  return q
}

export function voicesFor(list: readonly SpeechSynthesisVoice[], lang: Lang): SpeechSynthesisVoice[] {
  return list
    .filter((v) => isLang(v, lang))
    .map((v, i) => ({ v, i }))
    .sort((a, b) => quality(b.v, lang) - quality(a.v, lang) || a.i - b.i)
    .map((x) => x.v)
}

export function pickVoice(list: readonly SpeechSynthesisVoice[], lang: Lang, preferred = ''): SpeechSynthesisVoice | null {
  if (preferred) {
    const chosen = list.find((v) => v.voiceURI === preferred || v.name === preferred)
    if (chosen && isLang(chosen, lang)) return chosen
  }
  return voicesFor(list, lang)[0] ?? null
}

export function useSpeech() {
  return {
    supported,
    voices,
    speaking,
    paused,
    problem,
    activeId,
    hasVoice: (lang: Lang) => voices.value.some((v) => isLang(v, lang)),
    voicesFor: (lang: Lang) => voicesFor(voices.value, lang),
    /** True when the browser can speak but has no Czech voice installed. */
    missingCzech: computed(() => supported.value && voices.value.length > 0 && !voices.value.some((v) => isLang(v, 'cs'))),
  }
}

export function stopSpeaking() {
  token += 1
  const s = synth()
  if (s) s.cancel()
  speaking.value = false
  paused.value = false
  activeId.value = null
}

export function clearSpeechProblem() {
  problem.value = null
}

export function pauseSpeaking() {
  if (!speaking.value) return
  synth()?.pause()
  paused.value = true
}
export function resumeSpeaking() {
  synth()?.resume()
  paused.value = false
}

function utter(part: Part, rate: number, voice: SpeechSynthesisVoice | null): Promise<'done' | 'error'> {
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(part.text)
    u.lang = voice?.lang ?? LANG_TAG[part.lang]
    if (voice) u.voice = voice
    u.rate = rate
    let settled = false
    const finish = (r: 'done' | 'error') => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(r)
    }
    // Some browsers never fire onend (no engine installed, a tab in the background). Do not hang forever.
    const timer = setTimeout(() => {
      synth()?.cancel()
      finish('error')
    }, (part.text.length / (8 * rate)) * 1000 + 6000)
    u.onend = () => finish('done')
    u.onerror = (e) => {
      const why = (e as SpeechSynthesisErrorEvent).error
      finish(why === 'interrupted' || why === 'canceled' ? 'done' : 'error')
    }
    synth()!.speak(u)
  })
}

export interface VoicePrefs {
  cs?: string
  en?: string
}

/**
 * Read parts aloud one after another. Starting a new reading stops the one in progress.
 * `id` lets a button show that it is the one currently playing.
 */
export async function speakParts(parts: Part[], opts: SpeakOptions & { id?: string; voices?: VoicePrefs } = {}): Promise<SpeakResult> {
  const s = synth()
  if (!s) {
    problem.value = { lang: parts[0]?.lang ?? 'cs', reason: 'unsupported' }
    return 'unavailable'
  }
  refresh()
  const mine = ++token
  s.cancel()
  paused.value = false
  const chunks = parts.flatMap((p, index) => chunkForSpeech(p.text).map((text) => ({ text, lang: p.lang, index })))
  if (!chunks.length) return 'done'

  // Once voices have loaded, never read a language with a voice for another one: it is worse than silence.
  if (voices.value.length) {
    for (const lang of new Set(chunks.map((c) => c.lang))) {
      if (!voices.value.some((v) => isLang(v, lang))) {
        problem.value = { lang, reason: 'no-voice' }
        return 'unavailable'
      }
    }
  }

  problem.value = null
  speaking.value = true
  activeId.value = opts.id ?? null
  const rate = Math.min(2, Math.max(0.4, opts.rate ?? 1))
  let result: SpeakResult = 'done'
  let lastIndex = -1
  for (const c of chunks) {
    if (mine !== token) return 'cancelled'
    if (c.index !== lastIndex) {
      lastIndex = c.index
      opts.onPart?.(c.index)
    }
    const voice = pickVoice(voices.value, c.lang, opts.voices?.[c.lang] ?? '')
    const outcome = await utter({ text: c.text, lang: c.lang }, rate, voice)
    if (mine !== token) return 'cancelled'
    if (outcome === 'error') {
      result = 'error'
      problem.value = { lang: c.lang, reason: 'error' }
      break
    }
  }
  if (mine !== token) return 'cancelled'
  speaking.value = false
  activeId.value = null
  paused.value = false
  return result
}

export function speak(text: string, lang: Lang, opts: SpeakOptions & { id?: string; voices?: VoicePrefs } = {}): Promise<SpeakResult> {
  return speakParts([{ text, lang }], opts)
}
