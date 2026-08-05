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
import { computed, ref, watch, type Ref } from 'vue'
import { getYearColor } from '~/utils/colors'
import {
  BLEED_MM,
  CARD_MM,
  CARDS_PER_SHEET,
  PAPER_FORMATS,
  getCardsForSheet,
  getImpositionSlots,
  getPaperDimensions,
  mapCardsForBack,
  mmToPt,
  type BackAlignmentMode,
  type PaperDimensions,
  type PaperFormatId,
  type PrintCardItem,
  type PrintExportMode,
} from '~/utils/print'

type ValueRef<T> = Readonly<Ref<T>>

type UsePrintPdfOptions = {
  selectedCards: ValueRef<PrintCardItem[]>
  exportMode: ValueRef<PrintExportMode>
  backAlignment: ValueRef<BackAlignmentMode>
  paperFormat: ValueRef<PaperFormatId>
  includeCutMarks: ValueRef<boolean>
  roundedFront: ValueRef<boolean>
  includeLaminationMargin: ValueRef<boolean>
}

interface LoadedImage {
  image: PDFImage
  width: number
  height: number
}

const backCompositeCache = new Map<string, LoadedImage>()
const mediaCompositeCache = new Map<string, LoadedImage>()

// Final laminated card target remains CARD_MM, so we cut 2mm smaller before lamination.
const PRE_LAMINATION_DELTA_MM = 2
const PRE_LAMINATION_INSET_MM = PRE_LAMINATION_DELTA_MM / 2
const PRE_LAMINATION_TRIM_MM = {
  width: CARD_MM.width - PRE_LAMINATION_DELTA_MM,
  height: CARD_MM.height - PRE_LAMINATION_DELTA_MM,
} as const

export const usePrintPdf = (options: UsePrintPdfOptions) => {
  const isGenerating = ref(false)
  const pdfError = ref('')

  const selectedPaperFormat = computed(() => PAPER_FORMATS[options.paperFormat.value])
  const pageDimensions = computed<PaperDimensions>(() => getPaperDimensions(options.paperFormat.value))

  watch(() => options.selectedCards.value.length, (count) => {
    if (count < 1) {
      pdfError.value = ''
    }
  })

  const getTrimInsetMm = () => {
    return options.includeLaminationMargin.value ? PRE_LAMINATION_INSET_MM : 0
  }

  const getTrimDimensionsMm = () => {
    if (!options.includeLaminationMargin.value) {
      return {
        width: CARD_MM.width,
        height: CARD_MM.height,
      }
    }

    return {
      width: PRE_LAMINATION_TRIM_MM.width,
      height: PRE_LAMINATION_TRIM_MM.height,
    }
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
    rounded = true,
  ): Promise<LoadedImage | null> => {
    const cacheKey = [
      'v5',
      face,
      card.slug || '',
      card.url_image || '',
      card.rank || '',
      card.suit || '',
      String(card.year || ''),
      rounded ? 'r' : 'sq',
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
      const cornerRadiusPx = rounded ? (2.2 / mediaWidthMm) * widthPx : 0
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
        const suitIconX = widthPx * 0.08
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
    currentPageDimensions: PaperDimensions,
    face: 'front' | 'back',
    backAlignment: BackAlignmentMode,
    layer: 'bleed' | 'content',
    rounded = true,
  ) => {
    const trimInset = getTrimInsetMm()
    const trimDimensions = getTrimDimensionsMm()
    const xTrim = slot.xMm + trimInset
    const yTrim = slot.yMm + trimInset
    const trimWidth = trimDimensions.width
    const trimHeight = trimDimensions.height
    const backColorHex = getYearColor(Number(card.year) || 0)
    const backColor = hexToRgbColor(backColorHex)

    const xBleed = xTrim - BLEED_MM
    const yBleed = yTrim - BLEED_MM
    const bleedWidth = trimWidth + BLEED_MM * 2
    const bleedHeight = trimHeight + BLEED_MM * 2

    const insetMm = face === 'front' ? 2.6 : 0
    const mediaX = xTrim + insetMm
    const mediaY = yTrim + insetMm
    const mediaWidth = trimWidth - insetMm * 2
    const mediaHeight = trimHeight - insetMm * 2

    const clipAndDrawFill = (
      page: PDFPage,
      fillColor: ReturnType<typeof rgb>,
      clipXmm: number,
      clipYmm: number,
      clipWidthMm: number,
      clipHeightMm: number,
      cornerRadiusMm = 0,
    ) => {
      const clipLeftPt = mmToPt(clipXmm)
      const clipBottomPt = mmToPt(currentPageDimensions.height - clipYmm - clipHeightMm)
      const clipRightPt = mmToPt(clipXmm + clipWidthMm)
      const clipTopPt = mmToPt(currentPageDimensions.height - clipYmm)
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
        y: mmToPt(currentPageDimensions.height - clipYmm - clipHeightMm),
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
      const clipLeftPt = mmToPt(clipXmm)
      const clipBottomPt = mmToPt(currentPageDimensions.height - clipYmm - clipHeightMm)
      const clipRightPt = mmToPt(clipXmm + clipWidthMm)
      const clipTopPt = mmToPt(currentPageDimensions.height - clipYmm)
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
        y: mmToPt(currentPageDimensions.height - drawYmm - drawHeightMm),
        width: mmToPt(drawWidthMm),
        height: mmToPt(drawHeightMm),
      })

      page.pushOperators(popGraphicsState())
    }

    const cornerRadiusMm = face === 'front' && rounded ? 2.2 : 0
    const backBleedOverlapMm = 0.12

    if (layer === 'bleed') {
      pageRef.drawRectangle({
        x: mmToPt(xBleed),
        y: mmToPt(currentPageDimensions.height - yBleed - bleedHeight),
        width: mmToPt(bleedWidth),
        height: mmToPt(bleedHeight),
        color: rgb(1, 1, 1),
      })

      if (face === 'back') {
        // Slight overlap avoids hairline seams between adjacent bleed areas.
        pageRef.drawRectangle({
          x: mmToPt(xBleed - backBleedOverlapMm),
          y: mmToPt(currentPageDimensions.height - (yBleed - backBleedOverlapMm) - (bleedHeight + backBleedOverlapMm * 2)),
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
      const composite = await loadMediaCompositeImage(doc, card, 'front', rounded)
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
    currentPageDimensions: PaperDimensions,
  ) => {
    const trimInset = getTrimInsetMm()
    const trimDimensions = getTrimDimensionsMm()

    const offset = 0.8
    const printerSafeMarginMm = 5
    const stroke = rgb(0.1, 0.1, 0.1)
    const thickness = mmToPt(0.2)

    const leftEdge = printerSafeMarginMm
    const rightEdge = currentPageDimensions.width - printerSafeMarginMm
    const bottomEdge = printerSafeMarginMm
    const topEdge = currentPageDimensions.height - printerSafeMarginMm

    const dedupe = (values: number[]): number[] => {
      return Array.from(new Set(values.map((value) => value.toFixed(4)))).map(Number).sort((a, b) => a - b)
    }

    const xCuts = dedupe(
      slots.flatMap((slot) => [
        slot.xMm + trimInset,
        slot.xMm + trimInset + trimDimensions.width,
      ]),
    )
    const yCutsMm = dedupe(
      slots.flatMap((slot) => [
        slot.yMm + trimInset,
        slot.yMm + trimInset + trimDimensions.height,
      ]),
    )

    const minX = Math.min(...slots.map((slot) => slot.xMm + trimInset))
    const maxX = Math.max(...slots.map((slot) => slot.xMm + trimInset + trimDimensions.width))
    const minY = Math.min(...slots.map((slot) => slot.yMm + trimInset))
    const maxY = Math.max(...slots.map((slot) => slot.yMm + trimInset + trimDimensions.height))

    const topCutY = currentPageDimensions.height - minY
    const bottomCutY = currentPageDimensions.height - maxY

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
      const y = currentPageDimensions.height - yMm

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
    currentPageDimensions: PaperDimensions,
    face: 'front' | 'back',
    backAlignment: BackAlignmentMode,
  ) => {
    const pageRef = doc.addPage([mmToPt(currentPageDimensions.width), mmToPt(currentPageDimensions.height)])
    const slots = getImpositionSlots(currentPageDimensions)
    const font = await doc.embedFont(StandardFonts.Helvetica)

    pageRef.drawRectangle({
      x: 0,
      y: 0,
      width: mmToPt(currentPageDimensions.width),
      height: mmToPt(currentPageDimensions.height),
      color: rgb(1, 1, 1),
    })

    pageRef.drawText(`${face === 'front' ? 'Recto' : 'Verso'} - imposition 2 x 5 - ${selectedPaperFormat.value.label}`, {
      x: mmToPt(10),
      y: mmToPt(currentPageDimensions.height - 8),
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
          await drawCardFace(doc, pageRef, card, slot, currentPageDimensions, face, backAlignment, layer, options.roundedFront.value)
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

    if (options.includeCutMarks.value) {
      drawCutMarksOnPage(pageRef, slots, currentPageDimensions)
    }
  }

  const generatePdf = async () => {
    if (import.meta.server || options.selectedCards.value.length === 0) {
      return
    }

    isGenerating.value = true
    pdfError.value = ''

    // Embedded PDFImage instances are bound to a specific PDFDocument.
    // Reset caches before each generation to avoid reusing stale images.
    backCompositeCache.clear()
    mediaCompositeCache.clear()

    try {
      const doc = await PDFDocument.create()
      const totalSheets = Math.ceil(options.selectedCards.value.length / CARDS_PER_SHEET)
      const currentPageDimensions = pageDimensions.value

      if (options.exportMode.value === 'duplex') {
        for (let sheetIndex = 0; sheetIndex < totalSheets; sheetIndex += 1) {
          const frontCards = getCardsForSheet(options.selectedCards.value, sheetIndex)
          const frontBySlot = Array.from({ length: CARDS_PER_SHEET }, (_, index) => frontCards[index] || null)
          const backBySlot = mapCardsForBack(frontCards, options.backAlignment.value)

          await buildFacePage(doc, frontBySlot, currentPageDimensions, 'front', options.backAlignment.value)
          await buildFacePage(doc, backBySlot, currentPageDimensions, 'back', options.backAlignment.value)
        }
      } else {
        for (let sheetIndex = 0; sheetIndex < totalSheets; sheetIndex += 1) {
          const frontCards = getCardsForSheet(options.selectedCards.value, sheetIndex)
          const frontBySlot = Array.from({ length: CARDS_PER_SHEET }, (_, index) => frontCards[index] || null)
          await buildFacePage(doc, frontBySlot, currentPageDimensions, 'front', options.backAlignment.value)
        }

        for (let sheetIndex = 0; sheetIndex < totalSheets; sheetIndex += 1) {
          const frontCards = getCardsForSheet(options.selectedCards.value, sheetIndex)
          const backBySlot = mapCardsForBack(frontCards, options.backAlignment.value)
          await buildFacePage(doc, backBySlot, currentPageDimensions, 'back', options.backAlignment.value)
        }
      }

      const bytes = await doc.save()
      const normalizedBytes = Uint8Array.from(bytes)
      const blob = new Blob([normalizedBytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `imposition-cartes-${new Date().toISOString().slice(0, 10)}.pdf`
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => {
        URL.revokeObjectURL(url)
      }, 0)
    } catch (error: unknown) {
      const details = error instanceof Error && error.message ? ` (${error.message})` : ''
      pdfError.value = `La generation du PDF a echoue.${details}`
      console.error('[print] generatePdf failed', error)
    } finally {
      isGenerating.value = false
    }
  }

  return {
    generatePdf,
    isGenerating,
    pageDimensions,
    pdfError,
    selectedPaperFormat,
  }
}