<template>
  <main class="box-page">
    <header class="box-page__header">
      <NuxtLink class="box-page__back" to="/mix">Retour</NuxtLink>
      <p v-if="pending">Chargement de la box...</p>
      <p v-else-if="error">{{ error }}</p>
      <template v-else-if="box">
        <h1>{{ box.name }}</h1>
        <p>{{ box.cards.length }} cartes</p>
      </template>
    </header>

    <section v-if="box" class="box-page__faces">
      <article v-for="side in boxSides" :key="side" class="box-page__face-block">
        <h2>Face {{ side }}</h2>
        <div class="box-page__grid">
          <Card v-for="card in cardsBySide(side)" :key="card.esid" :card="card" :is-face-up="true"
            :navigate-on-click="true" :show-play-button="false" />
        </div>
      </article>
    </section>
  </main>
</template>

<script setup lang="ts">
const route = useRoute()
const boxId = route.params.boxid as string
const boxStore = useBoxStore()
const requestedFace = computed(() => boxId.endsWith('B') ? 'B' : 'A')
const baseBoxId = computed(() => boxId.replace(/[AB]$/, ''))

const box = computed(() => boxStore.boxById[baseBoxId.value] || null)

const boxSides = computed(() => {
  const sides = new Set<string>()
  for (const card of box.value?.cards ?? []) {
    if (card.box_side === 'A' || card.box_side === 'B') {
      sides.add(card.box_side)
    }
  }

  const orderedSides = Array.from(sides)
  return requestedFace.value === 'B'
    ? [...orderedSides.filter(side => side === 'B'), ...orderedSides.filter(side => side !== 'B')]
    : [...orderedSides.filter(side => side === 'A'), ...orderedSides.filter(side => side !== 'A')]
})

const cardsBySide = (side: string) => {
  return (box.value?.cards ?? []).filter(card => card.box_side === side)
}

const { pending, error } = await useAsyncData(`box-${baseBoxId.value}`, async () => {
  if (!baseBoxId.value) return null
  return await boxStore.fetchBoxById(baseBoxId.value, true)
})

useHead({
  title: computed(() => box.value ? `${box.value.name}` : 'Box'),
})
</script>

<style scoped lang="scss">
.box-page {
  display: grid;
  gap: 2rem;
  padding: 2rem 1.25rem 3rem;
}

.box-page__header {
  display: grid;
  gap: 0.5rem;
}

.box-page__back {
  width: fit-content;
  text-decoration: none;
  color: inherit;
  opacity: 0.7;
}

.box-page__header h1,
.box-page__header p,
.box-page__face-block h2 {
  margin: 0;
}

.box-page__faces {
  display: grid;
  gap: 2rem;
}

.box-page__face-block {
  display: grid;
  gap: 1rem;
}

.box-page__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
}
</style>