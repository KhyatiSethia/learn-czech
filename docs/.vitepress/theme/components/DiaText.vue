<script setup lang="ts">
import { computed } from 'vue'
import { markSegments } from '../lib/text'

const props = defineProps<{
  text: string
  /** Compare against this text and underline the characters that differ. */
  against?: string
}>()

const groups = computed(() => {
  const out: { t: string; cls: string }[] = []
  for (const s of markSegments(props.text, props.against)) {
    const cls = [s.dia ? 'dia' : '', s.off ? 'off' : ''].filter(Boolean).join(' ')
    const last = out[out.length - 1]
    if (last && last.cls === cls) last.t += s.t
    else out.push({ t: s.t, cls })
  }
  return out
})
</script>

<template>
  <span lang="cs" class="dia-text"><span v-for="(g, i) in groups" :key="i" :class="g.cls || undefined">{{ g.t }}</span></span>
</template>

<style scoped>
.dia {
  color: var(--dia-color, var(--cz-red));
}
.off {
  text-decoration: underline wavy var(--cz-red);
  text-decoration-thickness: 2px;
  text-underline-offset: 0.18em;
  background: color-mix(in srgb, var(--cz-red) 16%, transparent);
  border-radius: 2px;
}
</style>
