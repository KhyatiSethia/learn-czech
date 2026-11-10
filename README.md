# Česky: learn Czech

A small website for learning Czech, built with [VitePress](https://vitepress.dev) and deployed to GitHub Pages.

- **Grammar notes** in `docs/grammar/`: 19 short pages from pronunciation and the seven cases to aspect, the conditional and spoken Czech.
- **Exercises** that feel more like a game than a workbook. Paste an exercise and its answer key straight from your workbook, press a button, and answer by tapping: pick the right form, or build the sentence from word tiles. Typing is optional. Missed questions come back a few turns later; you earn XP, a day streak and up to three stars per set.
- **Audio** on every question and answer, plus a **Listen** page where you paste any Czech or English text and hear it read aloud, sentence by sentence. The voices come from your browser and device, so it needs no server and no key.
- **A tutor chat** that explains Czech in English and runs offline: a small language model in your browser (WebLLM, WebGPU) or, if you prefer, your own [Ollama](https://ollama.com).
- **Works offline** after the first visit (service worker), and installs as an app on phones and laptops.

## Run it locally

You need Node 22 or newer.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests for parsing, grading, speech helpers and the exercise engine
npm run build    # static site in docs/.vitepress/dist
```

## Put it online with GitHub Pages

1. Create a **public** repository on GitHub (Pages is free for public repositories) and push this folder to its `main` branch.
2. In the repository open **Settings → Pages** and set **Source** to **GitHub Actions**.
3. The workflow in `.github/workflows/deploy.yml` runs the tests, builds the site and publishes it at `https://<user>.github.io/<repo>/`.

The base path is worked out from the repository name. For a custom domain or a `<user>.github.io` repository, build with `BASE=/`.

## Add your own exercises

**In the browser:** open *Practice* and choose **Create exercises from a workbook**. There are two ways to paste:

- **A workbook exercise.** Copy the numbered sentences and the answer key, exactly as printed, into the first box. Questions can be labelled `a) b) c)`, `1. 2. 3.`, `1) 2) 3)` or `(1) (2) (3)`, on one line or many. Blanks can be dots, underscores or `…`. The key can follow the exercise (start it with `*`, `Klíč:` or `Řešení:`, or restart the numbering) or go in the second box. A sentence with two blanks needs two answers and becomes two questions. Multiple-choice items (`a) b) c)` after a numbered question, key like `1b 2a 3c`) keep the book's choices.
- **Question and answer rows** from Excel, Numbers or Google Sheets (or a CSV), as described below.

Sets are saved in that browser's local storage. *Edit* shows exactly what you pasted. *Export* downloads a set as a file.

In pick-one questions the wrong options come from the same verb pair or group as the right answer (for example other forms of *jít / chodit*), so they are tempting, not obvious. Switch off *Pick, never type* in the setup dialog to practise typing again.

**Audio.** The speaker buttons use the browser's speech engine, so Czech needs a Czech voice on the device. Microsoft Edge has natural online Czech voices with no setup; the *Listen* page explains how to add one on Windows, Mac, iPhone, Android and Linux.

**In the repository:** put a `.txt`, `.csv` or `.tsv` file in `docs/decks/`. Every set there ships with the site for everyone.

```text
# title: Unit 4
# description: Food and drink
Thank you | Děkuji / Děkuju
I'd like a coffee. | Dal bych si kávu. / Dala bych si kávu.
Jsem z ___. (Německo) | Německa | genitive, after z
```

- Column one is the question, column two the answer, column three an optional hint.
- Separate accepted answers with ` / `.
- Put `___` in the question to make a fill-in-the-gap exercise.
- Answers of three or more words also become sentence-building puzzles.
- The separator (`|`, tab, `;`, `,`, `=>` or `::`) is detected automatically. Czech text from an old Windows CSV (Windows-1250) is converted for you.

## The tutor

| Option | Where it runs | Needs |
| --- | --- | --- |
| In this browser | Your graphics chip, through WebGPU | Recent Chrome or Edge; about 0.7 to 2.5 GB of GPU memory depending on the model |
| Ollama | Your computer, outside the browser | Ollama running with `OLLAMA_ORIGINS="*"` |

Model files are downloaded once from the model host and cached by the browser; after that the tutor works with no internet connection. Small models make mistakes in Czech forms, so the notes are the reference and the tutor is a study partner. See `docs/tutor.md` for details and troubleshooting.

## Project layout

```text
docs/
  index.md, tutor.md       home page and tutor guide
  listen.md                the text reader (read any text aloud)
  grammar/                 grammar notes (add pages here and in the sidebar in config.ts)
  practice/                the exercise studio page
  decks/                   exercise sets that ship with the site
  .vitepress/
    config.ts              site config, base path, offline caching
    theme/
      components/          exercise studio, game, importer, text reader, tutor drawer
      lib/                 parsers (rows and workbook pages), grader, session engine, speech, storage, tutor backends
tests/                     vitest unit tests
```

## Notes

- The grammar notes are study aids written for A1 to A2 learners. Check anything important against a textbook or a teacher.
- Custom exercise sets and progress live in the browser's local storage. Clearing site data removes them, so export sets you care about.
- Text-to-speech depends on the voices installed on the device. If no Czech voice exists, the site says so instead of reading Czech with an English voice.

## Licence

MIT. See `LICENSE`.
