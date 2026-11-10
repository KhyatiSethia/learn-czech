import { describe, expect, it } from 'vitest'
import { parseWorkbook } from '../docs/.vitepress/theme/lib/workbook'

const EXERCISE =
  'Pracujte podle vzoru. Vzor: (já) Každé ráno …piju… (pít) kávu v kuchyni. ' +
  'a) (ty) Kam ................................ (jít – chodit) večer s kamarády? ' +
  'b) (my) V létě často ................................ (jet – jezdit) k moři. ' +
  'c) (já) Bohužel dnes nemůžu, ................................ (jít – chodit) k lékaři. ' +
  'd) Za týden chtějí ................................ (jet – jezdit) na hory do Rakouska. ' +
  'e) Moje sestra ................................ (jít – chodit) každé úterý plavat. ' +
  'f) Zítra ráno ......... ....................... (jet – jezdit) Eva a Tomáš do Brna. ' +
  'g) Proč dnes ................................ (nejít – nechodit) Lucie na přednášku? ' +
  'h) Jak často ................................ (jet – jezdit) váš strýc na návštěvu? ' +
  'i) Za čtvrt hodiny musím ................................ (jít – chodit) domů, bolí mě hlava. ' +
  'j) Ty také ................................ (nejet – nejezdit) tento víkend na chatu? To je škoda. ' +
  'k) Bojím se. Za hodinu ................................ (jít – chodit) na zkoušku z matematiky. ' +
  'l) Pane profesore ................................ (jít – chodit) do školy pěšky nebo ................................ (jet – jezdit) autobusem?'

const KEY = '* a) chodíš, b) jezdíme, c) jdu, d) jet, e) chodí, f) jedou, g) nejde, h) jezdí, i) jít, j) nejedeš, k) jdu, l) chodíte, jezdíte'

describe('workbook parser: the real example', () => {
  const r = parseWorkbook(`${EXERCISE}\n\n${KEY}`)

  it('finds a title and the instruction', () => {
    expect(r.title).toBe('Pracujte podle vzoru')
    expect(r.description).toContain('Vzor')
  })

  it('makes 13 items (item l has two blanks)', () => {
    expect(r.warnings).toEqual([])
    expect(r.items).toHaveLength(13)
    expect(r.stats.questions).toBe(12)
    expect(r.stats.keyFound).toBe(true)
  })

  it('does not treat the vzor line as an item', () => {
    expect(r.items.some((i) => i.q.includes('Každé ráno'))).toBe(false)
  })

  it('maps each answer to the right sentence', () => {
    const by = (needle: string) => r.items.filter((i) => i.q.includes(needle))
    expect(by('Kam')[0].a).toEqual(['chodíš'])
    expect(by('V létě')[0].a).toEqual(['jezdíme'])
    expect(by('Bohužel')[0].a).toEqual(['jdu'])
    expect(by('Za týden')[0].a).toEqual(['jet'])
    expect(by('Zítra ráno')[0].a).toEqual(['jedou'])
    expect(by('Proč dnes')[0].a).toEqual(['nejde'])
    expect(by('Ty také')[0].a).toEqual(['nejedeš'])
    expect(by('Za hodinu')[0].a).toEqual(['jdu'])
  })

  it('keeps the sentence with a single blank marker and the verb hint', () => {
    const c = r.items.find((i) => i.q.includes('Bohužel'))!
    expect(c.q).toBe('(já) Bohužel dnes nemůžu, ___ (jít – chodit) k lékaři.')
    const f = r.items.find((i) => i.q.includes('Zítra ráno'))!
    expect(f.q).toBe('Zítra ráno ___ (jet – jezdit) Eva a Tomáš do Brna.')
  })

  it('splits item l into two questions, one blank each', () => {
    const l = r.items.filter((i) => i.q.startsWith('Pane profesore'))
    expect(l).toHaveLength(2)
    expect(l[0].q).toBe('Pane profesore ___ (jít – chodit) do školy pěšky nebo …… (jet – jezdit) autobusem?')
    expect(l[0].a).toEqual(['chodíte'])
    expect(l[1].q).toBe('Pane profesore …… (jít – chodit) do školy pěšky nebo ___ (jet – jezdit) autobusem?')
    expect(l[1].a).toEqual(['jezdíte'])
  })

  it('puts the jít/chodit and jet/jezdit questions in two groups, negatives with their positives', () => {
    const g = (needle: string) => r.items.find((i) => i.q.includes(needle))!.group
    expect(g('Kam')).toBeTruthy()
    expect(g('Kam')).toBe(g('Bohužel'))
    expect(g('Kam')).toBe(g('Proč dnes'))
    expect(g('V létě')).toBe(g('Za týden'))
    expect(g('V létě')).toBe(g('Ty také'))
    expect(g('Kam')).not.toBe(g('V létě'))
  })

  it('counts 12 gap questions', () => {
    expect(r.stats.gaps).toBe(12)
  })

  it('gives every item a unique id', () => {
    expect(new Set(r.items.map((i) => i.id)).size).toBe(r.items.length)
  })
})

describe('workbook parser: layouts', () => {
  it('reads numbered questions on separate lines with a "Klíč:" answer line', () => {
    const r = parseWorkbook(
      ['Doplňte slovesa.', '1. Já ........ (být) doma.', '2. Ty ........ (mít) čas?', '3. Oni ........ (být) v Praze.', '', 'Klíč: 1. jsem 2. máš 3. jsou'].join('\n'),
    )
    expect(r.warnings).toEqual([])
    expect(r.items.map((i) => i.a[0])).toEqual(['jsem', 'máš', 'jsou'])
    expect(r.items[0].q).toBe('Já ___ (být) doma.')
    expect(r.title).toBe('Doplňte slovesa')
  })

  it('reads (1) (2) numbering', () => {
    const r = parseWorkbook('(1) Mám ........ pivo. (2) Dám si ........ kávu. (3) Vidím ........ psa.\n\n* (1) rád (2) jednu (3) velkého')
    expect(r.items).toHaveLength(3)
    expect(r.items[1].a).toEqual(['jednu'])
  })

  it('uses a separate answer text when one is given', () => {
    const r = parseWorkbook('a) Dnes ...... (jít – chodit) do kina.\nb) Včera ...... (jít – chodit) do divadla.', 'a) jdu b) šel jsem')
    expect(r.warnings).toEqual([])
    expect(r.items.map((i) => i.a[0])).toEqual(['jdu', 'šel jsem'])
  })

  it('accepts a bare answer list in the separate box, one per line', () => {
    const r = parseWorkbook('1. Dnes ...... do kina.\n2. Včera ...... do divadla.\n3. Zítra ...... na výlet.', '1. jdu\n2. šel jsem\n3. pojedu')
    expect(r.items.map((i) => i.a[0])).toEqual(['jdu', 'šel jsem', 'pojedu'])
  })

  it('works with a key that restarts the numbering and no marker', () => {
    const r = parseWorkbook('1. Já ...... doma.\n2. Ty ...... doma.\n3. On ...... doma.\n1. jsem\n2. jsi\n3. je')
    expect(r.items.map((i) => i.a[0])).toEqual(['jsem', 'jsi', 'je'])
  })

  it('takes several accepted answers separated by a slash', () => {
    const r = parseWorkbook('a) Chci ...... kávu.\nb) Mám ...... knihu.\n\n* a) jednu / jednu malou, b) novou')
    expect(r.items[0].a).toEqual(['jednu', 'jednu malou'])
  })

  it('handles questions that are not gap fills', () => {
    const r = parseWorkbook('1. Jak se jmenuješ?\n2. Odkud jsi?\n3. Kolik je ti let?\n\nKlíč: 1. Jmenuju se Jana. 2. Jsem z Indie. 3. Je mi dvacet pět.')
    expect(r.items).toHaveLength(3)
    expect(r.items[0].q).toBe('Jak se jmenuješ?')
    expect(r.items[0].a).toEqual(['Jmenuju se Jana.'])
    expect(r.stats.gaps).toBe(0)
  })

  it('does not take "Cvičení 3." or a lone number for an item label', () => {
    const r = parseWorkbook('Cvičení 3. Doplňte.\n1. Já ...... doma.\n2. Ty ...... doma.\n\n* 1. jsem 2. jsi')
    expect(r.items).toHaveLength(2)
    expect(r.title).toBe('Cvičení 3')
  })

  it('does not split on a), b) inside a sentence (an abbreviation like "tzn." or "např.")', () => {
    const r = parseWorkbook('a) Např. já ...... doma.\nb) Ty ...... v práci.\n\n* a) jsem, b) jsi')
    expect(r.items).toHaveLength(2)
  })
})

describe('workbook parser: choices and multiple blanks', () => {
  it('keeps the choices when each item lists 1), 2), 3) options', () => {
    const r = parseWorkbook(
      'a) Dnes ...... do kina. 1) jdu 2) jedu 3) chodím\nb) Včera ...... do Prahy. 1) šel 2) jel 3) jede\n\n* a) 1, b) 2',
    )
    expect(r.warnings).toEqual([])
    expect(r.items).toHaveLength(2)
    expect(r.items[0].options).toEqual(['jdu', 'jedu', 'chodím'])
    expect(r.items[0].a).toEqual(['jdu'])
    expect(r.items[1].a).toEqual(['jel'])
  })

  it('splits one item with two blanks into two questions', () => {
    const r = parseWorkbook('a) Já ...... a ty ...... (být) doma.\nb) My ...... (mít) čas.\n\n* a) jsem, jsi b) máme')
    expect(r.items).toHaveLength(3)
    expect(r.items[0].a).toEqual(['jsem'])
    expect(r.items[1].a).toEqual(['jsi'])
    expect(r.items[2].a).toEqual(['máme'])
  })

  it('reports when the key has the wrong number of parts for a multi-blank item', () => {
    const r = parseWorkbook('a) Já ...... a ty ...... doma.\nb) My ...... čas.\n\n* a) jsem b) máme')
    expect(r.items.map((i) => i.a[0])).toEqual(['máme'])
    expect(r.warnings.some((w) => w.includes('a)'))).toBe(true)
  })
})

describe('workbook parser: problems are reported, not swallowed', () => {
  it('warns when there is no answer key', () => {
    const r = parseWorkbook('a) Já ...... doma.\nb) Ty ...... doma.')
    expect(r.items).toHaveLength(0)
    expect(r.stats.keyFound).toBe(false)
    expect(r.warnings.join(' ')).toMatch(/answer key/i)
  })

  it('warns when an answer is missing', () => {
    const r = parseWorkbook('a) Já ...... doma.\nb) Ty ...... doma.\nc) On ...... doma.\n\n* a) jsem, c) je')
    expect(r.items).toHaveLength(2)
    expect(r.warnings.some((w) => w.includes('b'))).toBe(true)
  })

  it('returns nothing for empty text', () => {
    expect(parseWorkbook('   ').items).toEqual([])
  })
})

describe('workbook parser: messy pastes', () => {
  it('copes with line breaks and extra spaces from a PDF, and a "Řešení:" heading', () => {
    const r = parseWorkbook(
      [
        'Cvičení 5   Doplňte správný tvar.',
        'a)  Dnes večer  ........................',
        '    (jít – chodit)  do kina.',
        'b) Každý den   ................   (jet – jezdit) do práce.',
        'c) Teď ........ (jít) domů.',
        '',
        'Řešení:',
        'a) jdu',
        'b) jezdím',
        'c) jdu',
      ].join('\n'),
    )
    expect(r.warnings).toEqual([])
    expect(r.items).toHaveLength(3)
    expect(r.items[0].q).toBe('Dnes večer ___ (jít – chodit) do kina.')
    expect(r.items.map((i) => i.a[0])).toEqual(['jdu', 'jezdím', 'jdu'])
  })

  it('accepts "1b 2a 3c" style keys for choice exercises', () => {
    const r = parseWorkbook(
      '1. Dnes ...... do kina. a) jdu b) jedu c) jezdím\n2. Včera ...... do Prahy. a) šel b) jel c) jede\n3. Zítra ...... pěšky. a) půjdu b) pojedu c) chodím\n\nKlíč: 1a 2b 3a',
    )
    expect(r.warnings).toEqual([])
    expect(r.items).toHaveLength(3)
    expect(r.items.map((i) => i.a[0])).toEqual(['jdu', 'jel', 'půjdu'])
    expect(r.items[2].options).toEqual(['půjdu', 'pojedu', 'chodím'])
  })

  it('handles uppercase letters and "A." labels', () => {
    const r = parseWorkbook('A. Já ...... doma.\nB. Ty ...... doma.\nC. On ...... doma.\n\nKlíč: A. jsem B. jsi C. je')
    expect(r.items.map((i) => i.a[0])).toEqual(['jsem', 'jsi', 'je'])
  })

  it('reads unlabelled lines paired with an answer paragraph', () => {
    const r = parseWorkbook('Dnes ...... do kina.\nVčera ...... do divadla.\nZítra ...... na výlet.\n\njdu\nšel jsem\npojedu')
    expect(r.items).toHaveLength(3)
    expect(r.items[1].q).toBe('Včera ___ do divadla.')
    expect(r.items[1].a).toEqual(['šel jsem'])
  })

  it('keeps a comma that belongs to a one-blank answer', () => {
    const r = parseWorkbook('a) ...... , to je dobře.\nb) Já ...... doma.\n\n* a) Ano, jdu b) jsem')
    expect(r.items[0].a).toEqual(['Ano, jdu'])
  })

  it('treats a key pasted in the second box as the key even if the first box repeats the numbering', () => {
    const r = parseWorkbook('1. Já ...... doma.\n2. Ty ...... doma.', '1. jsem\n2. jsi')
    expect(r.items.map((i) => i.a[0])).toEqual(['jsem', 'jsi'])
  })
})

describe('workbook parser: sentences for audio', () => {
  const r = parseWorkbook(`${EXERCISE}\n\n${KEY}`)
  it('stores the whole sentence, blanks filled and hints removed', () => {
    const c = r.items.find((i) => i.q.includes('Bohužel'))!
    expect(c.say).toBe('Bohužel dnes nemůžu, jdu k lékaři.')
  })
  it('fills both blanks of the two-gap item in both of its questions', () => {
    const l = r.items.filter((i) => i.q.startsWith('Pane profesore'))
    expect(l[0].say).toBe('Pane profesore chodíte do školy pěšky nebo jezdíte autobusem?')
    expect(l[1].say).toBe(l[0].say)
  })
})

describe('the importer example', () => {
  it('parses cleanly into 7 questions', async () => {
    const { WORKBOOK_EXAMPLE } = await import('../docs/.vitepress/theme/lib/workbook')
    const r = parseWorkbook(WORKBOOK_EXAMPLE)
    expect(r.warnings).toEqual([])
    expect(r.stats.questions).toBe(6)
    expect(r.items).toHaveLength(7)
    expect(r.title).toBe('Doplňte správný tvar')
    expect(r.items.find((i) => i.q.startsWith('Moji rodiče') && i.q.includes('___ (jít'))?.a).toEqual(['jdu'])
  })
})
