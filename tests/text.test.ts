import { describe, expect, it } from 'vitest'
import { gradeAnswer, levenshtein, markSegments, normalize, stripDiacritics } from '../docs/.vitepress/theme/lib/text'

describe('normalize / stripDiacritics', () => {
  it('ignores case, punctuation and extra spaces', () => {
    expect(normalize('  Dobrý   DEN!  ')).toBe('dobrý den')
    expect(normalize('Jak se máš?')).toBe('jak se máš')
  })
  it('keeps diacritics in normalize but removes them in stripDiacritics', () => {
    expect(normalize('Řeka')).toBe('řeka')
    expect(stripDiacritics('Příliš žluťoučký kůň')).toBe('Prilis zlutoucky kun')
  })
  it('handles decomposed input the same as composed input', () => {
    expect(normalize('česky')).toBe(normalize('česky'))
  })
})

describe('levenshtein', () => {
  it('counts edits', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3)
    expect(levenshtein('', 'abc')).toBe(3)
    expect(levenshtein('abc', 'abc')).toBe(0)
  })
})

describe('gradeAnswer', () => {
  it('accepts an exact answer regardless of case and punctuation', () => {
    expect(gradeAnswer('dobrý den.', ['Dobrý den']).verdict).toBe('correct')
  })
  it('accepts any listed alternative', () => {
    const g = gradeAnswer('ahoj', ['Dobrý den', 'Ahoj'])
    expect(g.verdict).toBe('correct')
    expect(g.expected).toBe('Ahoj')
  })
  it('treats missing diacritics as almost, not wrong', () => {
    const g = gradeAnswer('dekuji', ['Děkuji'])
    expect(g).toMatchObject({ verdict: 'almost', reason: 'diacritics', expected: 'Děkuji' })
  })
  it('fails missing diacritics in strict mode and says why', () => {
    expect(gradeAnswer('dekuji', ['Děkuji'], { strict: true })).toMatchObject({ verdict: 'wrong', reason: 'diacritics' })
  })
  it('forgives a single typo in longer answers only', () => {
    expect(gradeAnswer('Bydlim v Prase', ['Bydlím v Praze']).verdict).toBe('almost')
    expect(gradeAnswer('je', ['jsi']).verdict).toBe('wrong')
    expect(gradeAnswer('jsme', ['jsem']).verdict).toBe('wrong') // short words: no typo leniency
  })
  it('rejects wrong and empty answers and reports the closest accepted answer', () => {
    expect(gradeAnswer('', ['ano']).verdict).toBe('wrong')
    const g = gradeAnswer('pivo', ['voda', 'pivo se šťávou'])
    expect(g.verdict).toBe('wrong')
  })
  it('does not use typo leniency in strict mode', () => {
    expect(gradeAnswer('Bydlím v Prase', ['Bydlím v Praze'], { strict: true }).verdict).toBe('wrong')
  })
})

describe('markSegments', () => {
  it('flags letters that carry marks', () => {
    const segs = markSegments('řeka')
    expect(segs.map((s) => s.dia)).toEqual([true, false, false, false])
  })
  it('flags differing characters when lengths match', () => {
    const segs = markSegments('děkuji', 'dekuji')
    expect(segs.filter((s) => s.off).map((s) => s.t)).toEqual(['ě'])
  })
  it('does not flag anything when lengths differ', () => {
    expect(markSegments('děkuji', 'dekuj').some((s) => s.off)).toBe(false)
  })
})
