/**
 * Logical crop frame (16:9) — Excel 表示サイズ（ext）とエクスポート論理解像度の基準。
 * 内部キャンバスは logical × INTERNAL_RENDER_SCALE。
 */
export const DISPLAY_CROP_WIDTH = 310
export const DISPLAY_CROP_HEIGHT = Math.round((DISPLAY_CROP_WIDTH * 9) / 16) // 174 @ 16:9

/** キャンバス = logical × scale（Excel の ext は logical のみ） */
export const INTERNAL_RENDER_SCALE = 2

/** Below this natural width (px), UI may show a low-resolution hint. */
export const LOW_RES_DISPLAY_THRESHOLD = DISPLAY_CROP_WIDTH * 1.5

/**
 * 原画像座標系での「枠に対応する矩形」（Web の translate+scale+clip と同じ意味）。
 * x,y = 原画像左上基準、width/height = 原画像上で見えている範囲（レターボックス時は画像外を含む論理サイズ）。
 */
export function computeCropRectNatural({
  naturalWidth: nw,
  naturalHeight: nh,
  containerWidth: cw,
  containerHeight: ch,
  scale: s,
  offsetX: ox = 0,
  offsetY: oy = 0,
}) {
  if (!nw || !nh || !cw || !ch || !s || s <= 0) {
    return { x: 0, y: 0, width: nw || 0, height: nh || 0 }
  }
  return {
    x: nw / 2 - (cw / 2 + ox) / s,
    y: nh / 2 - (ch / 2 + oy) / s,
    width: cw / s,
    height: ch / s,
  }
}

/**
 * natural crop（原画像座標の矩形）から、Web の pan/zoom 表示用の scale/offset を逆算する。
 *
 * 目的:
 * - 列追加/削除などで containerWidth/containerHeight が変わっても
 *   image.crop（Excel に使う論理クロップ）を変えずに、Web表示だけ適応する。
 */
export function computeCropStateFromNaturalCrop({
  naturalWidth: nw,
  naturalHeight: nh,
  containerWidth: cw,
  containerHeight: ch,
  crop,
}) {
  if (!nw || !nh || !cw || !ch || !crop) return null
  const x = crop.x
  const y = crop.y
  const w = crop.width
  const h = crop.height
  if (![x, y, w, h].every((v) => Number.isFinite(v))) return null
  if (w <= 0 || h <= 0) return null

  const scaleFromW = cw / w
  const scaleFromH = ch / h
  let scale = null
  if (Number.isFinite(scaleFromW) && scaleFromW > 0 && Number.isFinite(scaleFromH) && scaleFromH > 0) {
    scale = (scaleFromW + scaleFromH) / 2
  } else if (Number.isFinite(scaleFromW) && scaleFromW > 0) {
    scale = scaleFromW
  } else if (Number.isFinite(scaleFromH) && scaleFromH > 0) {
    scale = scaleFromH
  }
  if (!scale || !Number.isFinite(scale) || scale <= 0) return null

  // 逆変換（computeCropRectNatural の代数的な逆）
  const offsetX = scale * (nw / 2 - x) - cw / 2
  const offsetY = scale * (nh / 2 - y) - ch / 2

  return { scale, offsetX, offsetY }
}

/**
 * crop（原画像座標）を論理枠 lw×lh にマッピングして描画。画像外は白、Web プレビューと一致。
 */
export function renderCropToImageBase64FromNaturalCrop(
  imageElement,
  naturalWidth,
  naturalHeight,
  crop,
  options = {}
) {
  const lw = options.logicalWidth ?? DISPLAY_CROP_WIDTH
  const lh = options.logicalHeight ?? DISPLAY_CROP_HEIGHT
  const internalScale = options.internalScale ?? INTERNAL_RENDER_SCALE
  const format = options.format ?? 'png'
  const quality = options.quality ?? 0.92

  const canvasW = Math.round(lw * internalScale)
  const canvasH = Math.round(lh * internalScale)
  const canvas = document.createElement('canvas')
  canvas.width = canvasW
  canvas.height = canvasH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvasW, canvasH)

  const iw = naturalWidth
  const ih = naturalHeight
  const { x: cx, y: cy, width: cww, height: chh } = crop
  if (cww <= 0 || chh <= 0) {
    const dataUrl =
      format === 'png' || format === 'image/png'
        ? canvas.toDataURL('image/png')
        : canvas.toDataURL('image/jpeg', quality)
    return dataUrl.replace(/^data:image\/[^;]+;base64,/, '')
  }

  const sx0 = Math.max(0, cx)
  const sy0 = Math.max(0, cy)
  const sx1 = Math.min(iw, cx + cww)
  const sy1 = Math.min(ih, cy + chh)
  const sw = sx1 - sx0
  const sh = sy1 - sy0

  if (sw > 0 && sh > 0) {
    const dx = ((sx0 - cx) / cww) * lw
    const dy = ((sy0 - cy) / chh) * lh
    const dw = (sw / cww) * lw
    const dh = (sh / chh) * lh
    ctx.drawImage(
      imageElement,
      sx0,
      sy0,
      sw,
      sh,
      dx * internalScale,
      dy * internalScale,
      dw * internalScale,
      dh * internalScale
    )
  }

  const dataUrl =
    format === 'png' || format === 'image/png'
      ? canvas.toDataURL('image/png')
      : canvas.toDataURL('image/jpeg', quality)
  return dataUrl.replace(/^data:image\/[^;]+;base64,/, '')
}

/**
 * pan/zoom から crop を求めて描画（後方互換・単一経路は crop 矩形）。
 */
export function renderCropToImageBase64(
  imageElement,
  {
    naturalWidth,
    naturalHeight,
    containerWidth,
    containerHeight,
    scale,
    offsetX,
    offsetY,
  },
  options = {}
) {
  const crop = computeCropRectNatural({
    naturalWidth,
    naturalHeight,
    containerWidth,
    containerHeight,
    scale,
    offsetX: offsetX ?? 0,
    offsetY: offsetY ?? 0,
  })
  return renderCropToImageBase64FromNaturalCrop(
    imageElement,
    naturalWidth,
    naturalHeight,
    crop,
    options
  )
}

/** @deprecated 互換名 — renderCropToImageBase64 を使用 */
export const renderCropToJpegBase64 = renderCropToImageBase64

/**
 * Clamp pan offsets. Works for both "cover" (image larger than frame) and
 * "contain" / letterbox (image smaller than frame): max pan is half the size difference.
 */
export function clampCropOffsets({
  scale,
  offsetX,
  offsetY,
  naturalWidth,
  naturalHeight,
  containerWidth,
  containerHeight,
}) {
  const scaledW = naturalWidth * scale
  const scaledH = naturalHeight * scale
  const maxX = Math.abs(scaledW - containerWidth) / 2
  const maxY = Math.abs(scaledH - containerHeight) / 2
  return {
    offsetX: Math.max(-maxX, Math.min(maxX, offsetX)),
    offsetY: Math.max(-maxY, Math.min(maxY, offsetY)),
  }
}

/**
 * Cover scale: image scaled to fully cover container (like object-fit: cover).
 * Use for initial view and reset — no letterboxing.
 */
export function computeInitialScale(naturalWidth, naturalHeight, containerWidth, containerHeight) {
  return Math.max(containerWidth / naturalWidth, containerHeight / naturalHeight)
}

/** Alias for cover scale (readability). */
export const computeCoverScale = computeInitialScale

/**
 * Contain scale: entire image fits inside the frame (letterboxing possible when zoomed out).
 */
export function computeContainScale(naturalWidth, naturalHeight, containerWidth, containerHeight) {
  if (!naturalWidth || !naturalHeight) return 1
  return Math.min(containerWidth / naturalWidth, containerHeight / naturalHeight)
}

/** Clamp scale to zoom range [containScale, maxScale]. */
export function clampCropScale(scale, containScale, maxScale) {
  return Math.min(maxScale, Math.max(containScale, scale))
}

export function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = url
  })
}

/**
 * Excel: 常に crop 矩形でキャンバス描画（元画像直埋め込みなし）。PNG 既定。
 */
export async function cropStateToExportImage(imageState, options = {}) {
  const quality = options.quality ?? 0.92
  const internalScale = options.internalScale ?? INTERNAL_RENDER_SCALE
  const format = options.format ?? 'png'

  if (!imageState?.objectUrl) throw new Error('No image')
  const img = await loadImageFromUrl(imageState.objectUrl)
  const iw = imageState.naturalWidth || img.naturalWidth
  const ih = imageState.naturalHeight || img.naturalHeight
  const cw = imageState.containerWidth ?? DISPLAY_CROP_WIDTH
  const ch = imageState.containerHeight ?? DISPLAY_CROP_HEIGHT
  const cover = computeInitialScale(iw, ih, cw, ch)
  const scale =
    imageState.scale != null && imageState.scale > 0 ? imageState.scale : cover

  const c = imageState.crop
  const cropValid =
    c &&
    typeof c.x === 'number' &&
    typeof c.y === 'number' &&
    typeof c.width === 'number' &&
    typeof c.height === 'number' &&
    c.width > 0 &&
    c.height > 0

  const crop = cropValid
    ? c
    : computeCropRectNatural({
          naturalWidth: iw,
          naturalHeight: ih,
          containerWidth: cw,
          containerHeight: ch,
          scale,
          offsetX: imageState.offsetX ?? 0,
          offsetY: imageState.offsetY ?? 0,
        })

  const lw = options.logicalWidth ?? DISPLAY_CROP_WIDTH
  const lh = options.logicalHeight ?? DISPLAY_CROP_HEIGHT

  const base64 = renderCropToImageBase64FromNaturalCrop(
    img,
    iw,
    ih,
    crop,
    { logicalWidth: lw, logicalHeight: lh, internalScale, quality, format }
  )
  const extension = format === 'jpeg' || format === 'image/jpeg' ? 'jpeg' : 'png'
  return { base64, extension }
}

/**
 * @deprecated Prefer cropStateToExportImage
 */
export async function cropStateToJpegBase64(
  imageState,
  _outputWidth,
  _outputHeight,
  quality = 0.92
) {
  const { base64 } = await cropStateToExportImage(imageState, { quality, format: 'jpeg' })
  return base64
}
