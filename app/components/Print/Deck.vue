<template>
  <section v-if="cards.length" ref="deckRoot" class="print-deck"
    :class="{ expanded: isExpanded, 'is-touch': isTouchInterface }" @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave">
    <button type="button" class="deck-toggle-surface" :aria-expanded="isExpanded"
      :aria-label="`${label} (${cards.length} cartes)`" @click="onToggle">
      <div class="deck-viewport" :class="{ expanded: isExpanded }">
        <ul class="deck-list" :class="{ expanded: isExpanded }">
          <li v-for="(card, index) in cards" :key="card.slug || `${card.title}-${index}`" class="deck-item"
            :style="{ zIndex: index + 1 }">
            <button type="button" class="deck-card" :title="`Retirer ${card.title || 'cette carte'} du deck`"
              @click="emit('toggleCard', card)">
              <CardElement :card="card" :is-face-up="true" :is-loading="false" role="img" tabindex="-1" />
            </button>
          </li>
        </ul>
      </div>
    </button>
  </section>
</template>

<script setup lang="ts">
import CardElement from '~/components/CardElement.vue'
import useIsTouchInterface from '~/composables/useIsTouchInterface'
import type { PrintCardItem } from '~/utils/print'

const props = withDefaults(
  defineProps<{
    cards: PrintCardItem[]
    label?: string
    forceExpanded?: boolean
  }>(),
  {
    cards: () => [],
    label: 'Deck',
    forceExpanded: false,
  },
)

const emit = defineEmits<{
  toggleCard: [card: PrintCardItem]
}>()

const isTouchInterface = useIsTouchInterface()
const deckRoot = ref<HTMLElement | null>(null)
const isHoverOpen = ref(false)
const isTapOpen = ref(false)

const isExpanded = computed(() => {
  return isTouchInterface.value ? isTapOpen.value : (props.forceExpanded || isHoverOpen.value)
})

watch(
  () => props.cards.length,
  (length) => {
    if (length === 0) {
      isTapOpen.value = false
    }
  },
)

const onMouseEnter = () => {
  if (!isTouchInterface.value) {
    isHoverOpen.value = true
  }
}

const onMouseLeave = () => {
  if (!isTouchInterface.value) {
    isHoverOpen.value = false
  }
}

const onToggle = () => {
  if (isTouchInterface.value) {
    isTapOpen.value = !isTapOpen.value
  }
}

const collapseOnMobileInteraction = () => {
  if (!isTouchInterface.value) {
    return
  }

  isTapOpen.value = false
}

const handleDocumentPointerDown = (event: Event) => {
  if (!isTouchInterface.value) {
    return
  }

  const target = event.target as HTMLElement | null
  if (!target) {
    return
  }

  if (deckRoot.value?.contains(target)) {
    return
  }

  collapseOnMobileInteraction()
}

const handleDocumentScroll = () => {
  collapseOnMobileInteraction()
}

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown, true)
  document.addEventListener('touchstart', handleDocumentPointerDown, true)
  window.addEventListener('scroll', handleDocumentScroll, { passive: true })
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown, true)
  document.removeEventListener('touchstart', handleDocumentPointerDown, true)
  window.removeEventListener('scroll', handleDocumentScroll)
})
</script>

<style scoped>
.print-deck {
  --deck-card-width: 200px;
  --deck-card-height: calc(var(--deck-card-width) * 1.586);
  --deck-overlap: calc(var(--deck-card-width) * 0.62);
  --deck-peek-height: calc(var(--deck-card-height) * 0.5);
  width: min(1200px, calc(100vw - 1.2rem));
}

.deck-toggle-surface {
  border: 0;
  background: transparent;
  width: 100%;
  display: block;
  padding: 0;
  cursor: pointer;
}

.deck-viewport {
  height: var(--deck-peek-height);
  transition:
    height 280ms cubic-bezier(0.4, 0, 0.2, 1),
    padding 280ms cubic-bezier(0.4, 0, 0.2, 1);
  overflow-x: hidden;
  overflow-y: hidden;
  padding: 0.1rem 0.15rem;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.deck-viewport::-webkit-scrollbar {
  display: none;
}

.deck-viewport.expanded {
  height: calc(var(--deck-card-height) + 0.7rem);
  overflow-x: auto;
  scrollbar-width: thin;
  -ms-overflow-style: auto;
}

.deck-viewport.expanded::-webkit-scrollbar {
  display: block;
  height: 8px;
}

.deck-list {
  list-style: none;
  margin: 0 auto;
  padding: 0;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  width: fit-content;

  &.expanded {
    background: rgba(8, 17, 31, 0.26);
    border-radius: 0.65rem;
  }
}

.deck-item {
  transition:
    transform 280ms cubic-bezier(0.4, 0, 0.2, 1),
    margin-left 280ms cubic-bezier(0.4, 0, 0.2, 1),
    opacity 220ms ease;
  transform-origin: center bottom;
}

.deck-list:not(.expanded) .deck-item {
  margin-left: calc(var(--deck-overlap) * -1);
  transform: translateY(2px) scale(0.985);
}

.deck-list:not(.expanded) .deck-item:first-child {
  margin-left: 0;
}

.deck-list.expanded {
  gap: 0.55rem;
}

.deck-list.expanded .deck-item {
  margin-left: 0;
  transform: translateY(0) scale(1);
}

.deck-card {
  border: 0;
  border-radius: 0;
  width: var(--deck-card-width);
  height: var(--deck-card-height);
  padding: 0;
  overflow: visible;
  background: transparent;
  cursor: pointer;
  transition: transform 280ms cubic-bezier(0.4, 0, 0.2, 1);
}

.deck-card :deep(.card-element) {
  width: 100%;
  height: 100%;
}

.deck-card :deep(.face-up) {
  padding: 6% !important;
}

.deck-card :deep(.card-body) {
  display: none !important;
}

.is-touch:not(.expanded) .deck-card {
  pointer-events: none;
}

.is-touch:not(.expanded) .deck-toggle-surface {
  touch-action: manipulation;
}

@media (max-width: 900px) {
  .print-deck {
    width: calc(100vw - 1rem);
  }
}
</style>