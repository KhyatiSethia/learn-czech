<script setup lang="ts">
import DiaText from './DiaText.vue'
</script>

<template>
  <div class="plate" aria-hidden="true">
    <i class="screw tl" /><i class="screw tr" /><i class="screw bl" /><i class="screw br" />
    <p class="cs"><DiaText text="Mluvíš česky?" /></p>
    <p class="en">Do you speak Czech?</p>
  </div>
</template>

<style scoped>
.plate {
  --dia-color: #f4b400;
  position: relative;
  width: min(340px, 78vw);
  aspect-ratio: 1.55;
  display: grid;
  place-content: center;
  gap: 4px;
  text-align: center;
  color: #fff;
  background: #11457e;
  border-radius: 18px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.28), 0 22px 40px -22px rgba(16, 33, 63, 0.7);
  transform: rotate(-2deg);
  overflow: hidden;
}
.plate::before {
  content: '';
  position: absolute;
  inset: 11px;
  border: 3px solid #fff;
  border-radius: 10px;
}
/* a slice of "enamel" sheen */
.plate::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(115deg, rgba(255, 255, 255, 0.14) 0 24%, transparent 24.5%);
  pointer-events: none;
}
.cs {
  margin: 0;
  font: 700 46px/1.05 var(--cz-ui);
  letter-spacing: 0.005em;
}
.en {
  margin: 0;
  font: 500 17px/1.2 var(--cz-ui);
  color: #bcd0ea;
}
.screw {
  position: absolute;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #0a2d56;
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.35);
}
.tl { left: 20px; top: 20px; }
.tr { right: 20px; top: 20px; }
.bl { left: 20px; bottom: 20px; }
.br { right: 20px; bottom: 20px; }
</style>
