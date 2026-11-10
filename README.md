# Česky: learn Czech

A small website for learning Czech, built with [VitePress](https://vitepress.dev) and deployed to GitHub Pages.

- **Grammar notes** in `docs/grammar/`: 19 short pages from pronunciation and the seven cases to aspect, the conditional and spoken Czech.
- **Exercises** that feel more like a game than a workbook. Paste the questions and answers from your own workbook, press a button, and answer them by typing, picking, or building the sentence from word tiles. Missed questions come back a few turns later; you earn XP, a day streak and up to three stars per set.
- **A tutor chat** that explains Czech in English and runs offline: a small language model in your browser (WebLLM, WebGPU) or, if you prefer, your own [Ollama](https://ollama.com).
- **Works offline** after the first visit (service worker), and installs as an app on phones and laptops.

## Run it locally

You need Node 22 or newer.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests for parsing, grading and the exercise engine
npm run build    # static site in docs/.vitepress/dist
```

## Put it online with GitHub Pages

1. Create a **public** repository on GitHub (Pages is free for public repositories) and push this folder to its `main` branch.
2. In the repository open **Settings → Pages** and set **Source** to **GitHub Actions**.
3. The workflow in `.github/workflows/deploy.yml` runs the tests, builds the site and publishes it at `https://<user>.github.io/<repo>/`.

The base path is worked out from the repository name. For a custom domain or a `<user>.github.io` repository, build with `BASE=/`.

## Add your own exercises

**In the browser:** open *Practice*, choose **Create exercises from a workbook**, and paste rows from Excel, Numbers or Google Sheets (or load a CSV). Sets are saved in that browser's local storage. *Export* downloads a set as a file.

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
  grammar/                 grammar notes (add pages here and in the sidebar in config.ts)
  practice/                the exercise studio page
  decks/                   exercise sets that ship with the site
  .vitepress/
    config.ts              site config, base path, offline caching
    theme/
      components/          exercise studio, game, importer, tutor drawer
      lib/                 parser, grader, session engine, storage, tutor backends
tests/                     vitest unit tests
```

## Notes

- The grammar notes are study aids written for A1 to A2 learners. Check anything important against a textbook or a teacher.
- Custom exercise sets and progress live in the browser's local storage. Clearing site data removes them, so export sets you care about.

## Licence

MIT. See `LICENSE`.
