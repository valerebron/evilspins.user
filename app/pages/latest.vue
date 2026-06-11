<template>
  <div class="latest-page">
    <div class="page-header">
      <h1>Dernières cartes ajoutées</h1>
      <p class="subtitle">Les 10 dernières cartes ajoutées à la collection.</p>
    </div>

    <div v-if="pending" class="status-message">Chargement des cartes...</div>
    <div v-else-if="error" class="status-message error">Erreur : {{ error.message }}</div>

    <div v-else-if="cards && cards.length" class="cards-grid">
      <Card
        v-for="card in cards"
        :key="card.esid"
        :card="card"
        :is-face-up="true"
        :image-loading-type="'lazy'"
      />
    </div>

    <div v-else class="status-message">Aucune carte disponible pour le moment.</div>
  </div>
</template>

<script setup lang="ts">
import type { Card } from '~~/types/types'

definePageMeta({
  title: 'Dernières cartes',
})

const { data: cards, pending, error } = await useFetch<Card[]>('/api/card/latest')
</script>

<style scoped lang="scss">
.latest-page {
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 1.5rem;
}

.page-header h1 {
  margin: 0;
  font-size: 2rem;
}

.subtitle {
  margin: 0.5rem 0 0;
  color: #6b7280;
}

.status-message {
  margin: 1.5rem 0;
  color: #374151;
  font-size: 1rem;
}

.status-message.error {
  color: #b91c1c;
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1.5rem;
}
</style>
