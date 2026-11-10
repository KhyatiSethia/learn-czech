<script setup lang="ts">
import { computed, onMounted } from 'vue'
import type { Lang } from '../lib/lang'
import { initSpeech, speak, stopSpeaking, useSpeech } from '../lib/speech'
import { useStore } from '../lib/store'

const props = defineProps<{
  text: string
  lang: Lang
  /** Accessible name, e.g. "Hear the question". */
  label?: string
  /** Lets several buttons tell which one is playing. Defaults to the text. */
  id?: string
  small?: boolean
}>()

const { prefs } = useStore()
const sp = useSpeech()
onMounted(initSpeech)

const key = computed(() => props.id ?? `${props.lang}:${props.text}`)
const playing = computed(() => sp.speaking.value && sp.activeId.value === key.value)

async function toggle() {
  if (playing.value) {
    stopSpeaking()
    return
  }
  await speak(props.text, props.lang, {
    id: key.value,
    rate: prefs.value.rate,
    voices: { cs: prefs.value.csVoice, en: prefs.value.enVoice },
  })
}
defineExpose({ toggle })
</script>

<template>
  <button
    v-if="text.trim()"
    type="button"
    class="speak"
    :class="{ on: playing, small }"
    :aria-label="playing ? 'Stop' : (label ?? 'Listen')"
    :aria-pressed="playing"
    :title="playing ? 'Stop' : (label ?? 'Listen')"
    @click.stop="toggle"
  >
    <svg v-if="!playing" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.5 9.5v5h3.8l4.7 3.8V5.7L7.3 9.5H3.5z" fill="currentColor" />
      <path d="M15.5 8.5a4.5 4.5 0 010 7M18.2 6a8 8 0 010 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>
    <svg v-else viewBox="0 0 24 24" aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
    </svg>
  </button>
</template>

<style scoped>
.speak {
  flex: none;
  display: inline-grid;
  place-items: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 2px solid var(--cz-line);
  border-bottom-width: 4px;
  border-radius: 12px;
  background: var(--cz-card);
  color: var(--cz-blue);
  cursor: pointer;
  transition: transform 0.08s, border-color 0.12s, background 0.12s;
}
.speak svg {
  width: 24px;
  height: 24px;
}
.speak.small {
  width: 36px;
  height: 36px;
  border-radius: 10px;
}
.speak.small svg {
  width: 20px;
  height: 20px;
}
.speak:hover {
  border-color: var(--cz-blue);
}
.speak:active {
  transform: translateY(2px);
  border-bottom-width: 2px;
}
.speak.on {
  border-color: var(--cz-blue);
  background: var(--cz-blue-soft);
}
.speak:focus-visible {
  outline: 3px solid var(--cz-blue);
  outline-offset: 2px;
}
</style>
