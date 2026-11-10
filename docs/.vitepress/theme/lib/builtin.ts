import { parseDeckText } from './parse'
import type { Deck } from './types'

// Every file in docs/decks becomes a ready-made exercise set. Same format as the importer.
const files = import.meta.glob('../../../decks/*.{txt,csv,tsv}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

function prettify(name: string): string {
  const t = name.replace(/^\d+[-_ ]*/, '').replace(/[-_]+/g, ' ').trim()
  return t ? t[0].toUpperCase() + t.slice(1) : name
}

export const builtinDecks: Deck[] = Object.entries(files)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([path, raw]) => {
    const name = path.split('/').pop()!.replace(/\.[^.]+$/, '')
    const parsed = parseDeckText(raw)
    return {
      id: `builtin:${name}`,
      title: parsed.title ?? prettify(name),
      description: parsed.description,
      items: parsed.items,
      source: 'builtin' as const,
    }
  })
  .filter((d) => d.items.length > 0)
