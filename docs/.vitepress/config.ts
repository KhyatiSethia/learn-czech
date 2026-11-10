import { defineConfig } from 'vitepress'
import { withPwa } from '@vite-pwa/vitepress'

// On GitHub Actions the site lives at https://<user>.github.io/<repo>/, so the
// base path is derived from the repository name. Override with BASE=/ for a
// custom domain or a user/organisation site.
const repo = process.env.GITHUB_REPOSITORY?.split('/')[1]
const base =
  process.env.BASE ?? (repo && !repo.endsWith('.github.io') ? `/${repo}/` : '/')

const config = defineConfig({
  title: 'Česky',
  description:
    'Czech grammar notes, playful exercises built from your own workbook, and a tutor model that runs in your browser.',
  lang: 'en',
  base,
  cleanUrls: true,
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: `${base}favicon.svg` }],
    ['meta', { name: 'theme-color', content: '#11457e' }],
  ],
  themeConfig: {
    logo: { src: '/favicon.svg', alt: '' },
    siteTitle: 'Česky',
    nav: [
      { text: 'Grammar', link: '/grammar/', activeMatch: '/grammar/' },
      { text: 'Practice', link: '/practice/', activeMatch: '/practice/' },
      { text: 'Listen', link: '/listen' },
      { text: 'Tutor', link: '/tutor' },
    ],
    sidebar: {
      '/grammar/': [
        {
          text: 'Start here',
          items: [
            { text: 'How to use these notes', link: '/grammar/' },
            { text: 'Sounds and spelling', link: '/grammar/pronunciation' },
          ],
        },
        {
          text: 'Nouns and friends',
          items: [
            { text: 'Gender and number', link: '/grammar/gender-number' },
            { text: 'The seven cases', link: '/grammar/cases' },
            { text: 'Declension patterns', link: '/grammar/declension' },
            { text: 'Adjectives', link: '/grammar/adjectives' },
            { text: 'Pronouns', link: '/grammar/pronouns' },
            { text: 'Numbers', link: '/grammar/numbers' },
          ],
        },
        {
          text: 'Verbs',
          items: [
            { text: 'Present tense', link: '/grammar/verbs-present' },
            { text: 'Past and future', link: '/grammar/verbs-past-future' },
            { text: 'Aspect', link: '/grammar/aspect' },
            { text: 'Conditional', link: '/grammar/conditional' },
            { text: 'Imperative', link: '/grammar/imperative' },
          ],
        },
        {
          text: 'Building sentences',
          items: [
            { text: 'Prepositions', link: '/grammar/prepositions' },
            { text: 'Comparing things', link: '/grammar/comparison' },
            { text: 'Word order and questions', link: '/grammar/word-order' },
          ],
        },
        {
          text: 'Reference',
          items: [
            { text: 'Everyday phrases', link: '/grammar/phrases' },
            { text: 'Spoken Czech', link: '/grammar/spoken-czech' },
            { text: 'My own notes', link: '/grammar/my-notes' },
          ],
        },
      ],
    },
    search: { provider: 'local' },
    outline: { level: [2, 3], label: 'On this page' },
    docFooter: { prev: 'Previous', next: 'Next' },
    footer: {
      message: 'Study notes for learners. Always check important forms against a textbook or a teacher.',
    },
  },
  vite: {
    worker: { format: 'es' },
    optimizeDeps: { exclude: ['@mlc-ai/web-llm'] },
    build: { chunkSizeWarningLimit: 8000 },
  },
})

// The offline service worker is only generated for production builds: the PWA plugin
// does not support the dev server that VitePress 1.x ships, and it isn't wanted there anyway.
const isBuild = process.argv.includes('build')

const pwa = {
  registerType: 'autoUpdate' as const,
  manifest: {
    name: 'Česky – learn Czech',
    short_name: 'Česky',
    description: 'Czech grammar notes, playful drills and an offline tutor.',
    theme_color: '#11457e',
    background_color: '#f4f6f9',
    display: 'standalone' as const,
    icons: [
      { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  },
  generateSW: {
    globPatterns: ['**/*.{css,js,html,svg,ico,woff2}'],
    // Keep the big in-browser model runtime and non-Latin font subsets out of
    // the install-time precache; the runtime is cached the first time the
    // tutor is opened (see runtimeCaching below).
    globIgnores: ['**/*cyrillic*', '**/*greek*', '**/*vietnamese*', '**/llm.worker*', '**/web-llm*', '**/chunks/lib.*'],
    navigateFallbackDenylist: [/^\/api\//],
    runtimeCaching: [
      {
        urlPattern: ({ url, sameOrigin }: { url: URL; sameOrigin: boolean }) =>
          sameOrigin && /\/assets\/.*\.(js|wasm|css)$/.test(url.pathname),
        handler: 'CacheFirst' as const,
        options: {
          cacheName: 'czech-runtime-assets',
          expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 365 },
        },
      },
    ],
  },
  maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
  // Skip (with a warning) instead of failing when something big slips past globIgnores.
  throwMaximumFileSizeToCacheInBytes: false,
}

export default isBuild ? withPwa({ ...config, pwa }) : config
