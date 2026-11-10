<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { Deck, Mode } from '../lib/types'
import type { Prefs } from '../lib/store'
import { wordsOf } from '../lib/session'

const props = defineProps<{ deck: Deck; prefs: Prefs }>()
const emit = defineEmits<{ start: []; close: []; change: [] }>()

const dlg = ref<HTMLDialogElement | null>(null)
onMounted(() => dlg.value?.showModal())

const canChoose = computed(() => props.deck.items.length >= 3)
const canBuild = computed(() => props.deck.items.some((i) => wordsOf(i.a[0]).length >= 3))

const MODES: { value: Mode; name: string; note: string }[] = [
  { value: 'mixed', name: 'Mixed', note: 'A bit of everything' },
  { value: 'type', name: 'Type it', note: 'Write each answer' },
  { value: 'choice', name: 'Pick one', note: 'Choose from several' },
  { value: 'tiles', name: 'Build it', note: 'Put words in order' },
]
function disabled(m: Mode) {
  return (m === 'choice' && !canChoose.value) || (m === 'tiles' && !canBuild.value)
}
const LENGTHS = [
  { value: 5, name: '5' },
  { value: 10, name: '10' },
  { value: 20, name: '20' },
  { value: 0, name: 'All' },
]
const count = computed(() => (props.prefs.length ? Math.min(props.prefs.length, props.deck.items.length) : props.deck.items.length))
</script>

<template>
  <dialog ref="dlg" class="dlg" aria-labelledby="setup-title" @close="emit('close')" @click.self="dlg?.close()">
    <form class="box" @submit.prevent="emit('start')" @change="emit('change')">
      <header>
        <h2 id="setup-title">{{ deck.title }}</h2>
        <p class="sub">{{ deck.items.length }} questions in this set</p>
      </header>

      <fieldset>
        <legend>Question style</legend>
        <div class="grid">
          <label v-for="m in MODES" :key="m.value" class="opt" :class="{ off: disabled(m.value) }">
            <input v-model="prefs.mode" type="radio" name="mode" :value="m.value" :disabled="disabled(m.value)" />
            <span class="name">{{ m.name }}</span>
            <span class="note">{{ disabled(m.value) ? (m.value === 'tiles' ? 'Needs answers of 3+ words' : 'Needs 3+ questions') : m.note }}</span>
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>How many questions</legend>
        <div class="row">
          <label v-for="l in LENGTHS" :key="l.value" class="pill">
            <input v-model="prefs.length" type="radio" name="len" :value="l.value" />
            <span>{{ l.name }}</span>
          </label>
        </div>
      </fieldset>

      <fieldset class="switches">
        <label><input v-model="prefs.hearts" type="checkbox" /> <span><b>Three hearts.</b> Each miss costs one; the run ends at zero.</span></label>
        <label><input v-model="prefs.strict" type="checkbox" /> <span><b>Strict marks.</b> Treat <i lang="cs">č</i> and <i>c</i> as different letters.</span></label>
        <label><input v-model="prefs.sound" type="checkbox" /> <span><b>Sound effects.</b></span></label>
      </fieldset>

      <footer>
        <button type="button" class="ghost" @click="dlg?.close()">Cancel</button>
        <button type="submit" class="primary">Start with {{ count }} {{ count === 1 ? 'question' : 'questions' }}</button>
      </footer>
    </form>
  </dialog>
</template>

<style scoped>
.dlg {
  width: min(560px, calc(100vw - 24px));
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
  gap: 16px;
  padding: 24px 26px 22px;
}
h2 {
  margin: 0;
  border: 0;
  padding: 0;
  font: 700 28px/1.15 var(--cz-ui);
}
.sub {
  margin: 4px 0 0;
  color: var(--cz-muted);
  font: 500 17px/1.3 var(--cz-ui);
}
fieldset {
  margin: 0;
  padding: 0;
  border: 0;
  min-width: 0;
}
legend {
  margin-bottom: 8px;
  padding: 0;
  font: 600 16px/1 var(--cz-ui);
  color: var(--cz-muted);
}
.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.opt {
  position: relative;
  display: grid;
  gap: 2px;
  padding: 10px 14px;
  border: 2px solid var(--cz-line);
  border-radius: 12px;
  cursor: pointer;
}
.opt input,
.pill input {
  position: absolute;
  opacity: 0;
  inset: 0;
  cursor: pointer;
}
.opt:has(input:checked),
.pill:has(input:checked) {
  border-color: var(--cz-blue);
  background: var(--cz-blue-soft);
}
.opt:has(input:focus-visible),
.pill:has(input:focus-visible) {
  outline: 3px solid var(--cz-blue);
  outline-offset: 2px;
}
.opt.off {
  opacity: 0.5;
  cursor: not-allowed;
}
.name {
  font: 700 19px/1.2 var(--cz-ui);
}
.note {
  color: var(--cz-muted);
  font: 500 15px/1.3 var(--cz-ui);
}
.row {
  display: flex;
  gap: 10px;
}
.pill {
  position: relative;
  min-width: 56px;
  padding: 9px 16px;
  border: 2px solid var(--cz-line);
  border-radius: 10px;
  text-align: center;
  font: 700 18px/1 var(--cz-ui);
  cursor: pointer;
}
.switches {
  display: grid;
  gap: 10px;
}
.switches label {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  font: 500 17px/1.35 var(--cz-ui);
  cursor: pointer;
}
.switches input {
  width: 20px;
  height: 20px;
  margin-top: 2px;
  accent-color: var(--cz-primary);
}
footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
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
.primary:hover {
  filter: brightness(1.08);
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
@media (max-width: 480px) {
  .grid {
    grid-template-columns: 1fr;
  }
  .box {
    padding: 18px 16px;
  }
}
</style>
