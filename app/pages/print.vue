<template>
  <main class="print-page">
    <header class="hero">
      <div>
        <p class="eyebrow">Impression cartes bancaire 85.60 x 53.98mm</p>
        <h1>Generateur d'imposition recto-verso</h1>
        <p class="subtitle">
          10 cartes par feuille A4 paysage, bleed 3mm et export PDF precis pour l'impression duplex.
        </p>
      </div>

      <div class="hero-actions">
        <div class="stats">
          <span>{{ selectedCount }} carte(s) selectionnee(s)</span>
          <strong>{{ sheetCount }} feuille(s)</strong>
        </div>
        <button type="button" class="primary-btn" :disabled="selectedCount === 0 || isGenerating" @click="generatePdf">
          {{ isGenerating ? 'Generation...' : 'Generer le PDF' }}
        </button>
      </div>
    </header>

    <section class="toolbar">
      <label>
        Export
        <select v-model="exportMode">
          <option value="duplex">Recto-verso (alternance par feuille)</option>
          <option value="separate">Faces separees (tous les rectos puis les versos)</option>
        </select>
      </label>

      <label>
        Alignement verso
        <select v-model="backAlignment">
          <option value="mirror">Miroir horizontal (duplex: retourner sur bord court)</option>
          <option value="aligned">Aligne sans miroir</option>
        </select>
      </label>

      <label>
        Papier
        <select v-model="paperFormat">
          <option v-for="[formatId, format] in paperFormatEntries" :key="formatId" :value="formatId">
            {{ format.label }}
          </option>
        </select>
      </label>

      <label class="checkbox-inline">
        <input v-model="includeCutMarks" type="checkbox" />
        Marques de coupe
      </label>

      <label>
        Cartes/page
        <select v-model.number="pageSize">
          <option :value="10">10</option>
          <option :value="20">20</option>
          <option :value="30">30</option>
          <option :value="50">50</option>
          <option :value="100">100</option>
        </select>
      </label>
    </section>

    <p class="print-hint">
      PDF genere en {{ selectedPaperFormat.label }}. Pour conserver 85,60 x 53,98 mm apres decoupe, imprime a 100% sans
      "Ajuster" ni "Adapter a la page".
    </p>

    <p v-if="pdfError" class="error-banner">{{ pdfError }}</p>

    <section class="layout-grid">
      <CardSelector v-model:searchQuery="searchInput" v-model:displayMode="displayMode" v-model:page="page"
        :cards="visibleCards" :pending="pending" :error-message="errorMessage" :total-pages="totalPages"
        :total-items="totalItems" :selected-ids="selectedIds" @toggle-card="toggleSelection"
        @toggle-page="togglePageSelection" />

      <section class="preview-panel" aria-labelledby="preview-tabs">
        <header class="preview-topbar">
          <div id="preview-tabs" class="tabs" role="tablist" aria-label="Faces imprimees">
            <button type="button" role="tab" :aria-selected="previewFace === 'front'"
              :class="['tab-btn', { active: previewFace === 'front' }]" @click="previewFace = 'front'">
              Recto
            </button>
            <button type="button" role="tab" :aria-selected="previewFace === 'back'"
              :class="['tab-btn', { active: previewFace === 'back' }]" @click="previewFace = 'back'">
              Verso
            </button>
          </div>

          <div class="sheet-nav">
            <button type="button" :disabled="currentSheet <= 1" @click="currentSheet -= 1">Prec.</button>
            <span>Feuille {{ currentSheet }} / {{ sheetCount }}</span>
            <button type="button" :disabled="currentSheet >= sheetCount" @click="currentSheet += 1">Suiv.</button>
          </div>
        </header>

        <ImpositionPreview :cards="sheetCards" :face="previewFace" :scale="previewScale" :back-alignment="backAlignment"
          :paper-format="paperFormat" />
      </section>
    </section>
  </main>
</template>

<script setup lang="ts">
import {
  PDFDocument,
  StandardFonts,
  appendBezierCurve,
  clip,
  closePath,
  endPath,
  lineTo,
  moveTo,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  type PDFImage,
  type PDFPage,
} from 'pdf-lib'
import CardSelector from '~/components/Print/CardSelector.vue'
import ImpositionPreview from '~/components/Print/ImpositionPreview.vue'
import { usePrintCardsStore } from '~/stores/printCards'
import { getYearColor } from '~/utils/colors'
import {
  A4_LANDSCAPE_MM,
  BLEED_MM,
  CARD_MM,
  CARDS_PER_SHEET,
  PAPER_FORMATS,
  getCardsForSheet,
  getPaperDimensions,
  getImpositionSlots,
  getSheetCount,
  mapCardsForBack,
  mmToPt,
  type BackAlignmentMode,
  type PaperDimensions,
  type PaperFormatId,
  type PrintCardItem,
} from '~/utils/print'
import type { Card } from '~~/types/types'

interface CardApiResponse {
  data?: PrintCardItem[]
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

definePageMeta({
  title: 'Print',
})

const printStore = usePrintCardsStore()

const page = ref(1)
const pageSize = ref(10)
const searchInput = ref('')
const searchQuery = ref('')
const displayMode = ref<'grid' | 'list'>('grid')

const exportMode = ref<'duplex' | 'separate'>('duplex')
const backAlignment = ref<BackAlignmentMode>('mirror')
const paperFormat = ref<PaperFormatId>('a4')
const includeCutMarks = ref(true)

const previewFace = ref<'front' | 'back'>('front')
const currentSheet = ref(1)
const previewScale = ref(0.31)

const isGenerating = ref(false)
const pdfError = ref('')
const isSearchModalOpen = ref(false)

const paperFormatEntries = Object.entries(PAPER_FORMATS)
const selectedPaperFormat = computed(() => PAPER_FORMATS[paperFormat.value])
const pageDimensions = computed<PaperDimensions>(() => getPaperDimensions(paperFormat.value))

let searchDebounce: ReturnType<typeof setTimeout> | null = null

watch(searchInput, (value) => {
  if (searchDebounce) {
    clearTimeout(searchDebounce)
  }

  searchDebounce = setTimeout(() => {
    page.value = 1
    searchQuery.value = value.trim().toLowerCase()
  }, 220)
})

onBeforeUnmount(() => {
  if (searchDebounce) {
    clearTimeout(searchDebounce)
  }
})

const { data, pending, error } = await useAsyncData<CardApiResponse>(
  'print-cards',
  async () => {
    const normalizedSearch = searchQuery.value.trim()
    const response = await $fetch<CardApiResponse>('/api/card', {
      params: {
        page: page.value,
        limit: pageSize.value,
        search: normalizedSearch || undefined,
      },
    })
    return response
  },
  {
    watch: [page, pageSize, searchQuery],
    default: () => ({ data: [], pagination: { page: 1, limit: 30, total: 0, totalPages: 1 } }),
  },
)

const cards = computed(() => data.value?.data || [])

const visibleCards = computed(() => {
  return cards.value
})

const totalItems = computed(() => {
  return data.value?.pagination?.total || cards.value.length
})

const totalPages = computed(() => {
  return Math.max(1, data.value?.pagination?.totalPages || 1)
})

watch(totalPages, (value) => {
  if (page.value > value) {
    page.value = value
  }
})

const errorMessage = computed(() => {
  return error.value ? 'Impossible de charger les cartes pour l\'impression.' : ''
})

const selectedCards = computed(() => printStore.selectedCards)
const selectedIds = computed(() => printStore.selectedSlugs)
const selectedCount = computed(() => printStore.selectedCount)
const sheetCount = computed(() => getSheetCount(selectedCount.value))

watch(sheetCount, (count) => {
  if (currentSheet.value > count) {
    currentSheet.value = count
  }
})

const sheetCards = computed(() => {
  return getCardsForSheet(selectedCards.value, currentSheet.value - 1)
})

const toggleSelection = (card: PrintCardItem) => {
  printStore.toggleCard(card)
}

const togglePageSelection = (checked: boolean) => {
  if (checked) {
    printStore.addMany(visibleCards.value)
    return
  }
  printStore.removeMany(visibleCards.value.map((card) => card.slug))
}

const onSelectFromSearch = (card: Card) => {
  printStore.toggleCard(card as PrintCardItem)
}

const updatePreviewScale = () => {
  if (window.matchMedia('(max-width: 1024px)').matches) {
    previewScale.value = 0.23
    return
  }
  previewScale.value = 0.7
}

onMounted(() => {
  updatePreviewScale()
  window.addEventListener('resize', updatePreviewScale)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updatePreviewScale)
})

interface LoadedImage {
  image: PDFImage
  width: number
  height: number
}

const imageCache = new Map<string, LoadedImage>()
const backCompositeCache = new Map<string, LoadedImage>()
const mediaCompositeCache = new Map<string, LoadedImage>()

const blobToPng = async (blob: Blob): Promise<Uint8Array> => {
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error('Canvas indisponible pour convertir l image')
  }

  ctx.drawImage(bitmap, 0, 0)
  const pngBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (!result) {
        reject(new Error('Conversion PNG echouee'))
        return
      }
      resolve(result)
    }, 'image/png')
  })

  return new Uint8Array(await pngBlob.arrayBuffer())
}

const svgBlobToPng = async (blob: Blob): Promise<Uint8Array> => {
  const objectUrl = URL.createObjectURL(blob)

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image()
    element.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(element)
    }
    element.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Decodage SVG echoue'))
    }
    element.src = objectUrl
  })

  const width = img.naturalWidth || 1200
  const height = img.naturalHeight || 1200

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error('Canvas indisponible pour convertir le SVG')
  }

  ctx.clearRect(0, 0, width, height)
  ctx.drawImage(img, 0, 0, width, height)

  const pngBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (!result) {
        reject(new Error('Conversion SVG vers PNG echouee'))
        return
      }
      resolve(result)
    }, 'image/png')
  })

  return new Uint8Array(await pngBlob.arrayBuffer())
}

const fitCover = (boxWidth: number, boxHeight: number, imageWidth: number, imageHeight: number) => {
  const ratio = Math.max(boxWidth / imageWidth, boxHeight / imageHeight)
  const width = imageWidth * ratio
  const height = imageHeight * ratio
  return {
    width,
    height,
    offsetX: (boxWidth - width) / 2,
    offsetY: (boxHeight - height) / 2,
  }
}

const sanitizeForPdfText = (value: string): string => {
  return value
    .replace(/♠/g, 'S')
    .replace(/♣/g, 'C')
    .replace(/♦/g, 'D')
    .replace(/♥/g, 'H')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '')
}

const hexToRgbColor = (hex: string) => {
  const normalized = hex.replace('#', '').trim()
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return rgb(0.12, 0.16, 0.23)
  }

  const r = parseInt(normalized.slice(0, 2), 16) / 255
  const g = parseInt(normalized.slice(2, 4), 16) / 255
  const b = parseInt(normalized.slice(4, 6), 16) / 255
  return rgb(r, g, b)
}

const loadPdfImage = async (doc: PDFDocument, url: string): Promise<LoadedImage | null> => {
  if (imageCache.has(url)) {
    return imageCache.get(url) as LoadedImage
  }

  try {
    const isLocalAsset = url.startsWith('/')
    const requestUrl = isLocalAsset ? url : `/api/print/image?url=${encodeURIComponent(url)}`
    const response = await fetch(requestUrl)
    if (!response.ok) {
      console.warn('[print] image fetch failed', requestUrl, response.status)
      return null
    }

    const contentType = (response.headers.get('content-type') || '').toLowerCase()
    const blob = await response.blob()
    const rawBuffer = new Uint8Array(await blob.arrayBuffer())
    const lowerUrl = url.toLowerCase()

    let image: PDFImage | null = null
    const isSvg = contentType.includes('svg') || lowerUrl.endsWith('.svg')

    try {
      if (isSvg) {
        image = await doc.embedPng(await svgBlobToPng(blob))
      } else if (contentType.includes('jpeg') || contentType.includes('jpg') || lowerUrl.endsWith('.jpg') || lowerUrl.endsWith('.jpeg')) {
        image = await doc.embedJpg(rawBuffer)
      } else if (contentType.includes('png') || lowerUrl.endsWith('.png')) {
        image = await doc.embedPng(rawBuffer)
      } else {
        image = await doc.embedPng(await blobToPng(blob))
      }
    } catch {
      try {
        image = await doc.embedPng(rawBuffer)
      } catch {
        try {
          image = await doc.embedJpg(rawBuffer)
        } catch {
          image = await doc.embedPng(await blobToPng(blob))
        }
      }
    }

    if (!image) {
      return null
    }

    const loaded: LoadedImage = {
      image,
      width: typeof image.width === 'number' ? image.width : 1,
      height: typeof image.height === 'number' ? image.height : 1,
    }

    imageCache.set(url, loaded)
    return loaded
  } catch (error) {
    console.warn('[print] unable to embed image, skipped', url, error)
    return null
  }
}

const getImageRequestUrl = (url: string) => {
  return url.startsWith('/') ? url : `/api/print/image?url=${encodeURIComponent(url)}`
}

const loadImageElement = async (url: string): Promise<HTMLImageElement> => {
  const response = await fetch(getImageRequestUrl(url))
  if (!response.ok) {
    throw new Error(`Image fetch failed (${response.status})`)
  }

  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)

  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Image decode failed'))
    }
    img.src = objectUrl
  })
}

const roundedRectPath = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

const loadMediaCompositeImage = async (
  doc: PDFDocument,
  card: PrintCardItem,
  face: 'front' | 'back',
): Promise<LoadedImage | null> => {
  const cacheKey = [
    'v5',
    face,
    card.slug || '',
    card.url_image || '',
    card.rank || '',
    card.suit || '',
    String(card.year || ''),
  ].join('|')

  if (mediaCompositeCache.has(cacheKey)) {
    return mediaCompositeCache.get(cacheKey) as LoadedImage
  }

  try {
    const insetMm = 2.6
    const mediaWidthMm = CARD_MM.width - insetMm * 2
    const mediaHeightMm = CARD_MM.height - insetMm * 2
    const widthPx = 900
    const heightPx = Math.round((widthPx * mediaHeightMm) / mediaWidthMm)
    const cornerRadiusPx = (2.2 / mediaWidthMm) * widthPx
    const pxPerMm = widthPx / mediaWidthMm

    const canvas = document.createElement('canvas')
    canvas.width = widthPx
    canvas.height = heightPx
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Canvas indisponible pour le composite carte')
    }

    ctx.clearRect(0, 0, widthPx, heightPx)
    roundedRectPath(ctx, 0, 0, widthPx, heightPx, cornerRadiusPx)
    ctx.clip()

    if (face === 'front') {
      if (card.url_image) {
        try {
          const cover = await loadImageElement(card.url_image)
          const fitted = fitCover(widthPx, heightPx, cover.naturalWidth || cover.width, cover.naturalHeight || cover.height)
          ctx.drawImage(cover, fitted.offsetX, fitted.offsetY, fitted.width, fitted.height)
        } catch {
          ctx.fillStyle = '#0b1f35'
          ctx.fillRect(0, 0, widthPx, heightPx)
        }
      } else {
        ctx.fillStyle = '#0b1f35'
        ctx.fillRect(0, 0, widthPx, heightPx)
      }

      const suitSymbol = card.suit || '♠'
      const suitAssetBySymbol: Record<string, string> = {
        '♠': '/%E2%99%A0.svg',
        '♣': '/%E2%99%A3.svg',
        '♦': '/%E2%99%A6.svg',
        '♥': '/%E2%99%A5.svg',
      }
      const suitIconSize = widthPx * 0.29
      const suitIconX = widthPx * 0.63
      const suitIconY = (heightPx * 0.01) + (3 * pxPerMm)
      const suitAsset = suitAssetBySymbol[suitSymbol]

      if (suitAsset) {
        try {
          const suitImg = await loadImageElement(suitAsset)
          ctx.drawImage(suitImg, suitIconX, suitIconY, suitIconSize, suitIconSize)
        } catch {
          const suitColor = suitSymbol === '♦' || suitSymbol === '♥' ? '#ea2b33' : '#ffffff'
          ctx.fillStyle = suitColor
          ctx.font = `700 ${Math.round(suitIconSize * 0.8)}px sans-serif`
          ctx.fillText(sanitizeForPdfText(suitSymbol), suitIconX + 4, suitIconY + suitIconSize * 0.82)
        }
      }

      const rankText = sanitizeForPdfText(`${card.rank || '?'}`)
      ctx.fillStyle = '#ffffff'
      ctx.font = `700 ${Math.round(widthPx * 0.104)}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(rankText, suitIconX + suitIconSize * 0.5, suitIconY + suitIconSize * 0.5)
    } else {
      const backColorHex = getYearColor(Number(card.year) || 0)
      ctx.fillStyle = backColorHex
      ctx.fillRect(0, 0, widthPx, heightPx)

      try {
        const motif = await loadImageElement('/face-down.svg')
        const fitted = fitCover(widthPx, heightPx, motif.naturalWidth || motif.width, motif.naturalHeight || motif.height)
        const zoom = 1.1
        const drawW = fitted.width * zoom
        const drawH = fitted.height * zoom
        const drawX = (widthPx - drawW) / 2
        const drawY = (heightPx - drawH) / 2
        ctx.drawImage(motif, drawX, drawY, drawW, drawH)
      } catch {
        // Keep the solid background color as fallback.
      }
    }

    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => {
        if (!result) {
          reject(new Error('Conversion PNG composite echouee'))
          return
        }
        resolve(result)
      }, 'image/png')
    })

    const bytes = new Uint8Array(await pngBlob.arrayBuffer())
    const embedded = await doc.embedPng(bytes)
    const loaded: LoadedImage = {
      image: embedded,
      width: typeof embedded.width === 'number' ? embedded.width : widthPx,
      height: typeof embedded.height === 'number' ? embedded.height : heightPx,
    }

    mediaCompositeCache.set(cacheKey, loaded)
    return loaded
  } catch (error) {
    console.warn('[print] media composite render failed', face, card.slug, error)
    return null
  }
}

const loadBackCompositeImage = async (doc: PDFDocument, colorHex: string, rotateUpsideDown: boolean): Promise<LoadedImage | null> => {
  const cacheKey = `back:v3:${colorHex}:${rotateUpsideDown ? 'rot' : 'nor'}`
  if (backCompositeCache.has(cacheKey)) {
    return backCompositeCache.get(cacheKey) as LoadedImage
  }

  try {
    const response = await fetch('/face-down.svg')
    if (!response.ok) {
      return null
    }

    const svgBlob = await response.blob()
    const objectUrl = URL.createObjectURL(svgBlob)
    const motif = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        URL.revokeObjectURL(objectUrl)
        resolve(img)
      }
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl)
        reject(new Error('Impossible de charger face-down.svg'))
      }
      img.src = objectUrl
    })

    const canvas = document.createElement('canvas')
    canvas.width = 900
    canvas.height = 1428
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Canvas indisponible pour le verso')
    }

    const w = canvas.width
    const h = canvas.height
    ctx.clearRect(0, 0, w, h)

    if (rotateUpsideDown) {
      ctx.translate(w, h)
      ctx.rotate(Math.PI)
    }

    ctx.fillStyle = colorHex
    ctx.fillRect(0, 0, w, h)

    const baseFit = fitCover(w, h, motif.naturalWidth || motif.width, motif.naturalHeight || motif.height)
    const zoom = 1.08
    const drawW = baseFit.width * zoom
    const drawH = baseFit.height * zoom
    const drawX = (w - drawW) / 2
    const drawY = (h - drawH) / 2
    ctx.drawImage(motif, drawX, drawY, drawW, drawH)

    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => {
        if (!result) {
          reject(new Error('Conversion PNG verso echouee'))
          return
        }
        resolve(result)
      }, 'image/png')
    })

    const pngBytes = new Uint8Array(await pngBlob.arrayBuffer())
    const embedded = await doc.embedPng(pngBytes)
    const loaded: LoadedImage = {
      image: embedded,
      width: typeof embedded.width === 'number' ? embedded.width : w,
      height: typeof embedded.height === 'number' ? embedded.height : h,
    }

    backCompositeCache.set(cacheKey, loaded)
    return loaded
  } catch (error) {
    console.warn('[print] back composite render failed', colorHex, error)
    return null
  }
}

const drawCardFace = async (
  doc: PDFDocument,
  pageRef: ReturnType<PDFDocument['addPage']>,
  card: PrintCardItem,
  slot: { xMm: number; yMm: number },
  pageDimensions: PaperDimensions,
  face: 'front' | 'back',
  backAlignment: BackAlignmentMode,
  layer: 'bleed' | 'content',
) => {
  const xTrim = slot.xMm
  const yTrim = slot.yMm
  const backColorHex = getYearColor(Number(card.year) || 0)
  const backColor = hexToRgbColor(backColorHex)

  const xBleed = xTrim - BLEED_MM
  const yBleed = yTrim - BLEED_MM
  const bleedWidth = CARD_MM.width + BLEED_MM * 2
  const bleedHeight = CARD_MM.height + BLEED_MM * 2

  const insetMm = face === 'front' ? 2.6 : 0
  const mediaX = xTrim + insetMm
  const mediaY = yTrim + insetMm
  const mediaWidth = CARD_MM.width - insetMm * 2
  const mediaHeight = CARD_MM.height - insetMm * 2

  const clipAndDrawFill = (
    page: PDFPage,
    fillColor: ReturnType<typeof rgb>,
    clipXmm: number,
    clipYmm: number,
    clipWidthMm: number,
    clipHeightMm: number,
    cornerRadiusMm = 0,
  ) => {
    const clipLeftPt: number = mmToPt(clipXmm)
    const clipBottomPt: number = mmToPt(pageDimensions.height - clipYmm - clipHeightMm)
    const clipRightPt: number = mmToPt(clipXmm + clipWidthMm)
    const clipTopPt: number = mmToPt(pageDimensions.height - clipYmm)
    const widthPt = clipRightPt - clipLeftPt
    const heightPt = clipTopPt - clipBottomPt
    const radiusPt = Math.max(0, Math.min(mmToPt(cornerRadiusMm), widthPt / 2, heightPt / 2))
    const k = 0.552284749831

    if (radiusPt > 0) {
      page.pushOperators(
        pushGraphicsState(),
        moveTo(clipLeftPt + radiusPt, clipBottomPt),
        lineTo(clipRightPt - radiusPt, clipBottomPt),
        appendBezierCurve(
          clipRightPt - radiusPt + radiusPt * k,
          clipBottomPt,
          clipRightPt,
          clipBottomPt + radiusPt - radiusPt * k,
          clipRightPt,
          clipBottomPt + radiusPt,
        ),
        lineTo(clipRightPt, clipTopPt - radiusPt),
        appendBezierCurve(
          clipRightPt,
          clipTopPt - radiusPt + radiusPt * k,
          clipRightPt - radiusPt + radiusPt * k,
          clipTopPt,
          clipRightPt - radiusPt,
          clipTopPt,
        ),
        lineTo(clipLeftPt + radiusPt, clipTopPt),
        appendBezierCurve(
          clipLeftPt + radiusPt - radiusPt * k,
          clipTopPt,
          clipLeftPt,
          clipTopPt - radiusPt + radiusPt * k,
          clipLeftPt,
          clipTopPt - radiusPt,
        ),
        lineTo(clipLeftPt, clipBottomPt + radiusPt),
        appendBezierCurve(
          clipLeftPt,
          clipBottomPt + radiusPt - radiusPt * k,
          clipLeftPt + radiusPt - radiusPt * k,
          clipBottomPt,
          clipLeftPt + radiusPt,
          clipBottomPt,
        ),
        closePath(),
        clip(),
        endPath(),
      )
    } else {
      page.pushOperators(
        pushGraphicsState(),
        moveTo(clipLeftPt, clipBottomPt),
        lineTo(clipRightPt, clipBottomPt),
        lineTo(clipRightPt, clipTopPt),
        lineTo(clipLeftPt, clipTopPt),
        closePath(),
        clip(),
        endPath(),
      )
    }

    page.drawRectangle({
      x: mmToPt(clipXmm),
      y: mmToPt(pageDimensions.height - clipYmm - clipHeightMm),
      width: mmToPt(clipWidthMm),
      height: mmToPt(clipHeightMm),
      color: fillColor,
    })

    page.pushOperators(popGraphicsState())
  }

  const clipAndDrawImage = (
    page: PDFPage,
    image: PDFImage,
    drawXmm: number,
    drawYmm: number,
    drawWidthMm: number,
    drawHeightMm: number,
    clipXmm: number,
    clipYmm: number,
    clipWidthMm: number,
    clipHeightMm: number,
    cornerRadiusMm = 0,
  ) => {
    const clipLeftPt: number = mmToPt(clipXmm)
    const clipBottomPt: number = mmToPt(pageDimensions.height - clipYmm - clipHeightMm)
    const clipRightPt: number = mmToPt(clipXmm + clipWidthMm)
    const clipTopPt: number = mmToPt(pageDimensions.height - clipYmm)
    const widthPt = clipRightPt - clipLeftPt
    const heightPt = clipTopPt - clipBottomPt
    const radiusPt = Math.max(0, Math.min(mmToPt(cornerRadiusMm), widthPt / 2, heightPt / 2))
    const k = 0.552284749831

    if (radiusPt > 0) {
      page.pushOperators(
        pushGraphicsState(),
        moveTo(clipLeftPt + radiusPt, clipBottomPt),
        lineTo(clipRightPt - radiusPt, clipBottomPt),
        appendBezierCurve(
          clipRightPt - radiusPt + radiusPt * k,
          clipBottomPt,
          clipRightPt,
          clipBottomPt + radiusPt - radiusPt * k,
          clipRightPt,
          clipBottomPt + radiusPt,
        ),
        lineTo(clipRightPt, clipTopPt - radiusPt),
        appendBezierCurve(
          clipRightPt,
          clipTopPt - radiusPt + radiusPt * k,
          clipRightPt - radiusPt + radiusPt * k,
          clipTopPt,
          clipRightPt - radiusPt,
          clipTopPt,
        ),
        lineTo(clipLeftPt + radiusPt, clipTopPt),
        appendBezierCurve(
          clipLeftPt + radiusPt - radiusPt * k,
          clipTopPt,
          clipLeftPt,
          clipTopPt - radiusPt + radiusPt * k,
          clipLeftPt,
          clipTopPt - radiusPt,
        ),
        lineTo(clipLeftPt, clipBottomPt + radiusPt),
        appendBezierCurve(
          clipLeftPt,
          clipBottomPt + radiusPt - radiusPt * k,
          clipLeftPt + radiusPt - radiusPt * k,
          clipBottomPt,
          clipLeftPt + radiusPt,
          clipBottomPt,
        ),
        closePath(),
        clip(),
        endPath(),
      )
    } else {
      page.pushOperators(
        pushGraphicsState(),
        moveTo(clipLeftPt, clipBottomPt),
        lineTo(clipRightPt, clipBottomPt),
        lineTo(clipRightPt, clipTopPt),
        lineTo(clipLeftPt, clipTopPt),
        closePath(),
        clip(),
        endPath(),
      )
    }

    page.drawImage(image, {
      x: mmToPt(drawXmm),
      y: mmToPt(pageDimensions.height - drawYmm - drawHeightMm),
      width: mmToPt(drawWidthMm),
      height: mmToPt(drawHeightMm),
    })

    page.pushOperators(popGraphicsState())
  }


  const cornerRadiusMm = face === 'front' ? 2.2 : 0
  const backBleedOverlapMm = 0.12

  if (layer === 'bleed') {
    pageRef.drawRectangle({
      x: mmToPt(xBleed),
      y: mmToPt(pageDimensions.height - yBleed - bleedHeight),
      width: mmToPt(bleedWidth),
      height: mmToPt(bleedHeight),
      color: rgb(1, 1, 1),
    })

    if (face === 'back') {
      // Slight overlap avoids hairline seams between adjacent bleed areas.
      pageRef.drawRectangle({
        x: mmToPt(xBleed - backBleedOverlapMm),
        y: mmToPt(pageDimensions.height - (yBleed - backBleedOverlapMm) - (bleedHeight + backBleedOverlapMm * 2)),
        width: mmToPt(bleedWidth + backBleedOverlapMm * 2),
        height: mmToPt(bleedHeight + backBleedOverlapMm * 2),
        color: backColor,
      })
    }

    return
  }

  if (face !== 'front') {
    clipAndDrawFill(pageRef, backColor, mediaX, mediaY, mediaWidth, mediaHeight, cornerRadiusMm)
  }

  if (face === 'front') {
    const composite = await loadMediaCompositeImage(doc, card, 'front')
    if (composite) {
      clipAndDrawImage(pageRef, composite.image, mediaX, mediaY, mediaWidth, mediaHeight, mediaX, mediaY, mediaWidth, mediaHeight, cornerRadiusMm)
    }
    return
  }

  const backComposite = await loadBackCompositeImage(doc, backColorHex, backAlignment === 'mirror')

  if (backComposite) {
    clipAndDrawImage(pageRef, backComposite.image, mediaX, mediaY, mediaWidth, mediaHeight, mediaX, mediaY, mediaWidth, mediaHeight, cornerRadiusMm)
  }
}

const drawCutMarksOnPage = (
  pageRef: ReturnType<PDFDocument['addPage']>,
  slots: ReturnType<typeof getImpositionSlots>,
  pageDimensions: PaperDimensions,
) => {
  const offset = 0.8
  const printerSafeMarginMm = 5
  const stroke = rgb(0.1, 0.1, 0.1)
  const thickness = mmToPt(0.2)

  const leftEdge = printerSafeMarginMm
  const rightEdge = pageDimensions.width - printerSafeMarginMm
  const bottomEdge = printerSafeMarginMm
  const topEdge = pageDimensions.height - printerSafeMarginMm

  const dedupe = (values: number[]): number[] => {
    return Array.from(new Set(values.map((value) => value.toFixed(4)))).map(Number).sort((a, b) => a - b)
  }

  const xCuts = dedupe(slots.flatMap((slot) => [slot.xMm, slot.xMm + CARD_MM.width]))
  const yCutsMm = dedupe(slots.flatMap((slot) => [slot.yMm, slot.yMm + CARD_MM.height]))

  const minX = Math.min(...slots.map((slot) => slot.xMm))
  const maxX = Math.max(...slots.map((slot) => slot.xMm + CARD_MM.width))
  const minY = Math.min(...slots.map((slot) => slot.yMm))
  const maxY = Math.max(...slots.map((slot) => slot.yMm + CARD_MM.height))

  const topCutY = pageDimensions.height - minY
  const bottomCutY = pageDimensions.height - maxY

  xCuts.forEach((x) => {
    pageRef.drawLine({
      start: { x: mmToPt(x), y: mmToPt(topCutY + offset) },
      end: { x: mmToPt(x), y: mmToPt(topEdge) },
      color: stroke,
      thickness,
    })

    pageRef.drawLine({
      start: { x: mmToPt(x), y: mmToPt(bottomCutY - offset) },
      end: { x: mmToPt(x), y: mmToPt(bottomEdge) },
      color: stroke,
      thickness,
    })
  })

  yCutsMm.forEach((yMm) => {
    const y = pageDimensions.height - yMm

    pageRef.drawLine({
      start: { x: mmToPt(leftEdge), y: mmToPt(y) },
      end: { x: mmToPt(minX - offset), y: mmToPt(y) },
      color: stroke,
      thickness,
    })

    pageRef.drawLine({
      start: { x: mmToPt(maxX + offset), y: mmToPt(y) },
      end: { x: mmToPt(rightEdge), y: mmToPt(y) },
      color: stroke,
      thickness,
    })
  })
}

const buildFacePage = async (
  doc: PDFDocument,
  cardsBySlot: (PrintCardItem | null)[],
  pageDimensions: PaperDimensions,
  face: 'front' | 'back',
  backAlignment: BackAlignmentMode,
) => {
  const pageRef = doc.addPage([mmToPt(pageDimensions.width), mmToPt(pageDimensions.height)])
  const slots = getImpositionSlots(pageDimensions)
  const font = await doc.embedFont(StandardFonts.Helvetica)

  pageRef.drawRectangle({
    x: 0,
    y: 0,
    width: mmToPt(pageDimensions.width),
    height: mmToPt(pageDimensions.height),
    color: rgb(1, 1, 1),
  })

  pageRef.drawText(`${face === 'front' ? 'Recto' : 'Verso'} - imposition 2 x 5 - ${selectedPaperFormat.value.label}`, {
    x: mmToPt(10),
    y: mmToPt(pageDimensions.height - 8),
    size: 9,
    color: rgb(0.38, 0.43, 0.49),
    font,
  })

  for (const layer of ['bleed', 'content'] as const) {
    for (const slot of slots) {
      const card = cardsBySlot[slot.index]
      if (!card) {
        continue
      }
      try {
        await drawCardFace(doc, pageRef, card, slot, pageDimensions, face, backAlignment, layer)
      } catch (error) {
        console.warn('[print] drawCardFace failed, skipping card', {
          face,
          layer,
          slot: slot.index,
          slug: card.slug,
          error,
        })
      }
    }
  }

  if (includeCutMarks.value) {
    drawCutMarksOnPage(pageRef, slots, pageDimensions)
  }
}

const generatePdf = async () => {
  if (import.meta.server || selectedCards.value.length === 0) {
    return
  }

  isGenerating.value = true
  pdfError.value = ''

  try {
    const doc = await PDFDocument.create()
    const totalSheets = Math.ceil(selectedCards.value.length / CARDS_PER_SHEET)
    const currentPageDimensions = pageDimensions.value

    if (exportMode.value === 'duplex') {
      for (let sheetIndex = 0; sheetIndex < totalSheets; sheetIndex += 1) {
        const frontCards = getCardsForSheet(selectedCards.value, sheetIndex)
        const frontBySlot = Array.from({ length: CARDS_PER_SHEET }, (_, index) => frontCards[index] || null)
        const backBySlot = mapCardsForBack(frontCards, backAlignment.value)

        await buildFacePage(doc, frontBySlot, currentPageDimensions, 'front', backAlignment.value)
        await buildFacePage(doc, backBySlot, currentPageDimensions, 'back', backAlignment.value)
      }
    } else {
      for (let sheetIndex = 0; sheetIndex < totalSheets; sheetIndex += 1) {
        const frontCards = getCardsForSheet(selectedCards.value, sheetIndex)
        const frontBySlot = Array.from({ length: CARDS_PER_SHEET }, (_, index) => frontCards[index] || null)
        await buildFacePage(doc, frontBySlot, currentPageDimensions, 'front', backAlignment.value)
      }

      for (let sheetIndex = 0; sheetIndex < totalSheets; sheetIndex += 1) {
        const frontCards = getCardsForSheet(selectedCards.value, sheetIndex)
        const backBySlot = mapCardsForBack(frontCards, backAlignment.value)
        await buildFacePage(doc, backBySlot, currentPageDimensions, 'back', backAlignment.value)
      }
    }

    const bytes = await doc.save()
    const normalizedBytes = Uint8Array.from(bytes)
    const blob = new Blob([normalizedBytes], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `imposition-cartes-${new Date().toISOString().slice(0, 10)}.pdf`
    anchor.click()
    URL.revokeObjectURL(url)
  } catch (error: unknown) {
    const details = error instanceof Error && error.message ? ` (${error.message})` : ''
    pdfError.value = `La generation du PDF a echoue.${details}`
    console.error('[print] generatePdf failed', error)
  } finally {
    isGenerating.value = false
  }
}
</script>

<style scoped>
.print-page {
  min-height: 100vh;
  padding: clamp(1rem, 2.2vw, 2rem);
  color: #112237;
  display: grid;
  gap: 1rem;
}

.hero {
  border: 1px solid #d5e2ee;
  border-radius: 1rem;
  padding: clamp(1rem, 2vw, 1.5rem);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  background: rgba(255, 255, 255, 0.92);
}

.eyebrow {
  font-size: 0.78rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #49627b;
}

.hero h1 {
  font-size: clamp(1.2rem, 3.4vw, 1.95rem);
  line-height: 1.15;
  margin-top: 0.3rem;
  font-weight: 800;
}

.subtitle {
  margin-top: 0.6rem;
  color: #3d556c;
  max-width: 68ch;
}

.print-hint {
  margin-top: -0.25rem;
  font-size: 0.92rem;
  color: #47627e;
}

.hero-actions {
  display: grid;
  justify-items: end;
  gap: 0.7rem;
}

.stats {
  text-align: right;
  display: grid;
  font-size: 0.88rem;
  color: #3e5c78;
}

.stats strong {
  font-size: 1.15rem;
  color: #152b44;
}

.primary-btn {
  border: 0;
  border-radius: 0.7rem;
  @apply bg-esyellow;
  font-weight: 700;
  padding: 0.65rem 1rem;
  cursor: pointer;
}

.primary-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  border: 1px solid #d4e0ec;
  border-radius: 0.85rem;
  background: rgba(255, 255, 255, 0.88);
  padding: 0.75rem;
}

.toolbar label {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.86rem;
  color: #3b5873;
}

.toolbar select {
  border: 1px solid #c4d5e5;
  border-radius: 0.45rem;
  background: #ffffff;
  color: #122b42;
  padding: 0.33rem 0.45rem;
}

.checkbox-inline {
  padding: 0.32rem 0.2rem;
}

.error-banner {
  border: 1px solid #fecaca;
  background: #fff1f1;
  color: #9f1239;
  border-radius: 0.65rem;
  padding: 0.6rem 0.75rem;
}

.layout-grid {
  display: grid;
  grid-template-columns: minmax(340px, 1fr) minmax(420px, 1.2fr);
  gap: 1rem;
}

.open-search-btn {
  border: 1px solid #355673;
  background: #0b1f35;
  color: #eff5fb;
  border-radius: 0.55rem;
  padding: 0.5rem 0.85rem;
  cursor: pointer;
  width: fit-content;
}

.preview-panel {
  display: grid;
  gap: 0.7rem;
}

.preview-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.7rem;
  flex-wrap: wrap;
}

.tabs {
  display: inline-flex;
  border: 1px solid #c7d7e6;
  background: #ffffff;
  border-radius: 0.65rem;
  overflow: hidden;
}

.tab-btn {
  border: 0;
  background: transparent;
  color: #3f5c79;
  padding: 0.45rem 0.8rem;
  cursor: pointer;
  font-weight: 600;
}

.tab-btn.active {
  background: #17344d;
  color: #ffffff;
}

.sheet-nav {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  color: #3e5871;
}

.sheet-nav button {
  border: 1px solid #bfd0e0;
  background: #ffffff;
  border-radius: 0.5rem;
  padding: 0.3rem 0.6rem;
  cursor: pointer;
}

.sheet-nav button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

@media (max-width: 1240px) {
  .layout-grid {
    grid-template-columns: 1fr;
  }

  .open-search-btn {
    width: 100%;
  }
}

@media (max-width: 800px) {
  .hero {
    flex-direction: column;
  }

  .hero-actions {
    justify-items: start;
  }
}

@media print {
  .print-page {
    background: #ffffff;
    padding: 0;
  }
}

@page {
  size: A4 landscape;
  margin: 0;
}
</style>
