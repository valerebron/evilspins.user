import type { BoxDetails, BoxSummary } from '~~/types/types'

export const useBoxStore = defineStore('box', () => {
  const boxes = ref<BoxSummary[]>([])
  const boxById = ref<Record<string, BoxDetails>>({})
  const pending = ref(false)
  const error = ref<string | null>(null)

  const fetchBoxes = async () => {
    pending.value = true
    error.value = null
    try {
      const data = await $fetch<BoxSummary[]>('/api/box')
      boxes.value = Array.isArray(data) ? data : []
      return boxes.value
    } catch (err) {
      console.error('Failed to fetch boxes', err)
      error.value = 'Impossible de charger les box.'
      boxes.value = []
      return []
    } finally {
      pending.value = false
    }
  }

  const fetchBoxById = async (id: string, force = false) => {
    if (!id) return null
    if (!force && boxById.value[id]) return boxById.value[id]

    pending.value = true
    error.value = null
    try {
      const data = await $fetch<BoxDetails>(`/api/box/${id}`)
      if (data) {
        boxById.value[id] = data
      }
      return data
    } catch (err) {
      console.error(`Failed to fetch box ${id}`, err)
      error.value = `Impossible de charger la box ${id}.`
      return null
    } finally {
      pending.value = false
    }
  }

  return {
    boxes,
    boxById,
    pending,
    error,
    fetchBoxes,
    fetchBoxById,
  }
})
