<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ total: number; done: number }>()

const pct = computed(() => (props.total ? Math.min(100, (props.done / props.total) * 100) : 0))
// Individual stops stay readable up to a couple of dozen questions; beyond that it is just a line.
const stops = computed(() => (props.total && props.total <= 24 ? Array.from({ length: props.total + 1 }, (_, i) => i) : []))
</script>

<template>
  <div
    class="route"
    role="progressbar"
    :aria-valuemin="0"
    :aria-valuemax="total"
    :aria-valuenow="done"
    :aria-label="`${done} of ${total} stops reached`"
  >
    <div class="line"><div class="fill" :style="{ width: pct + '%' }" /></div>
    <span
      v-for="i in stops"
      :key="i"
      class="stop"
      :class="{ passed: i <= done, end: i === total }"
      :style="{ left: (i / total) * 100 + '%' }"
    />
    <svg class="tram" :style="{ left: pct + '%' }" viewBox="0 0 30 24" width="30" height="24" aria-hidden="true">
      <path d="M15 5.5V2.5M10 2.5h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none" />
      <rect x="1.5" y="5.5" width="27" height="13" rx="3.2" fill="#f4b400" />
      <rect x="4.5" y="8.5" width="5.5" height="5" rx="1" fill="#10213f" />
      <rect x="12.25" y="8.5" width="5.5" height="5" rx="1" fill="#10213f" />
      <rect x="20" y="8.5" width="5.5" height="5" rx="1" fill="#10213f" />
      <rect x="1.5" y="15" width="27" height="1.6" fill="#c8202f" />
      <circle cx="8.5" cy="20.6" r="2.1" fill="currentColor" />
      <circle cx="21.5" cy="20.6" r="2.1" fill="currentColor" />
    </svg>
  </div>
</template>

<style scoped>
.route {
  position: relative;
  flex: 1;
  height: 38px;
  margin: 0 16px;
  color: var(--cz-ink);
}
.line {
  position: absolute;
  left: 0;
  right: 0;
  top: 29px;
  height: 4px;
  border-radius: 2px;
  background: var(--cz-line);
}
.fill {
  height: 100%;
  border-radius: 2px;
  background: var(--cz-blue);
  transition: width 0.55s cubic-bezier(0.3, 1.25, 0.5, 1);
}
.stop {
  position: absolute;
  top: 26px;
  width: 10px;
  height: 10px;
  margin-left: -5px;
  border-radius: 50%;
  background: var(--cz-paper);
  border: 2px solid var(--cz-line);
  transition: border-color 0.3s, background 0.3s;
}
.stop.end {
  width: 14px;
  height: 14px;
  margin-left: -7px;
  top: 24px;
  border-radius: 4px;
}
.stop.passed {
  border-color: var(--cz-blue);
  background: var(--cz-blue);
}
.tram {
  position: absolute;
  top: 0;
  margin-left: -15px;
  transition: left 0.55s cubic-bezier(0.3, 1.25, 0.5, 1);
}
@media (prefers-reduced-motion: reduce) {
  .fill,
  .tram,
  .stop {
    transition: none;
  }
}
</style>
