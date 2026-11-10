<script setup lang="ts">
import { computed, ref } from 'vue'

const emit = defineEmits<{ insert: [ch: string] }>()
const LOWER = ['á', 'č', 'ď', 'é', 'ě', 'í', 'ň', 'ó', 'ř', 'š', 'ť', 'ú', 'ů', 'ý', 'ž']
const upper = ref(false)
const keys = computed(() => (upper.value ? LOWER.map((k) => k.toLocaleUpperCase('cs')) : LOWER))
</script>

<template>
  <div class="keys" role="group" aria-label="Czech letters">
    <button
      v-for="k in keys"
      :key="k"
      type="button"
      class="key"
      tabindex="-1"
      :aria-label="`Insert ${k}`"
      @mousedown.prevent
      @click="emit('insert', k)"
    >
      {{ k }}
    </button>
    <button
      type="button"
      class="key shift"
      tabindex="-1"
      :aria-pressed="upper"
      aria-label="Capital letters"
      @mousedown.prevent
      @click="upper = !upper"
    >
      Aa
    </button>
  </div>
</template>

<style scoped>
.keys {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
}
.key {
  min-width: 38px;
  height: 40px;
  padding: 0 8px;
  border: 1.5px solid var(--cz-line);
  border-bottom-width: 3px;
  border-radius: 8px;
  background: var(--cz-card);
  color: var(--cz-ink);
  font: 600 20px/1 var(--cz-ui);
  cursor: pointer;
  transition: transform 0.06s, border-color 0.12s;
}
.key:hover {
  border-color: var(--cz-blue);
}
.key:active {
  transform: translateY(2px);
  border-bottom-width: 1.5px;
}
.shift {
  font-size: 15px;
  color: var(--cz-muted);
}
.shift[aria-pressed='true'] {
  background: var(--cz-blue-soft);
  color: var(--cz-blue);
  border-color: var(--cz-blue);
}
</style>
