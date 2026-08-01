<template>
  <main class="mix-page">
    <header class="mix-head">
      <p v-if="boxStore.pending">Chargement des boxes...</p>
      <p v-else-if="boxStore.error">{{ boxStore.error }}</p>
    </header>

    <section v-if="renderedBoxes.length" ref="shelfRef" class="mix-shelf">
      <Box :box="item" :is-selected="selectedBoxId === item.id"
        @toggle-select="(face) => toggleBoxSelection(item.id, face)" v-for="item in renderedBoxes" :key="item.id" />
    </section>

    <section v-else-if="!boxStore.pending" class="mix-empty">
      <p>Aucune box disponible.</p>
    </section>
  </main>
</template>

<script setup lang="ts">
const boxStore = useBoxStore()
const selectedBoxId = ref<string | null>(null)
const selectedBoxFace = ref<'A' | 'B'>('A')
const shelfRef = ref<HTMLElement | null>(null)

const toggleBoxSelection = async (boxId: string, face: 'A' | 'B') => {
  if (selectedBoxId.value === boxId) {
    await navigateTo(`/box/${boxId}${face}`)
    return
  }

  selectedBoxId.value = boxId
  selectedBoxFace.value = face
}

const resetSelection = () => {
  selectedBoxId.value = null
  selectedBoxFace.value = 'A'
}

const onGlobalKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Escape') return
  resetSelection()
}

const onGlobalPointerDown = (event: PointerEvent) => {
  const shelf = shelfRef.value
  if (!shelf) return

  const target = event.target as Node | null
  if (target && shelf.contains(target)) return

  resetSelection()
}

const renderedBoxes = computed(() => {
  return boxStore.boxes
    .map(item => boxStore.boxById[item.id])
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
})

onMounted(async () => {
  window.addEventListener('keydown', onGlobalKeydown)
  document.addEventListener('pointerdown', onGlobalPointerDown)

  const boxes = await boxStore.fetchBoxes()
  if (!boxes.length) return

  await Promise.all(boxes.map(item => boxStore.fetchBoxById(item.id)))
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKeydown)
  document.removeEventListener('pointerdown', onGlobalPointerDown)
})
</script>

<style scoped lang="scss">
.mix-head {
  display: grid;
  gap: 0.35rem;
}

.mix-head h1 {
  margin: 0;
  font-size: 1rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.mix-head p {
  margin: 0;
  color: rgba(25, 17, 10, 0.78);
}

.mix-shelf {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(444px, 1fr));
  gap: 0rem;
  align-items: end;
}

.mix-empty {
  min-height: 40vh;
  display: grid;
  place-items: center;
}

@media (max-width: 960px) {
  .mix-shelf {
    grid-template-columns: 1fr;
  }
}
</style>
