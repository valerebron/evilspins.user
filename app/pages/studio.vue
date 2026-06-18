<template>
  <main class="studio-page mx-auto min-h-[calc(100vh-4rem)] max-w-[1440px] px-4 py-6">
    <div class="studio-inner grid gap-8 lg:grid-cols-[minmax(380px,440px)_1fr] items-start">
      <section class="preview-column rounded-[2rem] p-6 flex">
        <div class="preview-card mx-auto flex flex-col justify-center items-center gap-4">
          <Card :card="previewCard" :is-face-up="previewFaceUp" class="min-w-[200px]" />
          <button type="button" @click="previewFaceUp = !previewFaceUp"
            class="rounded-3xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-800">
            flip
          </button>
        </div>
      </section>

      <section class="form-column rounded-[2rem] p-6">
        <form @submit.prevent="createCard" class="space-y-6" v-if="!createdCard">
          <div>
            <label class="block text-sm font-medium text-slate-300" for="imageUrl">Image (URL)</label>
            <input id="imageUrl" v-model="imageUrl" type="url" placeholder="https://..."
              class="mt-2 w-full rounded-3xl border border-slate-700 px-4 py-3 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-700" />
            <label
              class="mt-3 flex items-center justify-between rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-200 cursor-pointer transition hover:border-slate-500">
              <span>Importer une image</span>
              <input type="file" accept="image/*" class="sr-only" @change="onImageSelected" />
            </label>
            <p class="mt-2 text-xs text-slate-400">{{ imageFileName }}</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-300" for="audioUrl">Morceau (URL)</label>
            <input id="audioUrl" v-model="audioUrl" type="url" placeholder="https://..."
              class="mt-2 w-full rounded-3xl border border-slate-700 px-4 py-3 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-700" />
            <label
              class="mt-3 flex items-center justify-between rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-200 cursor-pointer transition hover:border-slate-500">
              <span>Importer un audio</span>
              <input type="file" accept="audio/*" class="sr-only" @change="onAudioSelected" />
            </label>
            <p class="mt-2 text-xs text-slate-400">{{ audioFileName }}</p>
          </div>
          <div>
            <input id="title" v-model="title" type="text" placeholder="Titre de la carte"
              class="mt-2 w-full rounded-3xl border border-slate-700  px-4 py-3 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-700" />
          </div>

          <div>
            <input id="artist" v-model="artist" type="text" placeholder="Nom de l'artiste"
              class="mt-2 w-full rounded-3xl border border-slate-700  px-4 py-3 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-700" />
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <div>
              <label class="block text-sm font-medium text-slate-300" for="selectedDate">Date d'ajout</label>
              <input id="selectedDate" v-model="selectedDate" type="date"
                class="mt-2 w-full rounded-3xl border border-slate-700  px-4 py-3 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-700"
                @change="updateRankSuitFromDate" />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-300" for="selectedTime">Heure d'ajout</label>
              <input id="selectedTime" v-model="selectedTime" type="time"
                class="mt-2 w-full rounded-3xl border border-slate-700  px-4 py-3 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-700"
                @change="updateRankSuitFromDate" />
            </div>

          </div>

          <div class="flex justify-center">
            <button type="submit"
              class="rounded-3xl border border-slate-700 px-16 bg-esyellow py-3 text-sm font-semibold transition bg-esyellow-500 text-slate-900 hover:bg-esyellow-400">
              Créer la carte
            </button>
          </div>
        </form>

        <div v-if="creationError" class="mt-6 rounded-3xl border border-red-600 bg-red-950 p-5 text-sm text-red-100">
          {{ creationError }}
        </div>

        <div v-if="createdCard"
          class="mt-6 rounded-3xl border border-emerald-500 bg-slate-950 p-5 text-sm text-slate-100">
          <p class="font-semibold text-emerald-200">Carte créée avec succès</p>
          <p class="mt-2 text-slate-400">La carte a bien été ajoutée dans la base de données.</p>
          <p v-if="createdCardUrl" class="mt-2 text-slate-200 break-all">
            URL slug : <a :href="createdCardUrl" class="text-sky-300 hover:text-sky-400">{{ createdCardUrl }}</a>
          </p>
        </div>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, computed, watch } from 'vue'
import Card from '~/components/Card.vue'
import type { Card as CardType, Suit as CardSuit, Rank as CardRank } from '~~/types/types'

const runtimeConfig = useRuntimeConfig()
const dataUrl = runtimeConfig.public.dataUrl || ''

const title = ref('')
const artist = ref('')
const imageUrl = ref('')
const audioUrl = ref('')
const imageFile = ref<File | null>(null)
const audioFile = ref<File | null>(null)
const imageObjectUrl = ref<string | null>(null)
const audioObjectUrl = ref<string | null>(null)
const createdCard = ref<CardType | null>(null)
const creationError = ref<string | null>(null)
const previewSuit = ref<CardSuit>('♠')
const previewRank = ref<CardRank>('A')
const previewFaceUp = ref(true)
const yearColor = computed(() => getYearColor(Number(selectedYear.value)))

// Initialize selectedDate to today's date in YYYY-MM-DD format
const today = new Date()
const dateString = today.toISOString().split('T')[0]
const timeString = today.toTimeString().slice(0, 5)
const selectedDate = ref(dateString)
const selectedTime = ref(timeString)
const selectedYear = computed(() => String(new Date(selectedDate.value).getFullYear()))

const updateRankSuitFromDate = async () => {
  try {
    const dateTime = new Date(`${selectedDate.value}T${selectedTime.value || '00:00'}:00`)
    const timestamp = dateTime.getTime()
    const response = await $fetch<{ suit: CardSuit; rank: CardRank }>('/api/card/rank-suit', {
      query: { timestamp }
    })
    previewSuit.value = response.suit
    previewRank.value = response.rank
  } catch (error) {
    console.warn('Unable to fetch card rank/suit:', error)
  }
}

onMounted(async () => {
  await updateRankSuitFromDate()
})

const previewImage = computed(() => {
  const url = imageUrl.value.trim()
  if (url && !url.startsWith('blob:')) {
    return url
  }
  if (imageFile.value && imageObjectUrl.value) {
    return imageObjectUrl.value
  }
  if (url) {
    return url
  }
  return '/face-down.svg'
})

const hasPreviewImage = computed(() => previewImage.value !== '/face-down.svg')

watch(hasPreviewImage, (hasImage) => {
  previewFaceUp.value = hasImage
}, { immediate: true })

const previewAudio = computed(() => {
  const url = audioUrl.value.trim()
  if (url && !url.startsWith('blob:')) {
    return url
  }
  if (audioFile.value && audioObjectUrl.value) {
    return audioObjectUrl.value
  }
  if (url) {
    return url
  }
  return ''
})

const imageFileName = computed(() => imageFile.value?.name || 'Aucune image sélectionnée')
const audioFileName = computed(() => audioFile.value?.name || 'Aucun audio sélectionné')

const previewTitle = computed(() => title.value.trim() || 'Titre de la carte')
const previewArtist = computed(() => artist.value.trim() || 'Artiste')
const createdCardUrl = computed(() => {
  if (!createdCard.value?.slug) return ''
  return `/card/${createdCard.value.slug}`
})

const getCardDateComponents = computed(() => {
  const date = new Date(selectedDate.value)
  return {
    year: date.getFullYear().toString(),
    month: String(date.getMonth() + 1).padStart(2, '0'),
    day: String(date.getDate()).padStart(2, '0'),
  }
})

const previewCard = computed<CardType>(() => ({
  url_audio: previewAudio.value,
  url_image: previewImage.value,
  blurhash: '',
  year: parseInt(selectedYear.value, 10),
  yearColor: yearColor.value,
  month: getCardDateComponents.value.month,
  day: getCardDateComponents.value.day,
  hour: selectedTime.value || '00:00',
  artist: previewArtist.value,
  title: previewTitle.value,
  suit: previewSuit.value,
  rank: previewRank.value,
  esid: 'preview-card',
  slug: 'preview-card',
  createdAt: new Date(`${selectedDate.value}T${selectedTime.value || '00:00'}:00`),
}))

const revokeUrl = (url?: string | null) => {
  if (url && typeof window !== 'undefined' && url.startsWith('blob:')) {
    URL.revokeObjectURL(url)
  }
}

const onImageSelected = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0] ?? null

  if (imageObjectUrl.value) {
    revokeUrl(imageObjectUrl.value)
    imageObjectUrl.value = null
  }

  imageFile.value = file

  if (file) {
    imageObjectUrl.value = URL.createObjectURL(file)
    imageUrl.value = imageObjectUrl.value
  }
}

const onAudioSelected = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0] ?? null

  if (audioObjectUrl.value) {
    revokeUrl(audioObjectUrl.value)
    audioObjectUrl.value = null
  }

  audioFile.value = file

  if (file) {
    audioObjectUrl.value = URL.createObjectURL(file)
    audioUrl.value = audioObjectUrl.value

    // Fill title with audio filename (without extension) if title is empty
    if (!title.value.trim() && file.name) {
      title.value = file.name.replace(/\.[^/.]+$/, '')
    }
  }
}

const createCard = async () => {
  creationError.value = null

  const formFields = {
    year: parseInt(selectedYear.value, 10),
    month: parseInt(getCardDateComponents.value.month, 10),
    day: parseInt(getCardDateComponents.value.day, 10),
    hour: parseInt(selectedTime.value.split(':')[0], 10),
    artist: previewArtist.value,
    title: previewTitle.value,
    suit: previewSuit.value,
    rank: previewRank.value,
    blurhash: '',
    created_at: `${selectedDate.value}T${selectedTime.value}:00.000Z`,
  }

  try {
    const hasFileUpload = Boolean(audioFile.value || imageFile.value)
    let body: FormData | Record<string, any>

    if (hasFileUpload) {
      const formData = new FormData()
      formData.append('year', String(formFields.year))
      formData.append('month', String(formFields.month))
      formData.append('day', String(formFields.day))
      formData.append('hour', String(formFields.hour))
      formData.append('artist', formFields.artist)
      formData.append('title', formFields.title)
      formData.append('suit', formFields.suit)
      formData.append('rank', formFields.rank)
      formData.append('blurhash', formFields.blurhash)
      formData.append('created_at', formFields.created_at)

      if (audioFile.value) {
        formData.append('audio', audioFile.value)
      } else if (audioUrl.value.trim()) {
        formData.append('url_audio', audioUrl.value.trim())
      }

      if (imageFile.value) {
        formData.append('image', imageFile.value)
      } else if (imageUrl.value.trim()) {
        formData.append('url_image', imageUrl.value.trim())
      }

      body = formData
    } else {
      body = {
        ...formFields,
        url_audio: previewAudio.value,
        url_image: previewImage.value,
        file_mtime: 0,
        file_size: 0,
      }
    }
    const response = await $fetch('/api/card/upload', {
      method: 'POST',
      body,
    })

    createdCard.value = response as CardType
  } catch (error) {
    console.error('Failed to create card:', error)
    creationError.value = 'Impossible de créer la carte'
    createdCard.value = null
  }
}

const resetForm = async () => {
  title.value = ''
  artist.value = ''
  imageUrl.value = ''
  audioUrl.value = ''
  imageFile.value = null
  audioFile.value = null
  const todayReset = new Date()
  selectedDate.value = todayReset.toISOString().split('T')[0]
  selectedTime.value = todayReset.toTimeString().slice(0, 5)


  if (imageObjectUrl.value) {
    revokeUrl(imageObjectUrl.value)
    imageObjectUrl.value = null
  }
  if (audioObjectUrl.value) {
    revokeUrl(audioObjectUrl.value)
    audioObjectUrl.value = null
  }

  createdCard.value = null
  creationError.value = null
}

onBeforeUnmount(() => {
  if (imageObjectUrl.value) revokeUrl(imageObjectUrl.value)
  if (audioObjectUrl.value) revokeUrl(audioObjectUrl.value)
})
</script>

<style scoped>
.studio-page {
  min-height: calc(100vh - 4rem);
  display: flex;
  justify-content: center;
  padding: 1rem 0;
}

.studio-inner {
  width: 100%;
  display: grid;
  gap: 2rem;
}

.preview-column,
.form-column {
  min-height: 100%;
}

.preview-card {
  width: min(100%, 380px);
  margin: 0 auto;
}

pre {
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
