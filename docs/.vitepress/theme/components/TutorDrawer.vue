<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import {
  tutor,
  initTutor,
  probeDownloads,
  startTutor,
  stopTutor,
  sendMessage,
  stopGenerating,
  clearChat,
  closeTutor,
  forgetModel,
  askAboutPage,
  setInput,
  renderMarkdown,
  currentModelId,
} from '../lib/tutor'
import { MODEL_CHOICES, formatMb, gpuMemory, modelIdFor, type ModelChoice } from '../lib/tutor-models'
import { listOllamaModels } from '../lib/tutor-backends'
import TutorToggle from './TutorToggle.vue'

const settingsOpen = ref(false)
const chatEl = ref<HTMLElement | null>(null)
const composerEl = ref<HTMLTextAreaElement | null>(null)
const ollamaModels = ref<string[]>([])
const ollamaNote = ref('')
let probed = false

onMounted(() => {
  void initTutor()
})

watch(
  () => tutor.open,
  (open) => {
    if (!open) return
    if (!probed) {
      probed = true
      // Importing the model library is heavy, so look for downloaded models only once the tutor is opened.
      setTimeout(() => void probeDownloads(), 400)
    }
    nextTick(() => {
      if (tutor.ready) composerEl.value?.focus()
    })
  },
)

const loading = computed(() => tutor.status === 'loading')
const showSetup = computed(() => tutor.status !== 'ready' || settingsOpen.value)
const idFor = (c: ModelChoice) => modelIdFor(c, tutor.f16)
const downloaded = computed(() => {
  const id = currentModelId()
  return !!id && !!tutor.cached[id]
})
const startLabel = computed(() => {
  if (loading.value) return 'Starting'
  if (tutor.ready) return 'Restart with this model'
  return downloaded.value ? 'Start the tutor' : 'Download and start'
})
const statusText = computed(() => {
  if (tutor.status === 'ready') {
    if (tutor.backend === 'ollama') return `Connected to Ollama (${tutor.ollamaModel})`
    const c = MODEL_CHOICES.find((m) => m.key === tutor.choice)
    return `Running on this device (${c?.label.toLowerCase()} model)`
  }
  if (tutor.status === 'loading') return 'Starting'
  if (tutor.status === 'error') return 'Could not start'
  return 'Not started'
})
const pct = computed(() => `${Math.round(Math.min(1, Math.max(0, tutor.progress)) * 100)}%`)

function setBackend(kind: 'webllm' | 'ollama') {
  tutor.backend = kind
  tutor.error = ''
}

async function lookUpModels() {
  ollamaNote.value = ''
  try {
    ollamaModels.value = await listOllamaModels(tutor.ollamaUrl)
    const found = ollamaModels.value
    if (!found.length) {
      ollamaNote.value = 'Ollama is running but has no models yet.'
    } else {
      const wanted = tutor.ollamaModel.trim()
      const hasIt = found.some((m) => m === wanted || m.split(':')[0] === wanted)
      if (!hasIt) tutor.ollamaModel = found[0]
      ollamaNote.value = `Found ${found.length} installed ${found.length === 1 ? 'model' : 'models'}.${
        hasIt ? '' : ` Selected ${found[0]}.`
      }`
    }
  } catch (e) {
    ollamaNote.value = (e as Error).message
  }
}

async function start() {
  await startTutor()
  if (tutor.ready) {
    settingsOpen.value = false
    nextTick(() => composerEl.value?.focus())
  }
}

async function remove(c: ModelChoice) {
  const id = idFor(c)
  if (id) await forgetModel(id)
}

function submit() {
  if (!tutor.ready || !tutor.input.trim()) return
  void sendMessage(tutor.input)
}

const CHIPS = [
  { label: 'Explain this page', run: () => askAboutPage('Explain the main idea of this page in simple terms and give me two short examples.') },
  { label: 'Quiz me on this page', run: () => askAboutPage('Ask me three short questions about this page, one at a time. Wait for my answer before the next one.') },
  {
    label: 'Break down a sentence',
    run: () => {
      setInput('Translate this Czech sentence and break it down word by word: ')
      nextTick(() => composerEl.value?.focus())
    },
  },
]

watch(
  () => [tutor.messages.length, tutor.messages[tutor.messages.length - 1]?.content],
  () => nextTick(() => chatEl.value && (chatEl.value.scrollTop = chatEl.value.scrollHeight)),
)
</script>

<template>
  <TutorToggle variant="fab" />

  <aside
    id="tutor-drawer"
    class="tutor"
    :class="{ open: tutor.open }"
    aria-label="Czech tutor"
    :inert="!tutor.open"
    @keydown.esc="closeTutor"
  >
    <header class="head">
      <div>
        <h2>Tutor</h2>
        <p class="status" :class="tutor.status">{{ statusText }}</p>
      </div>
      <div class="hbtns">
        <button v-if="tutor.messages.length" type="button" class="text" @click="clearChat">Clear chat</button>
        <button
          v-if="tutor.ready"
          type="button"
          class="icon"
          :aria-expanded="settingsOpen"
          aria-label="Model settings"
          @click="settingsOpen = !settingsOpen"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="M4 7h10M18 7h2M4 17h2M10 17h10" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none" />
            <circle cx="16" cy="7" r="2.4" fill="none" stroke="currentColor" stroke-width="2" />
            <circle cx="8" cy="17" r="2.4" fill="none" stroke="currentColor" stroke-width="2" />
          </svg>
        </button>
        <button type="button" class="icon" aria-label="Close tutor" @click="closeTutor">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
          </svg>
        </button>
      </div>
    </header>

    <section v-if="showSetup" class="setup">
      <div class="seg" role="group" aria-label="Where the model runs">
        <button type="button" :class="{ on: tutor.backend === 'webllm' }" :aria-pressed="tutor.backend === 'webllm'" @click="setBackend('webllm')">In this browser</button>
        <button type="button" :class="{ on: tutor.backend === 'ollama' }" :aria-pressed="tutor.backend === 'ollama'" @click="setBackend('ollama')">Ollama</button>
      </div>

      <template v-if="tutor.backend === 'webllm'">
        <p v-if="tutor.gpu === 'no'" class="warn">
          This browser does not offer WebGPU, which the in-browser model needs. Use a recent Chrome or Edge, or switch to Ollama.
        </p>
        <fieldset v-else class="models">
          <legend>Pick a model</legend>
          <label v-for="c in MODEL_CHOICES" :key="c.key" class="model" :class="{ on: tutor.choice === c.key, off: !idFor(c) }">
            <input v-model="tutor.choice" type="radio" name="model" :value="c.key" :disabled="!idFor(c) || loading" />
            <span class="mname">
              {{ c.label }}
              <em v-if="idFor(c) && tutor.cached[idFor(c)!]" class="dl">downloaded</em>
            </span>
            <span class="mnote">{{ c.blurb }}</span>
            <span class="mmeta">
              <template v-if="gpuMemory(c, tutor.f16)">About {{ formatMb(gpuMemory(c, tutor.f16)!) }} of GPU memory</template>
              <template v-else>Needs a GPU with 16-bit shader support</template>
            </span>
          </label>
        </fieldset>
        <button v-if="tutor.gpu !== 'no'" type="button" class="primary" :disabled="loading || !currentModelId()" @click="start">
          {{ startLabel }}
        </button>
        <p class="fine">
          The download happens once and is kept in this browser. After that, the tutor works with no internet connection.
        </p>
        <button
          v-if="tutor.gpu === 'yes' && MODEL_CHOICES.some((c) => idFor(c) && tutor.cached[idFor(c)!])"
          type="button"
          class="link"
          @click="MODEL_CHOICES.filter((c) => idFor(c) && tutor.cached[idFor(c)!]).forEach(remove)"
        >
          Delete downloaded models
        </button>
      </template>

      <template v-else>
        <label class="f">
          <span>Ollama address</span>
          <input v-model="tutor.ollamaUrl" type="text" autocomplete="off" spellcheck="false" />
        </label>
        <label class="f">
          <span>Model name</span>
          <input v-model="tutor.ollamaModel" type="text" list="ollama-models" autocomplete="off" spellcheck="false" />
          <datalist id="ollama-models"><option v-for="m in ollamaModels" :key="m" :value="m" /></datalist>
        </label>
        <div class="row">
          <button type="button" class="link" @click="lookUpModels">See installed models</button>
          <button type="button" class="primary" :disabled="loading" @click="start">{{ loading ? 'Connecting' : 'Connect' }}</button>
        </div>
        <p v-if="ollamaNote" class="fine">{{ ollamaNote }}</p>
        <details class="fine">
          <summary>First time with Ollama?</summary>
          <ol>
            <li>Install Ollama from ollama.com and run <code>ollama pull gemma3:4b</code>.</li>
            <li>
              Start it so this page may talk to it: <code>OLLAMA_ORIGINS="*" ollama serve</code>
              (on macOS or Windows set the <code>OLLAMA_ORIGINS</code> environment variable, then restart the app).
            </li>
            <li>Press Connect. Everything stays on your computer.</li>
          </ol>
        </details>
      </template>

      <div v-if="loading" class="progress" role="status">
        <div class="track"><i :style="{ width: pct }" /></div>
        <p>{{ tutor.progressText }}</p>
      </div>
      <p v-if="tutor.error" class="err" role="alert">{{ tutor.error }}</p>
      <button v-if="tutor.ready && settingsOpen" type="button" class="link" @click="stopTutor">Stop the tutor and free the memory</button>
    </section>

    <div ref="chatEl" class="chat" aria-live="polite">
      <div v-if="!tutor.messages.length" class="empty">
        <p>Ask about a grammar page, a Czech sentence, or an exercise you missed. I answer in English.</p>
        <div class="chips">
          <button v-for="c in CHIPS" :key="c.label" type="button" @click="c.run()">{{ c.label }}</button>
        </div>
      </div>
      <article v-for="m in tutor.messages" :key="m.id" class="msg" :class="m.role">
        <div v-if="m.role === 'assistant'" class="md">
          <p v-if="!m.content" class="thinking">Thinking</p>
          <div v-else v-html="renderMarkdown(m.content)" />
        </div>
        <p v-else>{{ m.content }}</p>
      </article>
    </div>

    <p class="caveat">Small models slip up on Czech forms. Check anything important against the grammar notes.</p>

    <form class="composer" @submit.prevent="submit">
      <textarea
        ref="composerEl"
        v-model="tutor.input"
        rows="2"
        :placeholder="tutor.ready ? 'Ask in English or Czech' : 'Start the tutor above, then ask away'"
        aria-label="Message to the tutor"
        @keydown.enter.exact.prevent="submit"
      />
      <button v-if="tutor.generating" type="button" class="stop" @click="stopGenerating">Stop</button>
      <button v-else type="submit" class="send" :disabled="!tutor.ready || !tutor.input.trim()">Send</button>
    </form>
  </aside>
</template>

<style scoped>
.tutor {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 500;
  display: flex;
  flex-direction: column;
  width: min(430px, 100vw);
  height: 100dvh;
  background: var(--cz-card);
  color: var(--cz-ink);
  font-family: var(--cz-ui);
  border-left: 3px solid var(--cz-plate);
  box-shadow: -20px 0 50px -30px rgba(10, 22, 44, 0.6);
  transform: translateX(104%);
  visibility: hidden;
  transition: transform 0.25s ease, visibility 0s linear 0.25s;
}
.tutor.open {
  transform: none;
  visibility: visible;
  transition: transform 0.25s ease;
}
.head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
  padding: 14px 14px 12px 18px;
  border-bottom: 1.5px solid var(--cz-line);
}
.head h2 {
  margin: 0;
  padding: 0;
  border: 0;
  font: 700 24px/1.1 var(--cz-ui);
}
.status {
  margin: 3px 0 0;
  color: var(--cz-muted);
  font: 500 15px/1.2 var(--cz-ui);
}
.status.ready {
  color: var(--cz-green);
}
.status.error {
  color: var(--cz-red);
}
.hbtns {
  display: flex;
  align-items: center;
  gap: 4px;
}
.icon {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--cz-muted);
  cursor: pointer;
}
.icon:hover {
  background: var(--cz-blue-soft);
  color: var(--cz-ink);
}
.text,
.link {
  border: 0;
  background: none;
  padding: 4px 6px;
  color: var(--cz-blue);
  font: 600 15px/1.2 var(--cz-ui);
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}

.setup {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 62%;
  overflow-y: auto;
  padding: 14px 18px 16px;
  background: var(--cz-paper);
  border-bottom: 1.5px solid var(--cz-line);
}
.seg {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border: 2px solid var(--cz-primary);
  border-radius: 10px;
  overflow: hidden;
}
.seg button {
  padding: 9px 8px;
  border: 0;
  background: transparent;
  color: var(--cz-blue);
  font: 700 16px/1 var(--cz-ui);
  cursor: pointer;
}
.seg button.on {
  background: var(--cz-primary);
  color: #fff;
}
.models {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  border: 0;
  min-width: 0;
}
.models legend {
  margin-bottom: 6px;
  padding: 0;
  color: var(--cz-muted);
  font: 600 15px/1 var(--cz-ui);
}
.model {
  position: relative;
  display: grid;
  gap: 2px;
  padding: 10px 12px;
  border: 2px solid var(--cz-line);
  border-radius: 12px;
  background: var(--cz-card);
  cursor: pointer;
}
.model input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}
.model.on {
  border-color: var(--cz-blue);
  background: var(--cz-blue-soft);
}
.model:has(input:focus-visible) {
  outline: 3px solid var(--cz-blue);
  outline-offset: 2px;
}
.model.off {
  opacity: 0.55;
  cursor: not-allowed;
}
.mname {
  font: 700 18px/1.2 var(--cz-ui);
}
.dl {
  margin-left: 6px;
  padding: 0 7px;
  border-radius: 4px;
  background: var(--cz-green-soft);
  color: var(--cz-green);
  font: 600 13px/1.6 var(--cz-ui);
  font-style: normal;
}
.mnote {
  font: 500 15px/1.35 var(--cz-ui);
}
.mmeta {
  color: var(--cz-muted);
  font: 500 14px/1.3 var(--cz-ui);
}
.f {
  display: grid;
  gap: 4px;
}
.f > span {
  color: var(--cz-muted);
  font: 600 14px/1 var(--cz-ui);
}
.f input {
  padding: 9px 11px;
  border: 2px solid var(--cz-line);
  border-radius: 10px;
  background: var(--cz-card);
  color: var(--cz-ink);
  font: 500 16px/1.3 var(--cz-ui);
}
.f input:focus,
.composer textarea:focus {
  outline: none;
  border-color: var(--cz-blue);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--cz-blue) 22%, transparent);
}
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.primary {
  min-height: 44px;
  padding: 0 20px;
  border: 2px solid transparent;
  border-bottom: 4px solid var(--cz-primary-edge);
  border-radius: 12px;
  background: var(--cz-primary);
  color: #fff;
  font: 700 17px/1 var(--cz-ui);
  cursor: pointer;
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
.fine {
  margin: 0;
  color: var(--cz-muted);
  font: 500 14.5px/1.45 var(--cz-ui);
}
.fine code,
.warn code {
  padding: 0 4px;
  border-radius: 4px;
  background: var(--cz-blue-soft);
  color: var(--cz-ink);
  font-size: 0.92em;
  overflow-wrap: anywhere;
}
.fine ol {
  margin: 6px 0 0;
  padding-left: 20px;
}
.warn,
.err {
  margin: 0;
  padding: 10px 12px;
  border-radius: 10px;
  font: 500 15px/1.4 var(--cz-ui);
}
.warn {
  background: var(--cz-yellow-soft);
}
.err {
  background: var(--cz-red-soft);
  color: var(--cz-ink);
  border-left: 4px solid var(--cz-red);
  overflow-wrap: anywhere;
}
.progress p {
  margin: 6px 0 0;
  color: var(--cz-muted);
  font: 500 14px/1.35 var(--cz-ui);
  overflow-wrap: anywhere;
}
.track {
  height: 10px;
  border-radius: 5px;
  background: var(--cz-line);
  overflow: hidden;
}
.track i {
  display: block;
  height: 100%;
  background: var(--cz-blue);
  transition: width 0.3s;
}

.chat {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 18px;
}
.empty p {
  margin: 0 0 12px;
  color: var(--cz-muted);
  font: 500 17px/1.45 var(--cz-ui);
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.chips button {
  padding: 7px 14px;
  border: 2px solid var(--cz-line);
  border-radius: 999px;
  background: var(--cz-card);
  color: var(--cz-ink);
  font: 600 15px/1.2 var(--cz-ui);
  cursor: pointer;
}
.chips button:hover {
  border-color: var(--cz-blue);
  color: var(--cz-blue);
}
.msg {
  max-width: 92%;
  padding: 10px 14px;
  border-radius: 14px;
  font: 500 17px/1.5 var(--cz-ui);
  overflow-wrap: anywhere;
}
.msg p {
  margin: 0;
}
.msg.user {
  align-self: flex-end;
  background: var(--cz-primary);
  color: #fff;
  border-bottom-right-radius: 4px;
  white-space: pre-wrap;
}
.msg.assistant {
  align-self: flex-start;
  background: var(--cz-paper);
  border: 1.5px solid var(--cz-line);
  border-bottom-left-radius: 4px;
}
.md :deep(p) {
  margin: 0 0 8px;
}
.md :deep(p:last-child),
.md :deep(ul:last-child),
.md :deep(ol:last-child) {
  margin-bottom: 0;
}
.md :deep(ul),
.md :deep(ol) {
  margin: 0 0 8px;
  padding-left: 20px;
}
.md :deep(ul) {
  list-style: disc;
}
.md :deep(ol) {
  list-style: decimal;
}
.md :deep(li) {
  margin: 2px 0;
}
.md :deep(strong) {
  color: var(--cz-blue);
}
.md :deep(code) {
  padding: 0 4px;
  border-radius: 4px;
  background: var(--cz-blue-soft);
  font-size: 0.92em;
}
.md :deep(h1),
.md :deep(h2),
.md :deep(h3) {
  margin: 8px 0 4px;
  padding: 0;
  border: 0;
  font: 700 18px/1.2 var(--cz-ui);
}
.thinking::after {
  content: '';
  display: inline-block;
  width: 1.2em;
  text-align: left;
  animation: dots 1.2s steps(4, end) infinite;
}
@keyframes dots {
  0% { content: ''; }
  25% { content: '.'; }
  50% { content: '..'; }
  75% { content: '...'; }
}
.caveat {
  margin: 0;
  padding: 6px 18px 0;
  color: var(--cz-muted);
  font: 500 13.5px/1.35 var(--cz-ui);
}
.composer {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 10px 14px calc(14px + env(safe-area-inset-bottom));
}
.composer textarea {
  flex: 1;
  resize: none;
  padding: 9px 12px;
  border: 2px solid var(--cz-line);
  border-radius: 12px;
  background: var(--cz-paper);
  color: var(--cz-ink);
  font: 500 17px/1.35 var(--cz-ui);
}
.send,
.stop {
  min-height: 44px;
  padding: 0 18px;
  border: 2px solid transparent;
  border-bottom: 4px solid var(--cz-primary-edge);
  border-radius: 12px;
  background: var(--cz-primary);
  color: #fff;
  font: 700 17px/1 var(--cz-ui);
  cursor: pointer;
}
.stop {
  background: var(--cz-red);
  border-bottom-color: #8f1420;
  color: #fff;
}
.send:disabled {
  background: var(--cz-line);
  border-color: var(--cz-line);
  color: var(--cz-muted);
  cursor: not-allowed;
}
@media (prefers-reduced-motion: reduce) {
  .tutor,
  .tutor.open {
    transition: none;
  }
  .thinking::after {
    animation: none;
    content: '...';
  }
}
</style>
