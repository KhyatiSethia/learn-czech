---
title: My own notes
---

# My own notes

This page is a template for the things you keep getting wrong. The notes are plain Markdown files, so you can edit them directly on GitHub or on your computer.

## How to add notes

1. Open `docs/grammar/my-notes.md` in the repository and edit it.
2. Commit the change. The site rebuilds automatically and your notes appear here.
3. Run the build locally with `npm run dev` to preview before you commit.

You can also add new pages. Create a file such as `docs/grammar/cafe-vocabulary.md`, add `{ text: 'Café vocabulary', link: '/grammar/cafe-vocabulary' }` to the grammar sidebar in `docs/.vitepress/config.ts`, and it shows up in the menu.

## A good structure

### Mistakes I make

| I said | Better | Why |
| --- | --- | --- |
| *Jsem byl doma.* | *Byl jsem doma.* | The auxiliary goes second, see [word order](/grammar/word-order). |
| *Chci učit se.* | *Chci se učit.* | *Se* moves to the second position. |

### Words I keep forgetting

| Czech | English | Memory trick |
| --- | --- | --- |
| *zapomenout* | to forget | |
| *vzpomenout si* | to remember | |

### Rules I want to remember

- After *do*, always the genitive.
- *Kdo* takes a masculine singular verb.

### Questions for my teacher

- When do I use *ten* and when *to*?

## Turn your notes into exercises

Your list of mistakes makes a good practice set. In [the exercises](/practice/), choose **Create exercises from a workbook** and paste them as one pair per line:

```
Fix the word order - Jsem byl doma. | Byl jsem doma.
Which case follows do? | genitive
```

The decks stay in your browser. Use *Export* to download a deck as a file, and copy it into `docs/decks/` in the repository if you want it to be built into the site for every device.
