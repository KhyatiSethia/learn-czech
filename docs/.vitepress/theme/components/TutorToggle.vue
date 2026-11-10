<script setup lang="ts">
import { tutor, openTutor, closeTutor } from '../lib/tutor'

defineProps<{ variant: 'nav' | 'fab' }>()

function toggle() {
  if (tutor.open) closeTutor()
  else openTutor()
}
</script>

<template>
  <button
    type="button"
    class="toggle"
    :class="variant"
    :aria-expanded="tutor.open"
    aria-controls="tutor-drawer"
    @click="toggle"
  >
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4A2.5 2.5 0 0 1 4 13.5z" fill="currentColor" />
    </svg>
    <span>Tutor</span>
  </button>
</template>

<style scoped>
.toggle {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 36px;
  padding: 0 14px;
  border: 2px solid var(--cz-primary);
  border-radius: 10px;
  background: transparent;
  color: var(--cz-blue);
  font: 700 16px/1 var(--cz-ui);
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.toggle:hover,
.toggle[aria-expanded='true'] {
  background: var(--cz-primary);
  color: #fff;
}
.nav {
  margin-left: 10px;
}
.fab {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 200;
  height: 46px;
  background: var(--cz-primary);
  color: #fff;
  box-shadow: 0 10px 24px -10px rgba(10, 22, 44, 0.7);
}
@media (max-width: 959px) {
  .nav {
    display: none;
  }
}
@media (min-width: 960px) {
  .fab {
    display: none;
  }
}
</style>
