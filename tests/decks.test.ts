import { describe, expect, it } from 'vitest'
import { builtinDecks } from '../docs/.vitepress/theme/lib/builtin'
import { gradeAnswer } from '../docs/.vitepress/theme/lib/text'
import { parseDeckText } from '../docs/.vitepress/theme/lib/parse'
import { readdirSync, readFileSync } from 'node:fs'

describe('bundled exercise sets', () => {
  it('loads every file in docs/decks', () => {
    const files = readdirSync('docs/decks').filter((f) => /\.(txt|csv|tsv)$/.test(f))
    expect(builtinDecks).toHaveLength(files.length)
  })

  it('parses without skipped rows and has enough questions to play', () => {
    for (const f of readdirSync('docs/decks')) {
      const parsed = parseDeckText(readFileSync(`docs/decks/${f}`, 'utf8'))
      expect(parsed.skipped, f).toEqual([])
      expect(parsed.items.length, f).toBeGreaterThanOrEqual(8)
      expect(parsed.title, f).toBeTruthy()
    }
  })

  it('accepts the canonical answer of every question', () => {
    for (const d of builtinDecks) {
      for (const it of d.items) {
        for (const a of it.a) expect(gradeAnswer(a, it.a, { strict: true }).verdict, `${d.title}: ${it.q}`).toBe('correct')
      }
    }
  })

  it('has no duplicate questions inside a set', () => {
    for (const d of builtinDecks) {
      const qs = d.items.map((i) => i.q)
      expect(new Set(qs).size, d.title).toBe(qs.length)
    }
  })
})
