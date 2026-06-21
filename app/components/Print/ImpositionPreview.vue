<template>
  <section class="preview" aria-labelledby="preview-title">
    <header class="preview-head">
      <h2 id="preview-title">Apercu d'imposition</h2>
      <div class="legend">
        <span class="dot bleed" /> Fond perdu 3mm
        <span class="dot trim" /> Trait de coupe
      </div>
    </header>

    <div class="sheet-shell" :style="shellStyle">
      <div class="sheet-scale" :style="scaleStyle">
        <div class="sheet" role="img" :aria-label="`Apercu ${face}`" :style="sheetStyle">
          <div v-for="slot in slots" :key="slot.index" :class="['slot', { 'back-slot': face === 'back' }]" :style="{
            left: `${slot.xMm}mm`,
            top: `${slot.yMm}mm`,
            width: `${cardWidth}mm`,
            height: `${cardHeight}mm`,
          }">
            <PrintCard :card="cardsBySlot[slot.index] || null" :face="face" :back-alignment="backAlignment" :rounded-front="props.roundedFront ?? true" />
            <div class="trim-outline" />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import PrintCard from '~/components/Print/PrintCard.vue'
import {
  CARD_MM,
  getPaperDimensions,
  getImpositionSlots,
  mapCardsForBack,
  type BackAlignmentMode,
  type PaperFormatId,
  type PrintCardItem,
} from '~/utils/print'

const props = withDefaults(
  defineProps<{
    cards: PrintCardItem[]
    face: 'front' | 'back'
    scale: number
    backAlignment: BackAlignmentMode
    paperFormat: PaperFormatId
    roundedFront?: boolean
  }>(),
  {
    cards: () => [],
    face: 'front',
    scale: 0.34,
    backAlignment: 'mirror',
    paperFormat: 'a4',
    roundedFront: true,
  },
)

const cardWidth = CARD_MM.width
const cardHeight = CARD_MM.height
const pageDimensions = computed(() => getPaperDimensions(props.paperFormat))
const slots = computed(() => getImpositionSlots(pageDimensions.value))

const cardsBySlot = computed(() => {
  if (props.face === 'front') {
    return props.cards
  }
  return mapCardsForBack(props.cards, props.backAlignment)
})

const shellStyle = computed(() => {
  return {
    width: `${pageDimensions.value.width * props.scale}mm`,
    minHeight: `${pageDimensions.value.height * props.scale}mm`,
  }
})

const scaleStyle = computed(() => {
  return {
    width: `${pageDimensions.value.width}mm`,
    height: `${pageDimensions.value.height}mm`,
    transform: `scale(${props.scale})`,
    transformOrigin: 'top left',
  }
})

const sheetStyle = computed(() => {
  return {
    width: `${pageDimensions.value.width}mm`,
    height: `${pageDimensions.value.height}mm`,
  }
})
</script>

<style scoped>
.preview {
  background: #f4f7fb;
  border: 1px solid #d6e1ec;
  border-radius: 1rem;
  padding: 1rem;
  display: grid;
  gap: 0.75rem;
}

.preview-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.preview-head h2 {
  font-weight: 700;
  color: #14263a;
}

.legend {
  display: inline-flex;
  align-items: center;
  gap: 0.7rem;
  font-size: 0.8rem;
  color: #47627e;
}

.dot {
  display: inline-block;
  width: 0.65rem;
  height: 0.65rem;
  border-radius: 999px;
  margin-right: 0.24rem;
}

.dot.bleed {
  background: #7f1d1d;
}

.dot.trim {
  background: #0f172a;
}

.sheet-shell {
  overflow: auto;
  border: 1px solid #d0dce8;
  border-radius: 0.7rem;
  background: #edf2f8;
}

.sheet-scale {
  box-shadow: 0 12px 25px rgba(14, 30, 55, 0.16);
}

.sheet {
  position: relative;
  width: 297mm;
  height: 210mm;
  background: #ffffff;
}

.slot {
  position: absolute;
}

.slot.back-slot :deep(.print-card) {
  width: calc(100% + 0.4mm);
  height: calc(100% + 0.4mm);
  margin-left: -0.2mm;
  margin-top: -0.2mm;
}

.trim-outline {
  position: absolute;
  inset: 0;
  border: 0.12mm dashed rgba(15, 23, 42, 0.6);
  border-radius: 3.2mm;
  pointer-events: none;
}
</style>
