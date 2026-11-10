<script setup lang="ts">
import { withBase } from 'vitepress'
import { LANG_NAME } from '../lib/lang'
import { clearSpeechProblem, useSpeech } from '../lib/speech'

const { problem } = useSpeech()
</script>

<template>
  <p v-if="problem" class="notice" role="status">
    <span v-if="problem.reason === 'unsupported'">This browser cannot read text aloud. Edge, Chrome and Safari can.</span>
    <span v-else-if="problem.reason === 'no-voice'">
      No {{ LANG_NAME[problem.lang] }} voice is installed on this device.
      <a :href="withBase('/listen#voices')" target="_blank" rel="noopener">How to add one</a>
    </span>
    <span v-else>
      The voice did not start. Try again, or choose another voice on the
      <a :href="withBase('/listen#voices')" target="_blank" rel="noopener">Listen page</a>.
    </span>
    <button type="button" aria-label="Dismiss" @click="clearSpeechProblem()">
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" /></svg>
    </button>
  </p>
</template>

<style scoped>
.notice {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 12px 0 0;
  padding: 10px 12px 10px 14px;
  border-radius: 10px;
  background: var(--cz-yellow-soft);
  color: var(--cz-ink);
  font: 500 16px/1.4 var(--cz-ui);
}
.notice span {
  flex: 1;
}
.notice a {
  color: var(--cz-blue);
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.notice button {
  flex: none;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--cz-muted);
  cursor: pointer;
}
.notice button:hover {
  color: var(--cz-ink);
}
</style>
