<template>
  <main class="mix-player-page">
    <section v-if="tableCards.length > 0" class="mix-board">
      <header class="mix-board__header">
        <div class="mix-board__header-actions">
          <button type="button" class="btn btn-sm" @click="backToCollection">
            Retour collection
          </button>
        </div>
      </header>

      <section class="mix-board__decks" aria-label="Platine A et B">
        <article class="card card-border bg-base-200/50 mix-board__deck">
          <div class="card-body">
            <p class="mix-board__deck-meta text-center">{{ deckACard?.title || 'Aucune carte' }}</p>
            <div class="mix-board__turntable">
              <MixDeckCard v-if="deckACard" ref="deckARef" label="A" :card="deckACard" :active="true" />
              <div v-else class="mix-board__turntable-empty">Selectionne une carte</div>
            </div>
            <MixDeckWaveform :card="deckACard" label="A" class="mix-board__deck-waveform"
              :current-time="deckATime.current" :duration="deckATime.duration" @seek="seekDeckA" />
          </div>
        </article>

        <article class="card card-border bg-base-200/50 mix-board__deck">
          <div class="card-body">
            <p class="mix-board__deck-meta text-center">{{ deckBCard?.title || 'Aucune carte' }}</p>
            <div class="mix-board__turntable">
              <MixDeckCard v-if="deckBCard" ref="deckBRef" label="B" :card="deckBCard" :active="true" />
              <div v-else class="mix-board__turntable-empty">Selectionne une carte</div>
            </div>
            <MixDeckWaveform :card="deckBCard" label="B" class="mix-board__deck-waveform"
              :current-time="deckBTime.current" :duration="deckBTime.duration" @seek="seekDeckB" />
          </div>
        </article>
      </section>

      <section class="mix-board__mat" aria-label="Tapis de cartes">
        <ol class="mix-board__slots" @dragover.prevent>
          <li v-for="slotNumber in slotCount" :key="slotNumber" class="mix-board__slot"
            :class="{ 'mix-board__slot--over': dragState?.over === slotNumber - 1 }"
            @dragover.prevent="onSlotDragOver(slotNumber - 1)" @drop.prevent="onDropToSlot(slotNumber - 1)">
            <article v-if="tableCards[slotNumber - 1]" class="mix-board__slot-card" draggable="true"
              :key="`slot-card-${tableCards[slotNumber - 1]?.slug || slotNumber}`"
              @dragstart="onCardDragStart(slotNumber - 1, $event)" @dragend="onCardDragEnd">
              <Card :key="tableCards[slotNumber - 1]?.slug || slotNumber" :card="tableCards[slotNumber - 1] as CardType"
                :is-face-up="true" :show-play-button="false" click-behavior="flip-only" />
              <span class="badge badge-sm mix-board__track-number">Track {{ slotNumber }}</span>
            </article>

            <div v-else class="mix-board__slot-empty">
              Slot {{ slotNumber }}
            </div>
          </li>
        </ol>
      </section>
    </section>

    <section v-else class="mix-empty card card-border bg-base-200/60">
      <div class="card-body items-center text-center gap-4">
        <h2 class="card-title">Aucune carte selectionnee</h2>
        <p>Va sur la collection, selectionne des cartes puis clique sur Mix.</p>
        <button type="button" class="btn" @click="backToCollection">Aller a la collection</button>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import type { Card as CardType } from '~~/types/types'
import MixDeckCard from '~/components/MixDeckCard.vue'

const MIN_SLOT_COUNT = 10

const mixCardsStore = useMixCardsStore()
const selectedCards = computed<CardType[]>(() => mixCardsStore.selectedCards)
const tableCards = ref<CardType[]>([])
const dragState = ref<{ from: number; over: number | null } | null>(null)
const deckARef = ref<InstanceType<typeof MixDeckCard> | null>(null)
const deckBRef = ref<InstanceType<typeof MixDeckCard> | null>(null)
const deckATime = reactive({ current: 0, duration: 0 })
const deckBTime = reactive({ current: 0, duration: 0 })

let deckMonitorTimer: ReturnType<typeof setInterval> | null = null

const slotCount = computed(() => Math.max(MIN_SLOT_COUNT, tableCards.value.length))
const deckACard = computed(() => tableCards.value[0] || null)
const deckBCard = computed(() => tableCards.value[1] || tableCards.value[0] || null)

watch(
  selectedCards,
  (cards) => {
    tableCards.value = [...cards]
  },
  { immediate: true }
)

const backToCollection = async () => {
  await navigateTo('/collection')
}

const syncDeckTime = (
  deckRef: InstanceType<typeof MixDeckCard> | null,
  target: { current: number; duration: number }
) => {
  if (!deckRef) {
    target.current = 0
    target.duration = 0
    return
  }

  const duration = Number(deckRef.getDuration?.() || 0)
  const current = Number(deckRef.getCurrentTime?.() || 0)

  target.duration = Number.isFinite(duration) ? Math.max(0, duration) : 0
  target.current = Number.isFinite(current) ? Math.max(0, Math.min(current, target.duration || current)) : 0
}

const refreshDeckTimes = () => {
  syncDeckTime(deckARef.value, deckATime)
  syncDeckTime(deckBRef.value, deckBTime)
}

const seekDeckPosition = async (
  deckRef: InstanceType<typeof MixDeckCard> | null,
  target: { current: number; duration: number },
  seconds: number,
) => {
  if (!deckRef) {
    return
  }

  const isReady = await deckRef.waitUntilReady?.(2000)
  if (!isReady) {
    return
  }

  const duration = Number(deckRef.getDuration?.() || target.duration || 0)
  const clampedSeconds = duration > 0
    ? Math.max(0, Math.min(seconds, duration))
    : Math.max(0, seconds)

  const didJump = await deckRef.jumpToPosition?.(clampedSeconds)
  if (!didJump) {
    // Fallback: restart playback from target if direct jump is unavailable.
    await deckRef.play?.(clampedSeconds, false)
  }

  target.current = clampedSeconds
  refreshDeckTimes()
}

const seekDeckA = async (seconds: number) => {
  await seekDeckPosition(deckARef.value, deckATime, seconds)
}

const seekDeckB = async (seconds: number) => {
  await seekDeckPosition(deckBRef.value, deckBTime, seconds)
}

const onCardDragStart = (index: number, event: DragEvent) => {
  dragState.value = { from: index, over: index }

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(index))
  }
}

const onCardDragEnd = () => {
  mixCardsStore.setCards(tableCards.value)
  dragState.value = null
}

const onSlotDragOver = (targetIndex: number) => {
  if (!dragState.value) {
    return
  }

  const fromIndex = dragState.value.from
  const nextTarget = Math.max(0, Math.min(targetIndex, tableCards.value.length))
  dragState.value.over = nextTarget

  if (fromIndex === nextTarget || fromIndex < 0 || fromIndex >= tableCards.value.length) {
    return
  }

  moveCard(fromIndex, nextTarget, false)
  dragState.value.from = nextTarget
}

const moveCard = (fromIndex: number, targetIndex: number, persist = false) => {
  if (fromIndex === targetIndex) {
    return
  }

  const nextCards = [...tableCards.value]
  const [movedCard] = nextCards.splice(fromIndex, 1)

  if (!movedCard) {
    return
  }

  const nextTargetIndex = Math.max(0, Math.min(targetIndex, nextCards.length))
  nextCards.splice(nextTargetIndex, 0, movedCard)

  tableCards.value = nextCards

  if (persist) {
    mixCardsStore.setCards(nextCards)
  }
}

const onDropToSlot = (targetIndex: number) => {
  const fromIndex = dragState.value?.from ?? -1
  if (fromIndex < 0) {
    dragState.value = null
    return
  }

  const clampedTarget = Math.max(0, Math.min(targetIndex, tableCards.value.length))
  moveCard(fromIndex, clampedTarget, true)
  dragState.value = null
}

watch([deckACard, deckBCard], () => {
  refreshDeckTimes()
})

onMounted(() => {
  refreshDeckTimes()
  deckMonitorTimer = setInterval(() => {
    refreshDeckTimes()
  }, 120)
})

onBeforeUnmount(() => {
  if (deckMonitorTimer) {
    clearInterval(deckMonitorTimer)
    deckMonitorTimer = null
  }
})
</script>

<style scoped lang="scss">
.mix-player-page {
  --dock-height: calc(64px + env(safe-area-inset-bottom, 0px));
  height: calc(100svh - var(--dock-height));
  box-sizing: border-box;
  overflow: auto;
  width: 100%;
}

.mix-board {
  min-height: 100%;
  display: grid;
  grid-template-rows: auto auto 1fr;
  gap: 12px;
}

.mix-board__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  background: color-mix(in srgb, hsl(var(--b2)) 60%, transparent);
  border: 1px solid hsl(var(--b3));
}

.mix-board__title {
  margin: 0;
  font-size: 1.2rem;
  line-height: 1;
}

.mix-board__subtitle {
  margin: 4px 0 0;
  opacity: 0.75;
  font-size: 0.85rem;
}

.mix-board__header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mix-board__decks {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.mix-board__deck {
  overflow: hidden;
  width: auto;
}

.mix-board__deck-meta {
  margin-top: 0;
  margin-bottom: 8px;
  opacity: 0.75;
  font-size: 0.8rem;
  min-height: 1.1rem;
}

.mix-board__deck-waveform {
  margin-bottom: 10px;
}

.mix-board__turntable-empty {
  width: 100%;
  height: 100%;
  border-radius: inherit;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  opacity: 0.7;
  border: 1px dashed hsl(var(--b3));
}

.mix-board__mat {
  border-radius: 16px;
  border: 1px solid color-mix(in srgb, hsl(var(--b3)) 80%, #0f5132);
  padding: 10px;
  background:
    radial-gradient(circle at 20% 0%, rgba(255, 255, 255, 0.12), transparent 45%),
    repeating-linear-gradient(45deg,
      rgba(255, 255, 255, 0.03) 0,
      rgba(255, 255, 255, 0.03) 8px,
      rgba(0, 0, 0, 0.04) 8px,
      rgba(0, 0, 0, 0.04) 16px),
    linear-gradient(140deg, #14532d, #166534);
}

.mix-board__mat-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
  color: #e7fbe9;

  h2 {
    margin: 0;
    font-size: 1rem;
  }

  p {
    margin: 0;
    font-size: 0.75rem;
    opacity: 0.9;
  }
}

.mix-board__slots {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 10px;
}

.mix-board__slot {
  min-height: 210px;
  border-radius: 12px;
  border: 1px dashed rgba(231, 251, 233, 0.35);
  padding: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(8, 34, 16, 0.24);
  transition: transform 150ms ease, border-color 150ms ease, background 150ms ease;
}

.mix-board__slot--over {
  border-color: #bef264;
  background: rgba(190, 242, 100, 0.15);
  transform: translateY(-2px);
}

.mix-board__slot-card {
  width: 100%;
  cursor: grab;
  position: relative;
  padding-bottom: 24px;

  :deep(.card) {
    width: 100%;
    margin: 0;
  }
}

.mix-board__track-number {
  position: absolute;
  left: 50%;
  bottom: 0;
  transform: translateX(-50%);
}

.mix-board__slot-empty {
  font-size: 0.72rem;
  color: rgba(231, 251, 233, 0.9);
  letter-spacing: 0.03em;
}

.mix-empty {
  max-width: 580px;
  margin: 14svh auto 0;
}

.card-body {
  padding: 0;
}
</style>
