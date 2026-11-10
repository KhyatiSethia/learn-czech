<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { Deck, Item } from '../lib/types'
import { pickItems, type Summary } from '../lib/session'
import { serializeItems } from '../lib/parse'
import { levelOf, useStore } from '../lib/store'
import GameSession from './GameSession.vue'
import DeckImporter from './DeckImporter.vue'
import SessionSetup from './SessionSetup.vue'

const store = useStore()
const { allDecks, userDecks, progress, stats, prefs } = store

const ready = ref(false)
onMounted(() => {
  store.init()
  ready.value = true
})

const lvl = computed(() => levelOf(stats.value.xp))

// ---- decks ----
const mixDeck = computed<Deck>(() => {
  const seen = new Set<string>()
  const items: Item[] = []
  for (const d of allDecks.value) {
    for (const it of d.items) {
      if (!seen.has(it.id)) {
        seen.add(it.id)
        items.push(it)
      }
    }
  }
  return { id: 'mix', title: 'Mixed practice', description: 'Questions from every set', items, source: 'builtin' }
})

const bestOf = (id: string) => stats.value.best[id]

// ---- create / edit ----
const importing = ref<{ deck?: Deck } | null>(null)
function saveImported(d: Pick<Deck, 'title' | 'description' | 'items' | 'langs' | 'workbook'> & { id?: string }) {
  store.saveDeck({
    id: d.id ?? store.newDeckId(),
    title: d.title,
    description: d.description,
    items: d.items,
    langs: d.langs,
    workbook: d.workbook,
    source: 'user',
  })
  importing.value = null
}

const pendingDelete = ref<string | null>(null)
function remove(deck: Deck) {
  if (pendingDelete.value === deck.id) {
    store.removeDeck(deck.id)
    pendingDelete.value = null
  } else {
    pendingDelete.value = deck.id
    setTimeout(() => {
      if (pendingDelete.value === deck.id) pendingDelete.value = null
    }, 4000)
  }
}

function exportDeck(deck: Deck) {
  const head = [`# title: ${deck.title}`, deck.description ? `# description: ${deck.description}` : ''].filter(Boolean)
  const body = [...head, serializeItems(deck.items)].join('\n') + '\n'
  const slug = deck.title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'exercises'
  const url = URL.createObjectURL(new Blob([body], { type: 'text/tab-separated-values;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${slug}.tsv`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ---- play ----
const setup = ref<Deck | null>(null)
const run = ref<{ deck: Deck; items: Item[]; key: number; scoreboard: boolean } | null>(null)
let runKey = 0

function select(deck: Deck) {
  return pickItems(deck.items, progress.value, prefs.value.length || deck.items.length)
}
function launch() {
  const deck = setup.value
  if (!deck) return
  store.savePrefs()
  setup.value = null
  run.value = { deck, items: select(deck), key: ++runKey, scoreboard: true }
}
function again() {
  if (!run.value) return
  run.value = { ...run.value, items: select(run.value.deck), key: ++runKey, scoreboard: true }
}
function practiseMisses(items: Item[]) {
  if (!run.value) return
  run.value = { ...run.value, items, key: ++runKey, scoreboard: false }
}
function onDone(summary: Summary) {
  if (run.value) store.recordSession(run.value.deck.id, summary, run.value.scoreboard)
}
</script>

<template>
  <div class="studio">
    <header class="masthead">
      <div class="intro">
        <h1>Practice</h1>
        <p>
          Pick a set, or build one from your own workbook. You can answer by tapping, and every sentence can be read aloud. A question you miss comes back a few questions later, so it sticks.
        </p>
      </div>
      <dl v-if="ready" class="you">
        <div>
          <dt>Level</dt>
          <dd>{{ lvl.level }}</dd>
        </div>
        <div class="xp">
          <dt>XP</dt>
          <dd>
            <span class="meter" role="img" :aria-label="`${lvl.into} of 100 XP towards level ${lvl.level + 1}`"><i :style="{ width: lvl.into + '%' }" /></span>
            {{ stats.xp }}
          </dd>
        </div>
        <div>
          <dt>Day streak</dt>
          <dd>{{ stats.streakDays }}</dd>
        </div>
      </dl>
    </header>

    <div class="actions">
      <button type="button" class="primary" @click="importing = {}">Create exercises from a workbook</button>
      <button type="button" class="secondary" :disabled="!mixDeck.items.length" @click="setup = mixDeck">Mix every set</button>
    </div>

    <ol class="board" aria-label="Exercise sets">
      <li v-for="deck in allDecks" :key="deck.id" class="row">
        <div class="name">
          <h2>{{ deck.title }}</h2>
          <p v-if="deck.description">{{ deck.description }}</p>
          <p v-if="deck.source === 'user'" class="tools">
            <span class="yours">Your set</span>
            <button type="button" class="link" @click="importing = { deck }">Edit</button>
            <button type="button" class="link" @click="exportDeck(deck)">Export</button>
            <button type="button" class="link danger" @click="remove(deck)">
              {{ pendingDelete === deck.id ? 'Click again to delete' : 'Delete' }}
            </button>
          </p>
        </div>
        <p class="count">{{ deck.items.length }} questions</p>
        <div class="best" :aria-label="bestOf(deck.id) ? `Best result: ${bestOf(deck.id).stars} of 3 stars` : 'Not played yet'">
          <span v-for="n in 3" :key="n" class="star" :class="{ on: bestOf(deck.id) && n <= bestOf(deck.id).stars }">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z" />
            </svg>
          </span>
        </div>
        <div class="go">
          <button type="button" class="primary small" @click="setup = deck">Play</button>
        </div>
      </li>
    </ol>

    <p v-if="ready && !userDecks.length" class="empty">
      Nothing of your own here yet. Copy an exercise and its answers from a workbook, choose
      <b>Create exercises from a workbook</b>, and paste them in. They stay in this browser.
    </p>
    <p class="fine">
      Want a set to ship with the site? Export it and drop the file into <code>docs/decks</code> in the repository.
    </p>

    <DeckImporter v-if="importing" :deck="importing.deck" @save="saveImported" @close="importing = null" />
    <SessionSetup v-if="setup" :deck="setup" :prefs="prefs" @start="launch" @change="store.savePrefs()" @close="setup = null" />
    <GameSession
      v-if="run"
      :key="run.key"
      :title="run.deck.title"
      :items="run.items"
      :pool="run.deck.items"
      :langs="run.deck.langs"
      :prefs="prefs"
      @exit="run = null"
      @again="again"
      @mistakes="practiseMisses"
      @done="onDone"
    />
  </div>
</template>

<style scoped>
.studio {
  max-width: 980px;
  margin: 0 auto;
  padding: 40px 24px 80px;
  font-family: var(--cz-ui);
  color: var(--cz-ink);
}
.masthead {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 20px 40px;
  padding-bottom: 22px;
  border-bottom: 4px solid var(--cz-plate);
}
.intro {
  max-width: 520px;
}
h1 {
  margin: 0 0 8px;
  font: 700 clamp(38px, 6vw, 56px) / 1 var(--cz-ui);
  letter-spacing: -0.01em;
  color: var(--cz-ink);
}
.intro p {
  margin: 0;
  font: 500 19px/1.45 var(--cz-ui);
  color: var(--cz-muted);
}
.you {
  display: flex;
  gap: 26px;
  margin: 0;
}
.you dt {
  color: var(--cz-muted);
  font: 500 15px/1.2 var(--cz-ui);
}
.you dd {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 2px 0 0;
  font: 700 30px/1.1 var(--cz-ui);
}
.meter {
  width: 70px;
  height: 8px;
  border-radius: 4px;
  background: var(--cz-line);
  overflow: hidden;
}
.meter i {
  display: block;
  height: 100%;
  background: var(--cz-yellow);
  transition: width 0.5s;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 26px 0 22px;
}
.primary,
.secondary {
  min-height: 50px;
  padding: 0 24px;
  border-radius: 12px;
  border: 2px solid transparent;
  font: 700 19px/1 var(--cz-ui);
  cursor: pointer;
  transition: transform 0.08s, filter 0.12s;
}
.primary {
  background: var(--cz-primary);
  color: #fff;
  border-bottom: 4px solid var(--cz-primary-edge);
}
.primary:hover {
  filter: brightness(1.08);
}
.primary:active {
  transform: translateY(2px);
  border-bottom-width: 2px;
}
.primary.small {
  min-height: 42px;
  padding: 0 20px;
  font-size: 17px;
}
.secondary {
  background: transparent;
  border-color: var(--cz-primary);
  color: var(--cz-blue);
}
.secondary:hover:not(:disabled) {
  background: var(--cz-blue-soft);
}
.secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* the board: one row per set, like a departures list */
.board {
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: 1.5px solid var(--cz-line);
}
.row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 110px 88px auto;
  align-items: center;
  gap: 8px 18px;
  padding: 16px 4px;
  border-bottom: 1.5px solid var(--cz-line);
}
.name h2 {
  margin: 0;
  padding: 0;
  border: 0;
  font: 700 24px/1.2 var(--cz-ui);
  letter-spacing: 0;
}
.name p {
  margin: 3px 0 0;
  color: var(--cz-muted);
  font: 500 17px/1.35 var(--cz-ui);
}
.name .tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 16px;
  margin-top: 6px;
}
.yours {
  padding: 0 8px;
  border-radius: 4px;
  background: var(--cz-blue-soft);
  color: var(--cz-blue);
  font: 600 14px/1.6 var(--cz-ui);
}
.link {
  border: 0;
  background: none;
  padding: 0;
  color: var(--cz-blue);
  font: 600 15px/1.2 var(--cz-ui);
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}
.link.danger {
  color: var(--cz-red);
}
.count {
  margin: 0;
  color: var(--cz-muted);
  font: 500 17px/1.2 var(--cz-ui);
  white-space: nowrap;
}
.best {
  display: flex;
  gap: 1px;
}
.star svg {
  fill: var(--cz-line);
}
.star.on svg {
  fill: var(--cz-yellow);
  stroke: #c98f00;
  stroke-width: 0.8;
}
.empty {
  margin: 22px 0 0;
  max-width: 600px;
  color: var(--cz-muted);
  font: 500 18px/1.5 var(--cz-ui);
}
.fine {
  margin: 12px 0 0;
  color: var(--cz-muted);
  font: 500 15px/1.5 var(--cz-ui);
}
.fine code,
.empty code {
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--cz-blue-soft);
  color: var(--cz-ink);
  font-size: 0.92em;
}

@media (max-width: 700px) {
  .studio {
    padding: 28px 16px 70px;
  }
  .row {
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .count {
    grid-row: 2;
    grid-column: 1;
  }
  .best {
    grid-row: 2;
    grid-column: 2;
    justify-self: end;
  }
  .go {
    grid-row: 1;
    grid-column: 2;
  }
}
</style>
