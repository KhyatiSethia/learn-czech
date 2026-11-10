<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { Deck, Item } from '../lib/types'
import { parseDeckText, serializeItems, type DelimiterChoice } from '../lib/parse'
import { decodeText } from '../lib/files'

const props = defineProps<{ deck?: Deck }>()
interface ImportedDeck {
  id?: string
  title: string
  description?: string
  items: Item[]
}
const emit = defineEmits<{ save: [deck: ImportedDeck]; close: [] }>()

const dlg = ref<HTMLDialogElement | null>(null)
const title = ref(props.deck?.title ?? '')
const text = ref(props.deck ? serializeItems(props.deck.items) : '')
const delimiter = ref<DelimiterChoice>('auto')
const fileNote = ref('')
const fileError = ref('')

const EXAMPLE = `# Paste rows from a spreadsheet, or type them like this:
How are you? | Jak se máš? / Jak se máte?
I live in Prague. | Bydlím v Praze.
Thank you | Děkuji / Děkuju | Both are fine
Yesterday I was at home. | Včera jsem byl doma. / Včera jsem byla doma.`

const parsed = computed(() => parseDeckText(text.value, delimiter.value))
const preview = computed(() => parsed.value.items.slice(0, 5))
const shownTitle = computed(() => title.value.trim() || parsed.value.title || 'My exercises')
const delimiterName = computed(
  () =>
    ({ tab: 'tab (spreadsheet paste)', pipe: '|', arrow: '=>', colons: '::', semicolon: 'semicolon', comma: 'comma', json: 'JSON', none: '' })[
      parsed.value.delimiter
    ] ?? '',
)

onMounted(() => dlg.value?.showModal())

async function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  fileError.value = ''
  if (!file) return
  if (file.size > 2_000_000) {
    fileError.value = 'That file is over 2 MB. Try splitting it into smaller sets.'
    return
  }
  try {
    text.value = decodeText(await file.arrayBuffer())
    fileNote.value = file.name
    if (!title.value.trim()) title.value = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ')
  } catch {
    fileError.value = 'Could not read that file. Save it as CSV (UTF-8) or paste the cells instead.'
  }
  input.value = ''
}

function save() {
  if (!parsed.value.items.length) return
  emit('save', {
    id: props.deck?.id,
    title: shownTitle.value,
    description: props.deck?.description ?? parsed.value.description,
    items: parsed.value.items,
  })
}
</script>

<template>
  <dialog ref="dlg" class="dlg" aria-labelledby="imp-title" @close="emit('close')" @click.self="dlg?.close()">
    <form class="box" @submit.prevent="save">
      <header>
        <h2 id="imp-title">{{ deck ? 'Edit exercises' : 'Create exercises from a workbook' }}</h2>
        <p class="sub">
          Paste the question and answer columns straight from Excel, Numbers or Google Sheets, or load a CSV. One row is one exercise.
        </p>
      </header>

      <label class="f">
        <span>Name</span>
        <input v-model="title" type="text" maxlength="80" placeholder="Workbook unit 4" autocomplete="off" />
      </label>

      <label class="f">
        <span>Rows</span>
        <textarea
          v-model="text"
          rows="8"
          spellcheck="false"
          placeholder="Question&#9;Answer&#9;Hint (optional)"
          aria-describedby="imp-help"
        />
      </label>

      <div class="tools">
        <label class="filebtn">
          <input type="file" accept=".csv,.tsv,.txt,.json,text/plain,text/csv" @change="onFile" />
          <span>Choose a file</span>
        </label>
        <button type="button" class="link" @click="text = EXAMPLE">Fill in an example</button>
        <label class="sel">
          <span>Separator</span>
          <select v-model="delimiter">
            <option value="auto">Detect it</option>
            <option value="tab">Tab</option>
            <option value="pipe">|</option>
            <option value="semicolon">Semicolon</option>
            <option value="comma">Comma</option>
            <option value="arrow">=&gt;</option>
            <option value="colons">::</option>
          </select>
        </label>
      </div>
      <p v-if="fileNote" class="ok">Loaded {{ fileNote }}</p>
      <p v-if="fileError" class="bad" role="alert">{{ fileError }}</p>

      <details id="imp-help" class="help">
        <summary>How rows are read</summary>
        <ul>
          <li>Column one is the question, column two is the answer, column three (optional) is a hint.</li>
          <li>Several accepted answers: put a slash with spaces around it, like <code>Děkuji / Děkuju</code>.</li>
          <li>To make a fill-in-the-gap question, put <code>___</code> in the question and the missing word as the answer.</li>
          <li>Answers of three words or more also become sentence-building puzzles.</li>
          <li>Lines starting with <code>#</code> are ignored. <code># title: Unit 4</code> sets the name.</li>
          <li>Czech letters from an old Windows Excel CSV are detected and converted for you.</li>
        </ul>
      </details>

      <section class="preview" aria-live="polite">
        <template v-if="parsed.items.length">
          <p class="count">
            {{ parsed.items.length }} {{ parsed.items.length === 1 ? 'exercise' : 'exercises' }} ready
            <span v-if="delimiterName" class="muted">(separator: {{ delimiterName }})</span>
          </p>
          <table>
            <thead>
              <tr><th>Question</th><th>Answer</th><th>Hint</th></tr>
            </thead>
            <tbody>
              <tr v-for="it in preview" :key="it.id">
                <td>{{ it.q }}</td>
                <td lang="cs">{{ it.a.join(' / ') }}</td>
                <td>{{ it.hint }}</td>
              </tr>
            </tbody>
          </table>
          <p v-if="parsed.items.length > preview.length" class="muted">and {{ parsed.items.length - preview.length }} more</p>
          <p v-if="parsed.items.length < 3" class="muted">
            Add at least three rows to unlock multiple choice, which needs wrong answers to choose from.
          </p>
        </template>
        <p v-else class="muted">Nothing to import yet. Paste some rows above.</p>

        <div v-if="parsed.skipped.length" class="skipped" role="alert">
          <p>
            {{ parsed.skipped.length }} {{ parsed.skipped.length === 1 ? 'row was' : 'rows were' }} left out:
          </p>
          <ul>
            <li v-for="s in parsed.skipped.slice(0, 4)" :key="s.line + s.text">
              <span v-if="s.line">Line {{ s.line }}:</span> {{ s.reason }}
            </li>
          </ul>
        </div>
      </section>

      <footer>
        <button type="button" class="ghost" @click="dlg?.close()">Cancel</button>
        <button type="submit" class="primary" :disabled="!parsed.items.length">
          {{ deck ? 'Save changes' : 'Create exercises' }}
        </button>
      </footer>
    </form>
  </dialog>
</template>

<style scoped>
.dlg {
  width: min(720px, calc(100vw - 24px));
  max-height: calc(100dvh - 24px);
  padding: 0;
  border: 0;
  border-radius: 18px;
  background: var(--cz-card);
  color: var(--cz-ink);
  font-family: var(--cz-ui);
  box-shadow: 0 30px 80px -20px rgba(0, 0, 0, 0.55);
}
.dlg::backdrop {
  background: rgba(10, 22, 44, 0.6);
  backdrop-filter: blur(2px);
}
.box {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 24px 26px 22px;
}
h2 {
  margin: 0;
  border: 0;
  padding: 0;
  font: 700 28px/1.15 var(--cz-ui);
}
.sub {
  margin: 6px 0 0;
  color: var(--cz-muted);
  font: 500 17px/1.4 var(--cz-ui);
}
.f {
  display: grid;
  gap: 5px;
}
.f > span,
.sel > span {
  font: 600 15px/1 var(--cz-ui);
  color: var(--cz-muted);
}
input[type='text'],
textarea,
select {
  width: 100%;
  padding: 10px 12px;
  border: 2px solid var(--cz-line);
  border-radius: 10px;
  background: var(--cz-paper);
  color: var(--cz-ink);
  font: 500 17px/1.4 var(--cz-ui);
}
textarea {
  resize: vertical;
  min-height: 120px;
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 15px;
  tab-size: 8;
}
input:focus,
textarea:focus,
select:focus {
  outline: none;
  border-color: var(--cz-blue);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--cz-blue) 22%, transparent);
}
.tools {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px 18px;
}
.filebtn {
  position: relative;
  display: inline-flex;
  align-items: center;
  min-height: 40px;
  padding: 0 16px;
  border: 2px solid var(--cz-primary);
  border-radius: 10px;
  color: var(--cz-blue);
  font: 700 16px/1 var(--cz-ui);
  cursor: pointer;
}
.filebtn input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}
.filebtn:focus-within {
  outline: 3px solid var(--cz-blue);
  outline-offset: 2px;
}
.sel {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}
.sel select {
  width: auto;
  padding: 7px 10px;
  font-size: 15px;
}
.link {
  border: 0;
  background: none;
  padding: 0;
  color: var(--cz-blue);
  font: 600 16px/1.2 var(--cz-ui);
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}
.ok,
.bad {
  margin: -4px 0 0;
  font: 500 15px/1.3 var(--cz-ui);
}
.ok {
  color: var(--cz-green);
}
.bad {
  color: var(--cz-red);
}
.help {
  font: 500 16px/1.45 var(--cz-ui);
  color: var(--cz-muted);
}
.help summary {
  cursor: pointer;
  font-weight: 600;
  color: var(--cz-ink);
}
.help ul {
  margin: 8px 0 0;
  padding-left: 20px;
}
.help code {
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--cz-blue-soft);
  color: var(--cz-ink);
  font-size: 0.92em;
}
.preview {
  padding: 12px 14px;
  border: 1.5px dashed var(--cz-line);
  border-radius: 12px;
}
.count {
  margin: 0 0 8px;
  font: 700 18px/1.2 var(--cz-ui);
}
.muted {
  margin: 6px 0 0;
  color: var(--cz-muted);
  font: 500 15px/1.35 var(--cz-ui);
}
.count .muted {
  margin: 0 0 0 6px;
  font-weight: 500;
}
table {
  width: 100%;
  border-collapse: collapse;
  display: table;
  margin: 0;
  font: 500 16px/1.35 var(--cz-ui);
}
th,
td {
  padding: 6px 8px;
  border: 0;
  border-bottom: 1px solid var(--cz-line);
  background: transparent !important;
  text-align: left;
  vertical-align: top;
  font-family: var(--cz-ui);
}
th {
  color: var(--cz-muted);
  font-weight: 600;
  font-size: 14px;
}
.skipped {
  margin-top: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--cz-yellow-soft);
  font: 500 15px/1.4 var(--cz-ui);
}
.skipped p {
  margin: 0 0 2px;
  font-weight: 600;
}
.skipped ul {
  margin: 0;
  padding-left: 18px;
}
footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 2px;
}
.primary,
.ghost {
  min-height: 46px;
  padding: 0 22px;
  border-radius: 12px;
  border: 2px solid transparent;
  font: 700 18px/1 var(--cz-ui);
  cursor: pointer;
}
.primary {
  background: var(--cz-primary);
  color: #fff;
  border-bottom: 4px solid var(--cz-primary-edge);
}
.primary:hover:not(:disabled) {
  filter: brightness(1.08);
}
.primary:disabled {
  background: var(--cz-line);
  border-color: var(--cz-line);
  color: var(--cz-muted);
  cursor: not-allowed;
}
.ghost {
  background: transparent;
  color: var(--cz-muted);
  border-color: var(--cz-line);
}
.ghost:hover {
  color: var(--cz-ink);
  border-color: var(--cz-muted);
}
@media (max-width: 520px) {
  .box {
    padding: 18px 16px;
  }
  .sel {
    margin-left: 0;
  }
}
</style>
