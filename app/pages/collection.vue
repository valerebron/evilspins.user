<template>
  <section class="collection-toolbar">
    <button class="btn btn-sm" type="button" :disabled="isLoadingAllCards" @click="toggleAllCards">
      {{ allCardsButtonLabel }}
    </button>

    <p v-if="allCardsError" class="collection-toolbar__error">
      {{ allCardsError }}
    </p>
  </section>

  <article v-for="card in displayedCards" :key="card.slug || card.esid" class="collection-card">
    <Card :card="card" :is-face-up="true" :show-play-button="false" click-behavior="self-play" />
  </article>
  <CollectionActions class="fixed bottom-20" />
</template>

<script setup lang="ts">
import type { Card as CardType } from '~~/types/types'

type CardListResponse = {
  data: CardType[]
  pagination?: {
    hasNext?: boolean
  }
}

const ALL_CARDS_PAGE_SIZE = 1000

const { data, pending, error } = await useFetch<{
  data: CardType[]
}>('/api/card', {
  query: {
    limit: 500,
    page: 1,
  },
})

const cards = computed<CardType[]>(() => data.value?.data || [])
const { ensureLoaded, flippedSlugs } = usePersistentCardState()
const showAllCards = ref(false)
const isLoadingAllCards = ref(false)
const allCardsError = ref('')
const allCards = ref<CardType[]>([])

const collectedCards = computed<CardType[]>(() => {
  if (flippedSlugs.value.size === 0) {
    return []
  }

  return cards.value.filter(card => {
    const slug = card.slug || ''
    return slug.length > 0 && flippedSlugs.value.has(slug)
  })
})

const displayedCards = computed<CardType[]>(() => {
  if (showAllCards.value) {
    return allCards.value
  }

  return collectedCards.value
})

const allCardsButtonLabel = computed(() => {
  if (isLoadingAllCards.value) {
    return 'Loading all cards...'
  }

  return showAllCards.value ? 'Collection only' : 'All cards'
})

const fetchAllCards = async () => {
  const nextCards: CardType[] = []
  let page = 1
  let hasNext = true

  while (hasNext) {
    const response = await $fetch<CardListResponse>('/api/card', {
      query: {
        limit: ALL_CARDS_PAGE_SIZE,
        page,
      },
    })

    nextCards.push(...(response.data || []))
    hasNext = Boolean(response.pagination?.hasNext)
    page += 1
  }

  allCards.value = nextCards
}

const toggleAllCards = async () => {
  allCardsError.value = ''

  if (showAllCards.value) {
    showAllCards.value = false
    return
  }

  if (allCards.value.length > 0) {
    showAllCards.value = true
    return
  }

  isLoadingAllCards.value = true

  try {
    await fetchAllCards()
    showAllCards.value = true
  } catch (fetchError) {
    console.error(fetchError)
    allCardsError.value = 'Failed to load all cards.'
  } finally {
    isLoadingAllCards.value = false
  }
}

const cardAction = (payload: { button: string; card: CardType }) => {
  console.log(payload)
}

onMounted(() => {
  ensureLoaded()
})
</script>

<style scoped lang="scss">
.collection-toolbar {
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px 4px;
}

.collection-toolbar__error {
  margin: 0;
  font-size: 0.875rem;
  color: #b91c1c;
}

.collection-card {
  padding: 0 10px;

  .card {
    width: 160px;
    margin: 10px;

    &.open {
      transform: scale(1.5);
      z-index: 10;
    }
  }
}
</style>