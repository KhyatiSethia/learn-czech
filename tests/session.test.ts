import { describe, expect, it } from 'vitest'
import { parseDeckText } from '../docs/.vitepress/theme/lib/parse'
import { Session, buildChallenge, buildTiles, distractorsFor, hintFor, pickItems } from '../docs/.vitepress/theme/lib/session'

const deck = parseDeckText(`
I live in Prague. | Bydlím v Praze.
We are going to the cinema. | Jdeme do kina.
She has a big dog. | Má velkého psa.
Thank you | Děkuji / Děkuju
Good night | Dobrou noc
Yes | Ano
`).items

// A deterministic rng (mulberry32) so tests do not flake.
function seeded(seed = 7) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('buildChallenge', () => {
  it('never offers the right answer (or an accepted alternative) as a distractor', () => {
    const thanks = deck.find((d) => d.q === 'Thank you')!
    for (let i = 0; i < 30; i++) {
      const d = distractorsFor(thanks, deck, 3, seeded(i + 1))
      expect(d).not.toContain('Děkuji')
      expect(d).not.toContain('Děkuju')
    }
  })

  it('builds a sentence from tiles including the right words and a distractor for long sentences', () => {
    const item = deck.find((d) => d.q === 'We are going to the cinema.')!
    const tiles = buildTiles(item, deck, seeded(3))
    const texts = tiles.map((t) => t.text)
    for (const w of ['Jdeme', 'do', 'kina']) expect(texts).toContain(w)
    expect(texts.length).toBeGreaterThanOrEqual(3)
    expect(new Set(tiles.map((t) => t.id)).size).toBe(tiles.length)
  })

  it('falls back to typing for single words in tiles mode', () => {
    const yes = deck.find((d) => d.q === 'Yes')!
    expect(buildChallenge(yes, deck, 'tiles', 0, seeded()).kind).toBe('type')
  })

  it('gives multiple choice with the correct answer included', () => {
    const night = deck.find((d) => d.q === 'Good night')!
    const ch = buildChallenge(night, deck, 'choice', 0, seeded())
    expect(ch.kind).toBe('choice')
    expect(ch.options).toContain('Dobrou noc')
    expect(new Set(ch.options).size).toBe(ch.options!.length)
  })

  it('cannot offer choices when the deck is too small to make distractors', () => {
    const tiny = deck.slice(0, 2)
    expect(buildChallenge(tiny[0], tiny, 'choice', 0, seeded()).kind).toBe('type')
  })
})

describe('Session', () => {
  const opts = { mode: 'type' as const, hearts: false, strict: false }

  it('finishes a perfect run with three stars and a growing streak bonus', () => {
    const s = new Session(deck, deck, opts, seeded())
    let guard = 0
    while (!s.finished && guard++ < 50) {
      const r = s.submit(s.current!.item.a[0])
      expect(r.verdict).toBe('correct')
    }
    const sum = s.summary()
    expect(sum).toMatchObject({ total: 6, firstTry: 6, stars: 3, bestStreak: 6, failed: false })
    expect(sum.xp).toBeGreaterThan(60) // base 10 each plus streak bonus
    expect(s.progress).toBe(1)
  })

  it('puts a missed item back a couple of questions later and counts it as missed', () => {
    const s = new Session(deck, deck, opts, seeded())
    const first = s.current!.item
    const r = s.submit('totally wrong')
    expect(r.verdict).toBe('wrong')
    expect(s.streak).toBe(0)
    expect(s.queue.length).toBe(deck.length) // one removed, one retry added
    expect(s.queue[2].item.id).toBe(first.id)
    expect(s.queue[2].attempt).toBe(1)
    expect(s.missed.map((m) => m.id)).toContain(first.id)
    expect(s.progress).toBe(0)
  })

  it('retires an item after repeated misses so the run always ends', () => {
    const one = deck.slice(0, 1)
    const s = new Session(one, deck, opts, seeded())
    let n = 0
    while (!s.finished && n++ < 10) s.submit('nope')
    expect(s.finished).toBe(true)
    expect(n).toBe(3) // first try + two retries
    expect(s.summary().missed).toHaveLength(1)
    expect(s.summary().firstTry).toBe(0)
  })

  it('gives reduced XP for "almost" answers and for retries and hints', () => {
    const s = new Session(deck.slice(3, 4), deck, opts, seeded())
    const r = s.submit('dekuji') // missing diacritics → almost
    expect(r.verdict).toBe('almost')
    expect(r.xp).toBe(6)

    const s2 = new Session(deck.slice(4, 5), deck, opts, seeded())
    expect(s2.submit('Dobrou noc', true).xp).toBe(5) // hint halves base XP
  })

  it('ends the run when hearts mode loses all three lives', () => {
    const s = new Session(deck, deck, { ...opts, hearts: true }, seeded())
    s.submit('x')
    s.submit('x')
    const last = s.submit('x')
    expect(s.lives).toBe(0)
    expect(last.failed).toBe(true)
    expect(s.finished).toBe(true)
    expect(s.summary().stars).toBe(0)
  })

  it('is strict about diacritics only when asked', () => {
    const strict = new Session(deck.slice(3, 4), deck, { ...opts, strict: true }, seeded())
    expect(strict.submit('dekuji').verdict).toBe('wrong')
  })

  it('grades choice and tile answers exactly', () => {
    const s = new Session(deck.slice(1, 2), deck, { ...opts, mode: 'tiles' }, seeded())
    expect(s.current!.kind).toBe('tiles')
    expect(s.submit(['Jdeme', 'do', 'kina']).verdict).toBe('correct')
    const s2 = new Session(deck.slice(1, 2), deck, { ...opts, mode: 'tiles' }, seeded())
    expect(s2.submit(['do', 'Jdeme', 'kina']).verdict).toBe('wrong')
  })

  it('throws if asked to answer when nothing is left', () => {
    const s = new Session(deck.slice(0, 1), deck, opts, seeded())
    s.submit(deck[0].a[0])
    expect(() => s.submit('x')).toThrow()
  })
})

describe('pickItems', () => {
  it('prefers items the learner has not mastered', () => {
    const boxes = Object.fromEntries(deck.map((d) => [d.id, 3]))
    boxes[deck[0].id] = 0
    let hits = 0
    for (let i = 0; i < 200; i++) {
      if (pickItems(deck, boxes, 1, seeded(i + 1))[0].id === deck[0].id) hits++
    }
    // weight 4 vs 5 × weight 1 → about 44% when picking one item; clearly above the 1/6 chance level
    expect(hits).toBeGreaterThan(200 * 0.3)
  })
  it('returns at most the number of items available', () => {
    expect(pickItems(deck, {}, 99)).toHaveLength(deck.length)
  })
})

describe('hintFor', () => {
  it('uses the author hint when present and the answer shape otherwise', () => {
    expect(hintFor({ id: '1', q: 'q', a: ['Dobrou noc'], hint: 'evening' })).toBe('evening')
    expect(hintFor({ id: '1', q: 'q', a: ['Dobrou noc'] })).toBe('D·····  n··')
  })
})
