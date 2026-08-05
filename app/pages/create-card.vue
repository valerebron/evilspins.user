<template>
  <main class="mx-auto w-full max-w-6xl px-4 py-6">
    <section class="flex gap-6">
      <article class="card border border-base-300 bg-base-100 shadow-sm">
        <div class="card-body items-center gap-4">
          <h2 class="card-title text-base">Apercu</h2>
          <Card :key="previewCardPlaybackVersion" :card="previewCard" :is-face-up="previewIsFaceUp"
            :back-color="backColor" :show-play-button="hasPreviewAudio" click-behavior="self-play"
            :disabled="!hasPreviewAudio" class="w-[220px]" />
        </div>
      </article>

      <article class="card border border-base-300 bg-base-100 shadow-sm grow">
        <div class="card-body">
          <form class="grid gap-5" @submit.prevent="createLocalCard">
            <label class="grid gap-2">
              <span class="text-sm font-medium">Morceau mp3</span>
              <input type="file" accept="audio/mpeg,audio/mp3,audio/*" class="file-input w-full"
                @change="onAudioSelected" />
              <span class="text-xs text-base-content/70">{{ audioFileLabel }}</span>
            </label>

            <label class="grid gap-2">
              <span class="text-sm font-medium">Cover image</span>
              <input type="file" accept="image/*" class="file-input w-full" @change="onImageSelected" />
              <span class="text-xs text-base-content/70">{{ imageFileLabel }}</span>
            </label>

            <label class="grid gap-2">
              <span class="text-sm font-medium">Artiste</span>
              <input v-model="artist" type="text" class="input w-full" placeholder="Nom de l'artiste" />
            </label>

            <label class="grid gap-2">
              <span class="text-sm font-medium">Titre</span>
              <input v-model="title" type="text" class="input w-full" placeholder="Titre du morceau" />
            </label>

            <div class="grid gap-2">
              <span class="text-sm font-medium">Suit</span>
              <div class="flex flex-wrap gap-2">
                <button v-for="suitOption in SUITS" :key="suitOption" type="button" class="btn btn-sm"
                  :class="{ 'btn-active': selectedSuit === suitOption, 'text-error': isRedSuit(suitOption) }"
                  @click="selectedSuit = suitOption">
                  {{ suitOption }}
                </button>
              </div>
            </div>

            <div class="grid gap-2">
              <span class="text-sm font-medium">Rank</span>
              <div class="flex flex-wrap gap-2">
                <button v-for="rankOption in RANKS" :key="rankOption" type="button" class="btn btn-sm"
                  :class="{ 'btn-active': selectedRank === rankOption }" @click="selectedRank = rankOption">
                  {{ rankOption }}
                </button>
              </div>
            </div>

            <label class="grid gap-2" @mouseenter="onBackColorHoverStart" @mouseleave="onBackColorHoverEnd">
              <span class="text-sm font-medium">Couleur face arrière</span>
              <input v-model="backColor" type="color"
                class="h-11 cursor-pointer rounded-field border border-base-300 bg-base-100 p-1"
                @focus="onBackColorHoverStart" @blur="onBackColorHoverEnd" @input="onBackColorInput" />
            </label>

            <div class="mt-2 flex items-center gap-3">
              <button type="submit" class="btn">Creer</button>
              <span v-if="statusMessage" class="text-sm" :class="statusToneClass">{{ statusMessage }}</span>
            </div>
          </form>

          <div v-if="createdSlug" class="mt-4 rounded-box border border-success/30 bg-success/10 p-3 text-sm">
            Carte locale creee: {{ createdSlug }}
            <div class="mt-3">
              <button type="button" class="btn btn-sm" @click="backToCollection">Voir dans collection</button>
            </div>
          </div>
        </div>
      </article>
    </section>
  </main>
</template>

<script setup lang="ts">
import type { Card as CardType, Rank, Suit } from '~~/types/types'

const { addLocalCard } = useLocalCards()
const { markCardFlipped } = usePersistentCardState()

const title = ref('')
const artist = ref('')
const backColor = ref('#1b1f2a')

const imageFile = ref<File | null>(null)
const audioFile = ref<File | null>(null)
const imagePreviewUrl = ref('')
const audioPreviewUrl = ref('')
const previewCardPlaybackVersion = ref(0)
const isBackColorHovered = ref(false)
const isBackColorSelectionFlipActive = ref(false)
let backColorFlipTimeout: ReturnType<typeof setTimeout> | null = null

const createdSlug = ref('')
const statusMessage = ref('')
const statusTone = ref<'success' | 'error' | ''>('')

const SUITS: Suit[] = ['♠', '♥', '♦', '♣']
const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'V', 'D', 'R']

const imageFileLabel = computed(() => imageFile.value?.name || 'Aucune image selectionnee')
const audioFileLabel = computed(() => audioFile.value?.name || 'Aucun audio selectionne')
const hasPreviewAudio = computed(() => Boolean(audioPreviewUrl.value))
const isFaceUp = computed(() => Boolean(imagePreviewUrl.value))
const previewIsFaceUp = computed(() => {
  if (isBackColorHovered.value || isBackColorSelectionFlipActive.value) {
    return false
  }

  return isFaceUp.value
})
const statusToneClass = computed(() => {
  if (statusTone.value === 'error') {
    return 'text-error'
  }

  if (statusTone.value === 'success') {
    return 'text-success'
  }

  return 'text-base-content/70'
})

const nowValues = computed(() => {
  const now = new Date()
  return {
    year: now.getFullYear(),
    month: String(now.getMonth() + 1).padStart(2, '0'),
    day: String(now.getDate()).padStart(2, '0'),
    hour: String(now.getHours()).padStart(2, '0'),
  }
})

const selectedSuit = ref<Suit>(SUITS[(new Date().getDate() + new Date().getMonth()) % SUITS.length] ?? '♠')
const selectedRank = ref<Rank>(RANKS[(new Date().getDate() + new Date().getHours()) % RANKS.length] ?? 'A')

const previewCard = computed<CardType>(() => ({
  url_audio: audioPreviewUrl.value,
  url_image: imagePreviewUrl.value || '/face-down.svg',
  blurhash: '',
  year: nowValues.value.year,
  month: nowValues.value.month,
  day: nowValues.value.day,
  hour: nowValues.value.hour,
  artist: artist.value.trim() || 'Artiste',
  title: title.value.trim() || 'Titre',
  esid: 'preview-local-card',
  slug: 'preview-local-card',
  createdAt: new Date(),
  suit: selectedSuit.value,
  rank: selectedRank.value,
}))

const isRedSuit = (suit: Suit) => suit === '♥' || suit === '♦'

const slugify = (value: string) => {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const parseArtistTitleFromFilename = (filename: string) => {
  const withoutExtension = filename.replace(/\.[^/.]+$/, '')
  const withoutTrailingId = withoutExtension.replace(/\s*\[[^\]]+\]\s*$/, '')
  const normalized = withoutTrailingId.replace(/_/g, ' ').trim()
  const parts = normalized.split(/\s+-\s+/)

  if (parts.length < 2) {
    return null
  }

  const parsedArtist = parts.shift()?.trim() || ''
  const parsedTitle = parts.join(' - ').trim()

  if (!parsedArtist || !parsedTitle) {
    return null
  }

  return {
    artist: parsedArtist,
    title: parsedTitle,
  }
}

const fileToDataUrl = (file: File) => {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }

      reject(new Error('Invalid file payload'))
    }

    reader.onerror = () => reject(reader.error || new Error('Unable to read file'))
    reader.readAsDataURL(file)
  })
}

const onImageSelected = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] || null

  imageFile.value = file
  imagePreviewUrl.value = file ? await fileToDataUrl(file) : ''
}

const onAudioSelected = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] || null

  audioFile.value = file
  audioPreviewUrl.value = file ? await fileToDataUrl(file) : ''
  previewCardPlaybackVersion.value += 1

  if (!file) {
    return
  }

  const parsed = parseArtistTitleFromFilename(file.name)
  if (!parsed) {
    return
  }

  artist.value = parsed.artist
  title.value = parsed.title
}

const onBackColorHoverStart = () => {
  isBackColorHovered.value = true
}

const onBackColorHoverEnd = () => {
  isBackColorHovered.value = false
}

const onBackColorInput = () => {
  isBackColorSelectionFlipActive.value = true

  if (backColorFlipTimeout) {
    clearTimeout(backColorFlipTimeout)
  }

  backColorFlipTimeout = setTimeout(() => {
    isBackColorSelectionFlipActive.value = false
    backColorFlipTimeout = null
  }, 900)
}

const createLocalCard = () => {
  statusMessage.value = ''
  statusTone.value = ''

  if (!title.value.trim()) {
    statusTone.value = 'error'
    statusMessage.value = 'Le titre est requis.'
    return
  }

  if (!artist.value.trim()) {
    statusTone.value = 'error'
    statusMessage.value = 'L\'artiste est requis.'
    return
  }

  const baseSlug = slugify(`${artist.value}-${title.value}`) || 'local-card'
  const uniqueSuffix = Date.now().toString(36)
  const slug = `${baseSlug}-${uniqueSuffix}`

  const createdCard: CardType = {
    ...previewCard.value,
    slug,
    esid: `local-${uniqueSuffix}`,
    title: title.value.trim(),
    artist: artist.value.trim(),
    url_audio: audioPreviewUrl.value,
    url_image: imagePreviewUrl.value || '/face-down.svg',
    createdAt: new Date(),
  }

  addLocalCard(createdCard)
  markCardFlipped(slug)

  createdSlug.value = slug
  statusTone.value = 'success'
  statusMessage.value = 'Carte locale creee.'
}

const backToCollection = async () => {
  await navigateTo('/collection')
}

onBeforeUnmount(() => {
  if (backColorFlipTimeout) {
    clearTimeout(backColorFlipTimeout)
    backColorFlipTimeout = null
  }
})
</script>
