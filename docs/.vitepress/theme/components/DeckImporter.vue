<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { Deck, Item, Lang } from '../lib/types'
import { parseDeckText, serializeItems, type DelimiterChoice } from '../lib/parse'
import { WORKBOOK_EXAMPLE, parseWorkbook } from '../lib/workbook'
import { detectLang } from '../lib/lang'
import { decodeText } from '../lib/files'

const props = defineProps<{ deck?: Deck }>()
interface ImportedDeck {
  id?: string
  title: string
  description?: string
  items: Item[]
  langs?: { q: Lang; a: Lang }
  workbook?: { text: string; answers: string }
}
const emit = defineEmits<{ save: [deck: ImportedDeck]; close: [] }>()

type Source = 'workbook' | 'rows'

const dlg = ref<HTMLDialogElement | null>(null)
const title = ref(props.deck?.title ?? '')
const source = ref<Source>(props.deck && !props.deck.workbook ? 'rows' : 'workbook')
const wbText = ref(props.deck?.workbook?.text ?? '')
const wbAnswers = ref(props.deck?.workbook?.answers ?? '')
const rowsText = ref(props.deck && !props.deck.workbook ? serializeItems(props.deck.items) : '')
const delimiter = ref<DelimiterChoice>('auto')
const fileNote = ref('')
const fileError = ref('')

const ROWS_EXAMPLE = `# Paste rows from a spreadsheet, or type them like this:
How are you? | Jak se máš? / Jak se máte?
I live in Prague. | Bydlím v Praze.
Thank you | Děkuji / Děkuju | Both are fine
Yesterday I was at home. | Včera jsem byl doma. / Včera jsem byla doma.`

const wb = computed(() => parseWorkbook(wbText.value, wbAnswers.value))
const rows = computed(() => parseDeckText(rowsText.value, delimiter.value))

const items = computed<Item[]>(() => (source.value === 'workbook' ? wb.value.items : rows.value.items))
const preview = computed(() => items.value.slice(0, 6))
const autoTitle = computed(() => (source.value === 'workbook' ? wb.value.title : rows.value.title))
const shownTitle = computed(() => title.value.trim() || autoTitle.value || 'My exercises')
const delimiterName = computed(
  () =>
    ({ tab: 'tab (spreadsheet paste)', pipe: '|', arrow: '=>', colons: '::', semicolon: 'semicolon', comma: 'comma', json: 'JSON', none: '' })[
      rows.value.delimiter
    ] ?? '',
)
const hasChoices = computed(() => items.value.some((i) => i.options))

// Pasted into the wrong tab? Offer the other one rather than showing an empty result.
const looksLikeRows = computed(
  () => source.value === 'workbook' && wbText.value.trim() !== '' && wb.value.items.length < 2 && parseDeckText(wbText.value).items.length >= 2,
)
const looksLikeWorkbook = computed(
  () => source.value === 'rows' && rowsText.value.trim() !== '' && rows.value.items.length < 3 && parseWorkbook(rowsText.value).items.length >= 2,
)
function useRows() {
  rowsText.value = wbText.value
  source.value = 'rows'
}
function useWorkbook() {
  wbText.value = rowsText.value
  wbAnswers.value = ''
  source.value = 'workbook'
}

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
    const content = decodeText(await file.arrayBuffer())
    if (source.value === 'workbook') wbText.value = content
    else rowsText.value = content
    fileNote.value = file.name
    if (!title.value.trim()) title.value = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ')
  } catch {
    fileError.value = 'Could not read that file. Save it as CSV or plain text (UTF-8) instead, or paste the text.'
  }
  input.value = ''
}

function save() {
  if (!items.value.length) return
  const workbook = source.value === 'workbook'
  emit('save', {
    id: props.deck?.id,
    title: shownTitle.value,
    description: workbook ? (wb.value.description ?? props.deck?.description) : (props.deck?.description ?? rows.value.description),
    items: items.value,
    // A workbook page is Czech all the way through, so the voice never has to guess.
    langs: workbook && detectLang(wbText.value, 'en') === 'cs' ? { q: 'cs', a: 'cs' } : undefined,
    workbook: workbook ? { text: wbText.value, answers: wbAnswers.value } : undefined,
  })
}
</script>

<template>
  <dialog ref="dlg" class="dlg" aria-labelledby="imp-title" @close="emit('close')" @click.self="dlg?.close()">
    <form class="box" @submit.prevent="save">
      <header>
        <h2 id="imp-title">{{ deck ? 'Edit exercises' : 'Create exercises from a workbook' }}</h2>
        <p class="sub">Copy an exercise and its answers from your workbook and paste them in. They are turned into questions you can answer by tapping.</p>
      </header>

      <label class="f">
        <span>Name</span>
        <input v-model="title" type="text" maxlength="80" :placeholder="autoTitle || 'Workbook unit 4'" autocomplete="off" />
      </label>

      <div class="seg" role="radiogroup" aria-label="What you are pasting">
        <label :class="{ on: source === 'workbook' }">
          <input v-model="source" type="radio" name="src" value="workbook" />
          <span class="n">A workbook exercise</span>
          <span class="d">Numbered sentences, then the answers</span>
        </label>
        <label :class="{ on: source === 'rows' }">
          <input v-model="source" type="radio" name="src" value="rows" />
          <span class="n">Question and answer rows</span>
          <span class="d">From a spreadsheet or CSV</span>
        </label>
      </div>

      <template v-if="source === 'workbook'">
        <label class="f">
          <span>Exercise, with the answers after it</span>
          <textarea
            v-model="wbText"
            rows="9"
            spellcheck="false"
            lang="cs"
            placeholder="Pracujte podle vzoru. a) Kam ................ (jít – chodit)? b) Dnes ................ (jet – jezdit) do Prahy.&#10;&#10;* a) chodíš, b) jedu"
          />
        </label>
        <label class="f">
          <span>Answers, if they are not in the box above <i>(optional)</i></span>
          <textarea v-model="wbAnswers" rows="3" spellcheck="false" lang="cs" placeholder="a) chodíš, b) jedu" />
        </label>
      </template>

      <label v-else class="f">
        <span>Rows</span>
        <textarea v-model="rowsText" rows="8" spellcheck="false" placeholder="Question&#9;Answer&#9;Hint (optional)" />
      </label>

      <div class="tools">
        <label class="filebtn">
          <input type="file" accept=".csv,.tsv,.txt,.json,text/plain,text/csv" @change="onFile" />
          <span>Choose a file</span>
        </label>
        <button type="button" class="link" @click="source === 'workbook' ? ((wbText = WORKBOOK_EXAMPLE), (wbAnswers = '')) : (rowsText = ROWS_EXAMPLE)">
          Fill in an example
        </button>
        <label v-if="source === 'rows'" class="sel">
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

      <p v-if="looksLikeRows" class="nudge">
        This looks like rows with a separator, not a numbered exercise.
        <button type="button" class="link" @click="useRows">Read it as rows</button>
      </p>
      <p v-if="looksLikeWorkbook" class="nudge">
        This looks like a numbered workbook exercise.
        <button type="button" class="link" @click="useWorkbook">Read it as a workbook exercise</button>
      </p>

      <details class="help">
        <summary>How it is read</summary>
        <ul v-if="source === 'workbook'">
          <li>Questions can be numbered <code>a) b) c)</code>, <code>1. 2. 3.</code>, <code>1) 2) 3)</code> or <code>(1) (2) (3)</code>. They can be on one line or many.</li>
          <li>A blank is a run of dots, underscores or <code>…</code>. The words in brackets stay as a clue.</li>
          <li>The answers can follow the exercise (start them with <code>*</code>, <code>Klíč:</code> or <code>Řešení:</code>, or just restart the numbering), or go in the second box.</li>
          <li>A sentence with two blanks needs two answers, separated by a comma. It becomes two questions.</li>
          <li>For multiple choice, put <code>a) b) c)</code> choices after a numbered question. Answer with the letter, like <code>1b 2a 3c</code>.</li>
          <li>Accepted alternatives: put a slash between them, like <code>jedu / pojedu</code>.</li>
        </ul>
        <ul v-else>
          <li>Column one is the question, column two is the answer, column three (optional) is a hint.</li>
          <li>Several accepted answers: put a slash with spaces around it, like <code>Děkuji / Děkuju</code>.</li>
          <li>To make a fill-in-the-gap question, put <code>___</code> in the question and the missing word as the answer.</li>
          <li>Answers of three words or more also become sentence-building puzzles.</li>
          <li>Lines starting with <code>#</code> are ignored. <code># title: Unit 4</code> sets the name.</li>
          <li>Czech letters from an old Windows Excel CSV are detected and converted for you.</li>
        </ul>
      </details>

      <section class="preview" aria-live="polite">
        <template v-if="items.length">
          <p class="count">
            {{ items.length }} {{ items.length === 1 ? 'exercise' : 'exercises' }} ready
            <span v-if="source === 'rows' && delimiterName" class="muted">(separator: {{ delimiterName }})</span>
            <span v-else-if="source === 'workbook'" class="muted">
              ({{ wb.stats.questions }} numbered {{ wb.stats.questions === 1 ? 'question' : 'questions' }}<template v-if="hasChoices">, with choices</template>)
            </span>
          </p>
          <table>
            <thead>
              <tr>
                <th>Question</th>
                <th>Answer</th>
                <th v-if="source === 'rows'">Hint</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="it in preview" :key="it.id">
                <td lang="cs">{{ it.q }}</td>
                <td lang="cs">{{ it.a.join(' / ') }}</td>
                <td v-if="source === 'rows'">{{ it.hint }}</td>
              </tr>
            </tbody>
          </table>
          <p v-if="items.length > preview.length" class="muted">and {{ items.length - preview.length }} more</p>
          <p v-if="items.length < 3" class="muted">Add at least three questions to unlock multiple choice, which needs wrong answers to choose from.</p>
        </template>
        <p v-else class="muted">
          {{ source === 'workbook' ? 'Nothing to import yet. Paste an exercise and its answers above.' : 'Nothing to import yet. Paste some rows above.' }}
        </p>

        <div v-if="source === 'workbook' && wb.warnings.length" class="skipped" role="alert">
          <p>Check these:</p>
          <ul>
            <li v-for="w in wb.warnings.slice(0, 5)" :key="w">{{ w }}</li>
          </ul>
          <p v-if="wb.warnings.length > 5" class="more">and {{ wb.warnings.length - 5 }} more</p>
        </div>
        <div v-if="source === 'rows' && rows.skipped.length" class="skipped" role="alert">
          <p>{{ rows.skipped.length }} {{ rows.skipped.length === 1 ? 'row was' : 'rows were' }} left out:</p>
          <ul>
            <li v-for="s in rows.skipped.slice(0, 4)" :key="s.line + s.text">
              <span v-if="s.line">Line {{ s.line }}:</span> {{ s.reason }}
            </li>
          </ul>
        </div>
      </section>

      <footer>
        <button type="button" class="ghost" @click="dlg?.close()">Cancel</button>
        <button type="submit" class="primary" :disabled="!items.length">
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
.f > span i {
  font-weight: 500;
}
.seg {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.seg label {
  position: relative;
  display: grid;
  gap: 2px;
  padding: 10px 14px;
  border: 2px solid var(--cz-line);
  border-radius: 12px;
  cursor: pointer;
}
.seg label.on {
  border-color: var(--cz-blue);
  background: var(--cz-blue-soft);
}
.seg input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}
.seg label:has(input:focus-visible) {
  outline: 3px solid var(--cz-blue);
  outline-offset: 2px;
}
.seg .n {
  font: 700 17px/1.2 var(--cz-ui);
}
.seg .d {
  color: var(--cz-muted);
  font: 500 14px/1.3 var(--cz-ui);
}
.nudge {
  margin: 0;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--cz-yellow-soft);
  font: 500 15px/1.4 var(--cz-ui);
}
.skipped .more {
  margin-top: 2px;
  font-weight: 500;
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
  list-style: disc;
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
  .seg {
    grid-template-columns: 1fr;
  }
  .box {
    padding: 18px 16px;
  }
  .sel {
    margin-left: 0;
  }
}
</style>
