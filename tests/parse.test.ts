import { describe, expect, it } from 'vitest'
import { parseDeckText, serializeItems, splitAlternatives } from '../docs/.vitepress/theme/lib/parse'

describe('parseDeckText', () => {
  it('reads rows pasted from a spreadsheet (tab separated)', () => {
    const r = parseDeckText('Hello\tAhoj\nThank you\tDěkuji\tformal-ish')
    expect(r.delimiter).toBe('tab')
    expect(r.items.map((i) => [i.q, i.a[0], i.hint])).toEqual([
      ['Hello', 'Ahoj', undefined],
      ['Thank you', 'Děkuji', 'formal-ish'],
    ])
  })

  it('reads pipe and arrow formats', () => {
    expect(parseDeckText('Yes | Ano\nNo | Ne').items).toHaveLength(2)
    expect(parseDeckText('Yes => Ano\nNo => Ne').delimiter).toBe('arrow')
  })

  it('reads semicolon CSV exported by a Czech-locale spreadsheet', () => {
    const r = parseDeckText('question;answer\nHow are you?;Jak se máš?\nGood night;Dobrou noc')
    expect(r.delimiter).toBe('semicolon')
    expect(r.header).toBe(true)
    expect(r.items.map((i) => i.a[0])).toEqual(['Jak se máš?', 'Dobrou noc'])
  })

  it('handles quoted comma CSV where answers contain commas', () => {
    const r = parseDeckText('"Hello, friend","Ahoj, kamaráde"\n"Bye","Nashledanou"')
    expect(r.delimiter).toBe('comma')
    expect(r.items[0]).toMatchObject({ q: 'Hello, friend', a: ['Ahoj, kamaráde'] })
  })

  it('treats doubled quotes inside quoted fields as a literal quote', () => {
    const r = parseDeckText('"Say ""hi""",Ahoj\nBye,Ahoj')
    expect(r.items[0].q).toBe('Say "hi"')
  })

  it('uses header names to find a hint column', () => {
    const r = parseDeckText('english,czech,hint\nCat,Kočka,feminine')
    expect(r.header).toBe(true)
    expect(r.items[0]).toMatchObject({ q: 'Cat', a: ['Kočka'], hint: 'feminine' })
  })

  it('splits alternatives only on a slash with spaces around it', () => {
    expect(splitAlternatives('Děkuji / Děkuju / Díky')).toEqual(['Děkuji', 'Děkuju', 'Díky'])
    expect(splitAlternatives('on/ona')).toEqual(['on/ona'])
  })

  it('reports rows it cannot use and keeps going', () => {
    const r = parseDeckText('One | Jedna\njust a question | \n | answer only\nTwo | Dvě')
    expect(r.items).toHaveLength(2)
    expect(r.skipped).toHaveLength(2)
    expect(r.skipped[0].line).toBe(2)
  })

  it('asks for a separator when none is found', () => {
    const r = parseDeckText('no separator here\nor here')
    expect(r.items).toHaveLength(0)
    expect(r.skipped[0].reason).toMatch(/separator/i)
  })

  it('applies a chosen delimiter instead of guessing', () => {
    const r = parseDeckText('Hello, there; Ahoj', 'semicolon')
    expect(r.items[0]).toMatchObject({ q: 'Hello, there', a: ['Ahoj'] })
  })

  it('reads title and description comments and ignores other comments', () => {
    const r = parseDeckText('# title: Greetings\n# description: Basics\n# just a note\nHi | Ahoj')
    expect(r).toMatchObject({ title: 'Greetings', description: 'Basics' })
    expect(r.items).toHaveLength(1)
  })

  it('strips a byte-order mark and Windows line endings', () => {
    const r = parseDeckText('﻿Hi | Ahoj\r\nBye | Čau\r\n')
    expect(r.items.map((i) => i.q)).toEqual(['Hi', 'Bye'])
  })

  it('removes exact duplicates', () => {
    expect(parseDeckText('Hi | Ahoj\nHi | Ahoj').items).toHaveLength(1)
  })

  it('accepts JSON in a few shapes', () => {
    expect(parseDeckText('[{"question":"Hi","answer":"Ahoj"}]').items[0].a).toEqual(['Ahoj'])
    expect(parseDeckText('[["Hi","Ahoj","informal"]]').items[0].hint).toBe('informal')
    const deck = parseDeckText('{"title":"T","items":[{"q":"Hi","a":"Ahoj / Čau"}]}')
    expect(deck.title).toBe('T')
    expect(deck.items[0].a).toEqual(['Ahoj', 'Čau'])
  })

  it('gives the same id to the same question and answer', () => {
    expect(parseDeckText('Hi | Ahoj').items[0].id).toBe(parseDeckText('Hi\tAhoj').items[0].id)
  })

  it('round-trips through serializeItems, including tabs and quotes in fields', () => {
    const src = parseDeckText('Say "hi" | Ahoj / Čau | informal\nPlain | Obyčejné')
    const again = parseDeckText(serializeItems(src.items))
    expect(again.items).toEqual(src.items)
  })
})
