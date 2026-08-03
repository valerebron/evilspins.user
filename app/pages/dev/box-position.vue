<template>
  <main class="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 lg:flex-row items-center">
    <section class="card card-border bg-base-100 shadow-sm lg:w-2/3">
      <div class="card-body items-center gap-4">
        <span v-if="isLoading" class="loading loading-spinner loading-md" aria-label="Chargement de la box"></span>
        <p v-else-if="loadError" class="text-sm text-error">{{ loadError }}</p>
        <Box v-else-if="box" :box="box" :forced-mode="activeMode" :mode-rotations="rotations"
          :disable-interaction="true" />
      </div>
    </section>

    <section class="card card-border bg-base-100 shadow-sm lg:w-1/3">
      <div class="card-body gap-5">
        <fieldset class="fieldset">
          <legend class="fieldset-legend">Position a regler</legend>
          <select v-model="activeMode" class="select w-full">
            <option value="stored">stored</option>
            <option value="selected">selected</option>
          </select>
          <p class="label">Selectionne la pose active de la box.</p>
        </fieldset>

        <fieldset v-for="axis in axes" :key="axis.key" class="fieldset">
          <legend class="fieldset-legend">{{ axis.label }}</legend>
          <label class="flex items-center gap-3">
            <input type="range" class="range" min="-180" max="180" step="1" :value="rotationValue(axis.key)"
              @input="setRotationFromInput(axis.key, $event)">
            <span class="w-16 text-right font-mono text-xs text-base-content/80">{{ rotationValue(axis.key) }}deg</span>
          </label>
        </fieldset>

        <fieldset class="fieldset">
          <legend class="fieldset-legend">Valeurs a copier</legend>
          <pre class="rounded-box bg-base-200 p-3 text-xs">{{ serializedRotations }}</pre>
          <p class="label">Offsets en degres, appliques sur la pose actuelle de chaque mode.</p>
        </fieldset>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import type { BoxDetails } from '~~/types/types'

type BoxMode = 'stored' | 'selected'
type RotationAxis = 'x' | 'y' | 'z'

type Rotation = {
  x: number
  y: number
  z: number
}

const route = useRoute()
const boxStore = useBoxStore()

const activeMode = ref<BoxMode>('stored')
const boxId = ref('')
const isLoading = ref(true)
const loadError = ref<string | null>(null)
const rotations = ref<Record<BoxMode, Rotation>>({
  stored: { x: -18, y: -1, z: 90 },
  selected: { x: 29, y: 18, z: 88 },
})

const axes: { key: RotationAxis, label: string }[] = [
  { key: 'x', label: 'Rotation X' },
  { key: 'y', label: 'Rotation Y' },
  { key: 'z', label: 'Rotation Z' },
]

const box = computed<BoxDetails | null>(() => {
  if (!boxId.value) {
    return null
  }

  return boxStore.boxById[boxId.value] || null
})

const serializedRotations = computed(() => {
  return JSON.stringify(rotations.value, null, 2)
})

const rotationValue = (axis: RotationAxis) => {
  return rotations.value[activeMode.value][axis]
}

const setRotationFromInput = (axis: RotationAxis, event: Event) => {
  const target = event.target as HTMLInputElement | null
  if (!target) {
    return
  }

  rotations.value[activeMode.value][axis] = Number(target.value)
}

const resolveQueryBoxId = () => {
  const queryValue = route.query.id
  if (typeof queryValue === 'string') {
    return queryValue
  }
  if (Array.isArray(queryValue) && typeof queryValue[0] === 'string') {
    return queryValue[0]
  }

  return ''
}

onMounted(async () => {
  isLoading.value = true
  loadError.value = null

  const summaries = await boxStore.fetchBoxes()
  if (!summaries.length) {
    loadError.value = 'Aucune box disponible.'
    isLoading.value = false
    return
  }

  const requestedId = resolveQueryBoxId()
  const fallbackId = summaries[0]?.id || ''
  const hasRequestedId = summaries.some(item => item.id === requestedId)
  boxId.value = hasRequestedId ? requestedId : fallbackId

  if (!boxId.value) {
    loadError.value = 'Impossible de trouver une box a afficher.'
    isLoading.value = false
    return
  }

  const details = await boxStore.fetchBoxById(boxId.value)
  if (!details) {
    loadError.value = `Impossible de charger la box ${boxId.value}.`
  }

  isLoading.value = false
})
</script>
