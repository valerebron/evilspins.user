<template>
  <main class="collection-page">
    <header class="collection-header">
      <div class="collection-header__title-row">
        <h1>Collection</h1>
        <button type="button" class="reset-button" :disabled="isResetting" @click="resetCollection">
          {{ isResetting ? 'Reinitialisation...' : 'Reinitialiser la collection' }}
        </button>
      </div>
      <p v-if="pending">Chargement des cartes...</p>
      <p v-else-if="error">Impossible de charger la collection.</p>
      <p v-else>{{ collectedCards.length }} cartes retournees</p>
      <p v-if="resetMessage" class="collection-header__message"
        :class="{ 'collection-header__message--error': resetTone === 'error' }">
        {{ resetMessage }}
      </p>
    </header>

    <section v-if="collectedCards.length" class="collection-grid" aria-label="Collection de cartes">
      <article v-for="card in collectedCards" :key="card.slug || card.esid" class="collection-card">
        <Card :card="card" :is-face-up="true" :show-play-button="false" navigate-on-click />
      </article>
    </section>

    <p v-else-if="!pending && !error" class="collection-empty">
      Aucune carte retournee pour le moment.
    </p>
  </main>
</template>

<script setup lang="ts">
import type { Card as CardType } from '~~/types/types'

const { data, pending, error } = await useFetch<{
  data: CardType[]
}>('/api/card', {
  query: {
    limit: 500,
    page: 1,
  },
})

const cards = computed<CardType[]>(() => data.value?.data || [])
const { ensureLoaded, flippedSlugs, resetAllStates } = usePersistentCardState()

const collectedCards = computed<CardType[]>(() => {
  if (flippedSlugs.value.size === 0) {
    return []
  }

  return cards.value.filter(card => {
    const slug = card.slug || ''
    return slug.length > 0 && flippedSlugs.value.has(slug)
  })
})

onMounted(() => {
  ensureLoaded()
})

const isResetting = ref(false)
const resetMessage = ref('')
const resetTone = ref<'success' | 'error'>('success')

const resetCollection = async () => {
  if (import.meta.server || isResetting.value) {
    return
  }

  const confirmed = window.confirm('Reinitialiser la collection locale sur cet appareil ?')
  if (!confirmed) {
    return
  }

  isResetting.value = true
  resetMessage.value = ''

  try {
    resetAllStates()
    resetTone.value = 'success'
    resetMessage.value = 'Collection locale reinitialisee.'
  } catch {
    resetTone.value = 'error'
    resetMessage.value = 'La reinitialisation a echoue.'
  } finally {
    isResetting.value = false
  }
}
</script>

<style scoped lang="scss">
.collection-page {
  min-height: 100vh;
  padding: clamp(16px, 3vw, 32px);
  display: grid;
  gap: 18px;
  width: 100%;
}

.collection-header {
  display: grid;
  gap: 4px;

  &__title-row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  &__message {
    color: #136f3f;
  }

  &__message--error {
    color: #a32121;
  }

  h1 {
    margin: 0;
    font-size: clamp(1.2rem, 2.6vw, 1.8rem);
    letter-spacing: 0.04em;
  }

  p {
    margin: 0;
    color: rgba(25, 17, 10, 0.8);
  }
}

.reset-button {
  appearance: none;
  border: 1px solid rgba(25, 17, 10, 0.25);
  background: #ffffff;
  color: #19110a;
  border-radius: 10px;
  padding: 0.5rem 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: transform 120ms ease, box-shadow 120ms ease, opacity 120ms ease;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
  }

  &:disabled {
    opacity: 0.65;
    cursor: wait;
  }
}

.collection-grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: clamp(12px, 2vw, 20px);
}

.collection-card {
  width: 100%;
  aspect-ratio: 7 / 10;
}

.collection-empty {
  margin: 0;
  color: rgba(25, 17, 10, 0.72);
}

@media (max-width: 640px) {
  .collection-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
