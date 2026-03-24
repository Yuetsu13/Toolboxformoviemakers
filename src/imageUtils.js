/**
 * Process an image file to a 16:9 thumbnail (center crop, no stretch).
 * Returns base64 JPEG and data URL for preview.
 * @param {File} file - Image file from input/drop
 * @param {Object} options
 * @param {number} options.outputWidth - Output width (default 620, 2× vs 310 display)
 * @param {number} options.outputHeight - Output height (default 348, 16:9)
 * @param {number} options.quality - JPEG quality 0-1 (default 0.92)
 * @returns {Promise<{ base64: string, previewUrl: string }>}
 */
export function processImage(file, options = {}) {
  const outputWidth = options.outputWidth ?? 620
  const outputHeight = options.outputHeight ?? 348
  const quality = options.quality ?? 0.92

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()

    img.onload = () => {
      URL.revokeObjectURL(url)
      try {
        const result = drawThumbnail(img, outputWidth, outputHeight, quality)
        resolve(result)
      } catch (err) {
        reject(err)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }
    img.src = url
  })
}

const ASPECT_16_9 = 16 / 9

/**
 * Draw 16:9 center-cropped and resized thumbnail to canvas, return base64 JPEG.
 * @param {HTMLImageElement} img
 * @param {number} outW
 * @param {number} outH
 * @param {number} quality
 * @returns {{ base64: string, previewUrl: string }}
 */
function drawThumbnail(img, outW, outH, quality) {
  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')

  const srcW = img.naturalWidth
  const srcH = img.naturalHeight
  const srcAspect = srcW / srcH

  let drawW, drawH, sx, sy
  if (srcAspect > ASPECT_16_9) {
    drawH = srcH
    drawW = srcH * ASPECT_16_9
    sx = (srcW - drawW) / 2
    sy = 0
  } else {
    drawW = srcW
    drawH = srcW / ASPECT_16_9
    sx = 0
    sy = (srcH - drawH) / 2
  }

  ctx.drawImage(img, sx, sy, drawW, drawH, 0, 0, outW, outH)
  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  const base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, '')
  const previewUrl = `data:image/jpeg;base64,${base64}`

  return { base64, previewUrl }
}
