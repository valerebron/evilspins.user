<template>
  <article class="print-card"
    :class="[`face-${face}`, { 'back-mirror': face === 'back' && backAlignment === 'mirror', 'rounded-front': face === 'front' && roundedFront }]"
    :style="cardStyle" aria-hidden="true">
    <div class="trim-card" :style="{ borderRadius: face === 'front' ? (roundedFront ? '3.6mm' : '0') : '0' }">
      <template v-if="card">
        <CardElement class="card-element-print" :card="card" :is-face-up="face === 'front'" :is-loading="false"
          role="img" tabindex="-1" />
      </template>

      <template v-else>
        <div class="empty-slot">Vide</div>
      </template>
    </div>
  </article>
</template>

<script setup lang="ts">
import { CARD_MM } from '~/utils/print'
import CardElement from '~/components/CardElement.vue'
import type { PrintCardItem } from '~/utils/print'

const props = withDefaults(
  defineProps<{
    card: PrintCardItem | null
    face: 'front' | 'back'
    backAlignment?: 'mirror' | 'aligned'
    roundedFront?: boolean
  }>(),
  {
    card: null,
    backAlignment: 'mirror',
    roundedFront: true,
  },
)

const cardStyle = computed(() => {
  return {
    '--card-width-mm': `${CARD_MM.width}mm`,
    '--card-height-mm': `${CARD_MM.height}mm`,
  }
})
</script>

<style scoped>
.print-card {
  width: var(--card-width-mm);
  height: var(--card-height-mm);
  box-sizing: border-box;
}

.trim-card {
  position: relative;
  width: var(--card-width-mm);
  height: var(--card-height-mm);
  border-radius: 3.6mm;
  overflow: hidden;
  background: #ffffff;
}

.empty-slot {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  font-size: 3mm;
  color: rgba(71, 85, 105, 0.74);
  border-radius: 3.2mm;
  border: 0.2mm dashed rgba(148, 163, 184, 0.6);
  background: rgba(255, 255, 255, 0.72);
}

.card-element-print {
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.print-card :deep(.card-element) {
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.print-card :deep(.face-up),
.print-card :deep(.face-down) {
  border-radius: 3.2mm;
}

.print-card.face-front:not(.rounded-front) :deep(.face-up) {
  border-radius: 0;
}

.print-card :deep(.face-up),
.print-card :deep(.face-down) {
  background: transparent !important;
  border: 0 !important;
  box-shadow: none !important;
}

.print-card.face-front :deep(.face-up) {
  padding: 2.6mm !important;
}

.print-card.face-back :deep(.face-down) {
  padding: 0 !important;
}

.print-card.face-front :deep(.face-up .cover),
.print-card.face-back :deep(.face-down .cover) {
  border-radius: 3.2mm;
}

.print-card.face-front:not(.rounded-front) :deep(.face-up .cover) {
  border-radius: 0;
}

.print-card.face-front :deep(.face-up .cover-image),
.print-card.face-back :deep(.face-down .cover-image) {
  border-radius: 3.2mm;
}

.print-card.face-front:not(.rounded-front) :deep(.face-up .cover-image) {
  border-radius: 0;
}

.print-card.face-back .trim-card {
  border-radius: 0;
}

.print-card.face-back :deep(.face-down),
.print-card.face-back :deep(.face-down .cover),
.print-card.face-back :deep(.face-down .cover-image) {
  border-radius: 0;
}

.print-card.back-mirror :deep(.card-element) {
  transform: rotate(180deg);
}

.print-card :deep(.face-up:hover),
.print-card :deep(.face-down:hover) {
  transform: none !important;
}

.print-card :deep(.rank) {
  position: absolute !important;
  top: 6.5%;
  right: 9.5%;
  width: 24%;
  height: 24%;
  container-type: inline-size;
  z-index: 10 !important;
}

.print-card :deep(.rank .suit) {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.print-card :deep(.rank .suit img) {
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 0.25mm 0.3mm rgba(0, 0, 0, 0.2)) drop-shadow(0 0 1px rgba(255, 255, 255, 0.8));
}

.print-card :deep(.rank .suit-dark img) {
  filter: drop-shadow(0 0 2px rgba(255, 255, 255, 0.8)) drop-shadow(0 0 1px rgba(255, 255, 255, 0.6));
}

.print-card :deep(.rank img) {
  box-shadow: 0 0 0 0.5mm white;
}

.print-card :deep(.rank .suit-dark .suit-svg) {
  box-shadow: 0 0 0 0.5mm white, 0 0 2px rgba(255, 255, 255, 0.8);
}

.print-card :deep(.rank .number) {
  position: absolute;
  inset: 0;
  z-index: 2;
  margin-top: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  font-size: 48cqw;
  color: #ffffff !important;
  font-weight: 700;
  text-shadow: 0 0.5mm 1.2mm rgba(0, 0, 0, 0.72);
}

.print-card :deep(.play-button),
.print-card :deep(.card-body) {
  display: none !important;
}
</style>
