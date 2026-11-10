<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Lang } from '../lib/lang'
import { LANG_NAME } from '../lib/lang'
import {
  initSpeech,
  pauseSpeaking,
  resumeSpeaking,
  speakParts,
  stopSpeaking,
  toParts,
  useSpeech,
  voicesFor,
} from '../lib/speech'
import { openTutor } from '../lib/tutor'
import { useStore } from '../lib/store'
import CzechKeys from './CzechKeys.vue'
import AudioNotice from './AudioNotice.vue'

type Choice = Lang | 'auto'

const KEY = 'czech.listen.v1'
const store = useStore()
const { prefs } = store
const sp = useSpeech()

const text = ref('')
const lang = ref<Choice>('cs')
const loop = ref(false)
const current = ref(-1)
const pasteNote = ref('')
const copied = ref(false)
const area = ref<HTMLTextAreaElement | null>(null)
const voicesBox = ref<HTMLDetailsElement | null>(null)
const ready = ref(false)

const parts = computed(() => toParts(text.value, lang.value))
const chars = computed(() => text.value.length)
const csVoices = computed(() => voicesFor(sp.voices.value, 'cs'))
const enVoices = computed(() => voicesFor(sp.voices.value, 'en'))
const needed = computed<Lang[]>(() => Array.from(new Set(parts.value.map((p) => p.lang))))
const missing = computed(() => (sp.voices.value.length ? needed.value.filter((l) => !sp.hasVoice(l)) : []))
const playing = computed(() => sp.speaking.value && sp.activeId.value === 'reader')
const paused = computed(() => playing.value && sp.paused.value)

onMounted(() => {
  store.init()
  initSpeech()
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    if (typeof saved.text === 'string') text.value = saved.text
    if (saved.lang === 'cs' || saved.lang === 'en' || saved.lang === 'auto') lang.value = saved.lang
    if (typeof saved.loop === 'boolean') loop.value = saved.loop
  } catch {
    /* nothing saved yet */
  }
  ready.value = true
  if (location.hash === '#voices') {
    if (voicesBox.value) voicesBox.value.open = true
    nextTick(() => document.getElementById('voices')?.scrollIntoView({ block: 'start' }))
  }
})
onBeforeUnmount(stopSpeaking)

watch([text, lang, loop], () => {
  if (!ready.value) return
  try {
    localStorage.setItem(KEY, JSON.stringify({ text: text.value, lang: lang.value, loop: loop.value }))
  } catch {
    /* storage blocked: the page still works */
  }
})

const voiceMap = () => ({ cs: prefs.value.csVoice, en: prefs.value.enVoice })

async function play(from = 0) {
  if (!parts.value.length) return
  const list = parts.value.slice(from)
  const result = await speakParts(list, {
    id: 'reader',
    rate: prefs.value.rate,
    voices: voiceMap(),
    onPart: (i) => (current.value = from + i),
  })
  if (result === 'cancelled') return
  current.value = -1
  if (result === 'done' && loop.value && parts.value.length) void play(0)
}

function toggle() {
  if (playing.value) {
    if (paused.value) resumeSpeaking()
    else pauseSpeaking()
    return
  }
  void play(0)
}
function stop() {
  stopSpeaking()
  current.value = -1
}

// Changing the speed takes effect from the sentence being read.
function onRate() {
  store.savePrefs()
  if (playing.value && current.value >= 0) void play(current.value)
}
function onVoice() {
  store.savePrefs()
  if (playing.value && current.value >= 0) void play(current.value)
}

function insertChar(ch: string) {
  const el = area.value
  if (!el) return
  const start = el.selectionStart ?? text.value.length
  const end = el.selectionEnd ?? start
  text.value = text.value.slice(0, start) + ch + text.value.slice(end)
  nextTick(() => {
    el.focus()
    el.setSelectionRange(start + 1, start + 1)
  })
}

async function paste() {
  pasteNote.value = ''
  try {
    const clip = await navigator.clipboard.readText()
    if (clip.trim()) {
      text.value = clip
      stop()
    } else pasteNote.value = 'The clipboard is empty.'
  } catch {
    pasteNote.value = 'Your browser did not allow that. Click in the box and press Ctrl+V (Cmd+V on a Mac).'
    area.value?.focus()
  }
}
async function copy() {
  try {
    await navigator.clipboard.writeText(text.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1600)
  } catch {
    area.value?.select()
  }
}
function clear() {
  stop()
  text.value = ''
  area.value?.focus()
}

function explain() {
  const t = text.value.trim().slice(0, 1500)
  if (!t) return
  openTutor(`Explain this text in English, sentence by sentence. Point out the grammar worth learning:\n\n${t}`, { send: true })
}

function onKey(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault()
    toggle()
  }
}

const langOptions: { value: Choice; name: string }[] = [
  { value: 'cs', name: 'Czech' },
  { value: 'en', name: 'English' },
  { value: 'auto', name: 'Detect each sentence' },
]
</script>

<template>
  <div class="reader">
    <header class="masthead">
      <h1>Listen</h1>
      <p>Paste or type Czech or English text and hear it read aloud, sentence by sentence. Your browser does the speaking, so it works offline once the page has been saved.</p>
    </header>

    <p v-if="ready && !sp.supported.value" class="warn" role="alert">
      This browser cannot read text aloud. Current Edge, Chrome and Safari can, on Windows, macOS, Android and iPhone.
    </p>

    <section class="input">
      <div class="lang" role="radiogroup" aria-label="Language of the text">
        <label v-for="o in langOptions" :key="o.value" :class="{ on: lang === o.value }">
          <input v-model="lang" type="radio" name="lang" :value="o.value" />
          <span>{{ o.name }}</span>
        </label>
      </div>

      <textarea
        ref="area"
        v-model="text"
        class="field"
        rows="7"
        spellcheck="false"
        :lang="lang === 'auto' ? undefined : lang"
        aria-label="Text to read aloud"
        placeholder="Paste text here. For example: Dobrý den, jmenuji se Jana a bydlím v Praze."
        @keydown="onKey"
      />

      <div class="row">
        <button type="button" class="ghost" @click="paste">Paste</button>
        <button type="button" class="ghost" :disabled="!text" @click="copy">{{ copied ? 'Copied' : 'Copy text' }}</button>
        <button type="button" class="ghost" :disabled="!text" @click="clear">Clear</button>
        <span class="count">{{ chars }} {{ chars === 1 ? 'character' : 'characters' }}, {{ parts.length }} {{ parts.length === 1 ? 'sentence' : 'sentences' }}</span>
      </div>
      <p v-if="pasteNote" class="note" role="status">{{ pasteNote }}</p>
      <CzechKeys @insert="insertChar" />
    </section>

    <section class="player" aria-label="Playback">
      <div class="transport">
        <button type="button" class="primary" :disabled="!parts.length || !sp.supported.value" @click="toggle">
          {{ !playing ? 'Read aloud' : paused ? 'Resume' : 'Pause' }}
        </button>
        <button type="button" class="ghost" :disabled="!playing" @click="stop">Stop</button>
        <label class="loop"><input v-model="loop" type="checkbox" /> Repeat</label>
      </div>

      <label class="speed">
        <span>Speed <b>{{ prefs.rate.toFixed(2).replace(/0$/, '') }}×</b></span>
        <input v-model.number="prefs.rate" type="range" min="0.5" max="1.3" step="0.05" aria-label="Speech speed" @change="onRate" />
      </label>

      <p v-if="missing.length" class="warn">
        This device has no {{ missing.map((l) => LANG_NAME[l]).join(' or ') }} voice, so that part will stay silent.
        <a href="#voices" @click="voicesBox && (voicesBox.open = true)">How to add one</a>
      </p>
      <AudioNotice />
    </section>

    <section v-if="parts.length" class="sentences" aria-label="Sentences">
      <h2>Tap a sentence to hear it</h2>
      <ol>
        <li v-for="(p, i) in parts" :key="i + p.text" :class="{ now: current === i }">
          <button type="button" :lang="p.lang" :aria-current="current === i ? 'true' : undefined" @click="play(i)">
            <span class="tag" :class="p.lang">{{ p.lang === 'cs' ? 'CZ' : 'EN' }}</span>
            <span class="s">{{ p.text }}</span>
          </button>
        </li>
      </ol>
      <p class="tools">
        <button type="button" class="link" @click="explain">Ask the tutor to explain this text</button>
      </p>
    </section>

    <details id="voices" ref="voicesBox" class="help">
      <summary>Voices, and how to add a Czech one</summary>

      <div class="pick" v-if="sp.supported.value">
        <label>
          <span>Czech voice</span>
          <select v-model="prefs.csVoice" :disabled="!csVoices.length" @change="onVoice">
            <option value="">{{ csVoices.length ? 'Best available' : 'None installed' }}</option>
            <option v-for="v in csVoices" :key="v.voiceURI" :value="v.voiceURI">{{ v.name }}</option>
          </select>
        </label>
        <label>
          <span>English voice</span>
          <select v-model="prefs.enVoice" :disabled="!enVoices.length" @change="onVoice">
            <option value="">{{ enVoices.length ? 'Best available' : 'None installed' }}</option>
            <option v-for="v in enVoices" :key="v.voiceURI" :value="v.voiceURI">{{ v.name }}</option>
          </select>
        </label>
      </div>

      <p>The voices come from your device or browser, not from this site, so what you hear depends on what is installed.</p>
      <ul>
        <li><b>Microsoft Edge</b> has natural-sounding online voices for Czech that need no setup. This is the easiest way to get good audio on Windows.</li>
        <li><b>Windows:</b> Settings, Time &amp; language, Speech, Add voices, then pick Czech. Restart the browser afterwards.</li>
        <li><b>Mac and iPhone:</b> Settings, Accessibility, Spoken Content, Voices, Czech, then download one. The voice shows up in Safari and Chrome after a restart.</li>
        <li><b>Android:</b> install or update Google Text-to-Speech, then in its settings download Czech.</li>
        <li><b>Linux:</b> install speech-dispatcher and a Czech voice such as espeak-ng. Voices there sound robotic.</li>
      </ul>
      <p>If Czech is missing from the list above, the browser cannot read Czech at all on this device, and a different browser may help.</p>
    </details>
  </div>
</template>

<style scoped>
.reader {
  max-width: 860px;
  margin: 0 auto;
  padding: 40px 24px 90px;
  font-family: var(--cz-ui);
  color: var(--cz-ink);
}
.masthead {
  padding-bottom: 20px;
  border-bottom: 4px solid var(--cz-plate);
}
h1 {
  margin: 0 0 8px;
  font: 700 clamp(38px, 6vw, 56px) / 1 var(--cz-ui);
  letter-spacing: -0.01em;
  color: var(--cz-ink);
}
.masthead p {
  margin: 0;
  max-width: 620px;
  font: 500 19px/1.45 var(--cz-ui);
  color: var(--cz-muted);
}
h2 {
  margin: 0 0 8px;
  padding: 0;
  border: 0;
  font: 700 22px/1.2 var(--cz-ui);
  letter-spacing: 0;
}

.input,
.player,
.sentences {
  margin-top: 26px;
}
.lang {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 12px;
}
.lang label {
  position: relative;
  padding: 9px 16px;
  border: 2px solid var(--cz-line);
  border-radius: 10px;
  font: 700 17px/1 var(--cz-ui);
  cursor: pointer;
}
.lang label.on {
  border-color: var(--cz-blue);
  background: var(--cz-blue-soft);
}
.lang input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}
.lang label:has(input:focus-visible) {
  outline: 3px solid var(--cz-blue);
  outline-offset: 2px;
}
.field {
  width: 100%;
  min-height: 160px;
  padding: 14px 16px;
  border: 2px solid var(--cz-line);
  border-radius: 12px;
  background: var(--cz-card);
  color: var(--cz-ink);
  font: 500 21px/1.5 var(--cz-ui);
  resize: vertical;
}
.field:focus {
  outline: none;
  border-color: var(--cz-blue);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--cz-blue) 22%, transparent);
}
.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}
.count {
  margin-left: auto;
  color: var(--cz-muted);
  font: 500 15px/1 var(--cz-ui);
}
.note {
  margin: 8px 0 0;
  color: var(--cz-muted);
  font: 500 15px/1.4 var(--cz-ui);
}
.warn {
  margin: 14px 0 0;
  padding: 9px 13px;
  border-radius: 10px;
  background: var(--cz-yellow-soft);
  font: 500 16px/1.4 var(--cz-ui);
}
.warn a {
  color: var(--cz-blue);
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.player {
  padding: 16px 18px 18px;
  border: 2px solid var(--cz-line);
  border-bottom-width: 4px;
  border-radius: 14px;
  background: var(--cz-card);
}
.transport {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 14px;
}
.loop {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font: 600 17px/1 var(--cz-ui);
  cursor: pointer;
}
.loop input {
  width: 20px;
  height: 20px;
  accent-color: var(--cz-primary);
}
.speed {
  display: grid;
  gap: 6px;
  margin-top: 16px;
  max-width: 380px;
}
.speed span {
  color: var(--cz-muted);
  font: 600 16px/1 var(--cz-ui);
}
.speed b {
  color: var(--cz-ink);
}
.speed input {
  width: 100%;
  accent-color: var(--cz-primary);
}

.sentences ol {
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: 1.5px solid var(--cz-line);
}
.sentences li {
  border-bottom: 1.5px solid var(--cz-line);
  transition: background 0.2s;
}
.sentences li.now {
  background: var(--cz-yellow-soft);
  box-shadow: inset 4px 0 0 var(--cz-yellow);
}
.sentences li button {
  display: flex;
  align-items: baseline;
  gap: 12px;
  width: 100%;
  padding: 12px 10px;
  border: 0;
  background: transparent;
  color: var(--cz-ink);
  text-align: left;
  cursor: pointer;
}
.sentences li button:hover .s {
  text-decoration: underline;
  text-underline-offset: 4px;
}
.sentences li button:focus-visible {
  outline: 3px solid var(--cz-blue);
  outline-offset: -3px;
}
.tag {
  flex: none;
  min-width: 34px;
  padding: 1px 0;
  border-radius: 5px;
  background: var(--cz-blue-soft);
  color: var(--cz-blue);
  font: 700 13px/1.5 var(--cz-ui);
  text-align: center;
}
.tag.en {
  background: var(--cz-line);
  color: var(--cz-muted);
}
.s {
  font: 500 21px/1.45 var(--cz-ui);
  overflow-wrap: anywhere;
}
.tools {
  margin: 12px 0 0;
}

.help {
  margin-top: 30px;
  font: 500 17px/1.5 var(--cz-ui);
  color: var(--cz-muted);
}
.help summary {
  cursor: pointer;
  color: var(--cz-ink);
  font-weight: 700;
  font-size: 19px;
}
.help ul {
  margin: 8px 0;
  list-style: disc;
  padding-left: 22px;
}
.help li {
  margin: 4px 0;
}
.help b {
  color: var(--cz-ink);
}
.pick {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin: 14px 0;
}
.pick label {
  display: grid;
  gap: 5px;
}
.pick span {
  font: 600 15px/1 var(--cz-ui);
}
.pick select {
  width: 100%;
  padding: 9px 10px;
  border: 2px solid var(--cz-line);
  border-radius: 10px;
  background: var(--cz-paper);
  color: var(--cz-ink);
  font: 500 16px/1.3 var(--cz-ui);
}

.primary,
.ghost {
  min-height: 46px;
  padding: 0 22px;
  border-radius: 12px;
  border: 2px solid transparent;
  font: 700 18px/1 var(--cz-ui);
  cursor: pointer;
  transition: transform 0.08s, filter 0.12s;
}
.primary {
  background: var(--cz-primary);
  color: #fff;
  border-bottom: 4px solid var(--cz-primary-edge);
}
.primary:hover:not(:disabled) {
  filter: brightness(1.08);
}
.primary:active:not(:disabled) {
  transform: translateY(2px);
  border-bottom-width: 2px;
}
.primary:disabled {
  background: var(--cz-line);
  border-color: var(--cz-line);
  color: var(--cz-muted);
  cursor: not-allowed;
}
.ghost {
  min-height: 40px;
  padding: 0 16px;
  background: transparent;
  color: var(--cz-muted);
  border-color: var(--cz-line);
  font-size: 16px;
}
.ghost:hover:not(:disabled) {
  color: var(--cz-ink);
  border-color: var(--cz-muted);
}
.ghost:disabled {
  opacity: 0.5;
  cursor: default;
}
.link {
  border: 0;
  background: none;
  padding: 0;
  color: var(--cz-blue);
  font: 600 17px/1.2 var(--cz-ui);
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}

@media (max-width: 600px) {
  .reader {
    padding: 28px 16px 70px;
  }
  .pick {
    grid-template-columns: 1fr;
  }
  .count {
    flex-basis: 100%;
    margin-left: 0;
  }
}
</style>
