<template>
  <CardSearchPanel mode="fullscreen" title="Recherche" pick-label="Ouvrir" close-on-select @select="onSelectCard" />
</template>

<script setup lang="ts">
import type { Card } from '~~/types/types'
const onSelectCard = (card: Card) => {
  void navigateTo(`/card/${card.slug}?autoplay=true`)
}
</script>

<style scoped></style>
