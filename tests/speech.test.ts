import { describe, expect, it } from 'vitest'
import { detectLang } from '../docs/.vitepress/theme/lib/lang'
import {
  chunkForSpeech,
  pickVoice,
  speakableAnswer,
  speakableQuestion,
  splitSentences,
  toParts,
  voicesFor,
} from '../docs/.vitepress/theme/lib/speech'

describe('detectLang', () => {
  it('recognises Czech by its letters', () => {
    expect(detectLang('Dobrý den, jak se máte?')).toBe('cs')
    expect(detectLang('Řeka')).toBe('cs')
  })
  it('recognises plain-ASCII Czech by common words', () => {
    expect(detectLang('Ahoj, jak se mas')).toBe('cs')
    expect(detectLang('Jdu domu')).toBe('cs')
    expect(detectLang('domu')).toBe('en') // no evidence: falls back
    expect(detectLang('domu', 'cs')).toBe('cs')
  })
  it('recognises English', () => {
    expect(detectLang('Where is the station?')).toBe('en')
    expect(detectLang('I live in Prague.')).toBe('en')
  })
  it('uses the fallback when there is no evidence', () => {
    expect(detectLang('', 'cs')).toBe('cs')
    expect(detectLang('Praha', 'cs')).toBe('cs')
    expect(detectLang('Praha', 'en')).toBe('en')
  })
})

describe('splitSentences', () => {
  it('splits on sentence ends and line breaks', () => {
    expect(splitSentences('Jdu domů. Ty taky? Ano!\nDobře.')).toEqual(['Jdu domů.', 'Ty taky?', 'Ano!', 'Dobře.'])
  })
  it('does not split after an ordinal number or an abbreviation', () => {
    expect(splitSentences('Přijedu 1. května. Např. v pondělí.')).toEqual(['Přijedu 1. května.', 'Např. v pondělí.'])
  })
  it('keeps a trailing piece with no punctuation', () => {
    expect(splitSentences('Dobrý den. Jak se máte')).toEqual(['Dobrý den.', 'Jak se máte'])
  })
  it('ignores blank lines', () => {
    expect(splitSentences('\n\n  \nAhoj\n\n')).toEqual(['Ahoj'])
  })
})

describe('chunkForSpeech', () => {
  it('leaves short sentences alone', () => {
    expect(chunkForSpeech('Jdu domů.')).toEqual(['Jdu domů.'])
  })
  it('breaks a long sentence at commas and never loses words', () => {
    const long = Array.from({ length: 40 }, (_, i) => `slovo${i}`).join(' ').replace(/(slovo\d*5) /g, '$1, ')
    const parts = chunkForSpeech(long, 80)
    expect(parts.length).toBeGreaterThan(2)
    expect(parts.every((p) => p.length <= 85)).toBe(true)
    expect(parts.join(' ').replace(/,/g, '').replace(/\s+/g, ' ')).toBe(long.replace(/,/g, '').replace(/\s+/g, ' '))
  })
  it('splits an unbroken string that has no spaces', () => {
    const parts = chunkForSpeech('x'.repeat(450), 200)
    expect(parts.join('')).toBe('x'.repeat(450))
  })
})

describe('speakableQuestion / speakableAnswer', () => {
  const q = '(já) Bohužel dnes nemůžu, ___ (jít – chodit) k lékaři.'
  it('turns the blank into a pause and drops bracketed hints', () => {
    expect(speakableQuestion(q)).toBe('Bohužel dnes nemůžu, k lékaři.')
  })
  it('handles the second blank of a two-gap sentence', () => {
    expect(speakableQuestion('Pane profesore ___ (jít – chodit) do školy pěšky nebo …… (jet – jezdit) autobusem?')).toBe(
      'Pane profesore, do školy pěšky nebo, autobusem?',
    )
  })
  it('fills the gap with the answer', () => {
    expect(speakableAnswer(q, 'jdu')).toBe('Bohužel dnes nemůžu, jdu k lékaři.')
  })
  it('prefers the full sentence from the workbook when there is one', () => {
    expect(speakableAnswer(q, 'jdu', 'Pane profesore chodíte do školy pěšky nebo jezdíte autobusem?')).toContain('jezdíte')
  })
  it('reads just the answer when the question has no gap', () => {
    expect(speakableAnswer('How are you?', 'Jak se máš?')).toBe('Jak se máš?')
  })
})

describe('toParts', () => {
  it('gives each sentence its own language in auto mode', () => {
    const parts = toParts('Dobrý den. Hello, how are you? Jdu domů.', 'auto')
    expect(parts.map((p) => p.lang)).toEqual(['cs', 'en', 'cs'])
  })
  it('lets a sentence with no evidence follow the one before', () => {
    const parts = toParts('Dobrý den. Praha.', 'auto')
    expect(parts.map((p) => p.lang)).toEqual(['cs', 'cs'])
  })
  it('forces one language when asked', () => {
    expect(toParts('Hello there. Dobrý den.', 'cs').map((p) => p.lang)).toEqual(['cs', 'cs'])
  })
})

describe('voice choice', () => {
  const v = (name: string, lang: string, local = true) => ({ name, lang, voiceURI: name, localService: local, default: false }) as SpeechSynthesisVoice
  const list = [
    v('Microsoft Jakub - Czech (Czechia)', 'cs-CZ'),
    v('Microsoft Vlasta Online (Natural) - Czech (Czechia)', 'cs-CZ', false),
    v('Samantha', 'en_US'),
    v('Daniel', 'en-GB'),
    v('Anna', 'de-DE'),
  ]
  it('finds voices by language, accepting underscores', () => {
    expect(voicesFor(list, 'cs')).toHaveLength(2)
    expect(voicesFor(list, 'en').map((x) => x.name)).toEqual(['Daniel', 'Samantha'])
    expect(voicesFor(list, 'cs').some((x) => x.lang.startsWith('de'))).toBe(false)
  })
  it('puts natural voices first', () => {
    expect(voicesFor(list, 'cs')[0].name).toContain('Natural')
  })
  it('honours the learner\'s choice but only for the right language', () => {
    expect(pickVoice(list, 'cs', 'Microsoft Jakub - Czech (Czechia)')?.name).toContain('Jakub')
    expect(pickVoice(list, 'cs', 'Daniel')?.name).toContain('Natural')
  })
  it('returns null when there is no voice for the language', () => {
    expect(pickVoice([v('Anna', 'de-DE')], 'cs')).toBeNull()
  })
})
