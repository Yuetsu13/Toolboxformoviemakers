import { useRef, useCallback, useEffect, useLayoutEffect, useState } from 'react'
import {
  clampCropOffsets,
  clampCropScale,
  computeContainScale,
  computeCropStateFromNaturalCrop,
  computeCropRectNatural,
  computeInitialScale,
  DISPLAY_CROP_HEIGHT,
  DISPLAY_CROP_WIDTH,
  LOW_RES_DISPLAY_THRESHOLD,
} from './imageCropUtils.js'

/** Max zoom-in relative to cover scale (wheel upper bound). */
const MAX_ZOOM_FACTOR = 12

/** Web と Excel で同一の crop（原画像座標）を state に保持 */
function cropPatchForState(image, cw, ch, overrides = {}) {
  const m = { ...image, ...overrides }
  if (!m.naturalWidth || !m.naturalHeight || !m.scale || m.scale <= 0) return {}
  return {
    crop: computeCropRectNatural({
      naturalWidth: m.naturalWidth,
      naturalHeight: m.naturalHeight,
      containerWidth: cw,
      containerHeight: ch,
      scale: m.scale,
      offsetX: m.offsetX ?? 0,
      offsetY: m.offsetY ?? 0,
    }),
  }
}

export default function ImageCropCell({ image, onChange, onClear }) {
  const frameRef = useRef(null)
  const [isEditing, setIsEditing] = useState(false)

  const isValidNaturalCrop = (c) => {
    if (!c) return false
    const { x, y, width, height } = c
    return (
      [x, y, width, height].every((v) => Number.isFinite(v)) &&
      width > 0 &&
      height > 0
    )
  }

  const measureAndInit = useCallback(() => {
    const el = frameRef.current
    if (!el || !image?.naturalWidth) return
    const cw = el.clientWidth
    const ch = el.clientHeight
    if (cw < 2 || ch < 2) return
    const nw = image.naturalWidth
    const nh = image.naturalHeight
    const cover = computeInitialScale(nw, nh, cw, ch)
    const contain = computeContainScale(nw, nh, cw, ch)
    const maxScale = Math.max(cover * MAX_ZOOM_FACTOR, 1)
    const needsInit = !image.initialScale || image.initialScale === 0 || !image.scale
    if (needsInit) {
      onChange({
        initialScale: cover,
        scale: cover,
        offsetX: 0,
        offsetY: 0,
        containerWidth: cw,
        containerHeight: ch,
        ...cropPatchForState(
          { ...image, scale: cover, offsetX: 0, offsetY: 0 },
          cw,
          ch
        ),
      })
    } else {
      const patch = {
        containerWidth: cw,
        containerHeight: ch,
        initialScale: cover,
      }

      const sizeChanged =
        image.containerWidth !== cw || image.containerHeight !== ch
      const coverChanged = image.initialScale !== cover

      // 列追加/削除などで container サイズだけが変わった場合:
      // image.crop（Excelに使う論理クロップ）を維持しつつ、Web表示に必要な scale/offset だけ再計算する。
      if (sizeChanged && isValidNaturalCrop(image.crop)) {
        const derived = computeCropStateFromNaturalCrop({
          naturalWidth: nw,
          naturalHeight: nh,
          containerWidth: cw,
          containerHeight: ch,
          crop: image.crop,
        })
        if (derived?.scale && Number.isFinite(derived.scale)) {
          onChange({
            ...patch,
            scale: derived.scale,
            offsetX: derived.offsetX,
            offsetY: derived.offsetY,
          })
          return
        }
      }

      const nextScale = clampCropScale(image.scale, contain, maxScale)
      const clamped = clampCropOffsets({
        scale: nextScale,
        offsetX: image.offsetX,
        offsetY: image.offsetY,
        naturalWidth: nw,
        naturalHeight: nh,
        containerWidth: cw,
        containerHeight: ch,
      })
      const scaleChanged = nextScale !== image.scale
      const offsetChanged =
        clamped.offsetX !== image.offsetX || clamped.offsetY !== image.offsetY

      if (scaleChanged || offsetChanged || sizeChanged || coverChanged) {
        onChange({
          ...patch,
          scale: nextScale,
          ...clamped,
          ...cropPatchForState(
            { ...image, scale: nextScale, ...clamped },
            cw,
            ch
          ),
        })
      }
    }
  }, [image, onChange])

  useLayoutEffect(() => {
    measureAndInit()
  }, [measureAndInit, image?.naturalWidth, image?.naturalHeight])

  useEffect(() => {
    const el = frameRef.current
    if (!el) return
    const ro = new ResizeObserver(() => measureAndInit())
    ro.observe(el)
    return () => ro.disconnect()
  }, [measureAndInit])

  useEffect(() => {
    if (!isEditing) return
    const onDoc = (e) => {
      if (frameRef.current && !frameRef.current.contains(e.target)) {
        setIsEditing(false)
      }
    }
    document.addEventListener('pointerdown', onDoc)
    return () => document.removeEventListener('pointerdown', onDoc)
  }, [isEditing])

  const applyClamp = useCallback(
    (partial) => {
      const el = frameRef.current
      const cw = el?.clientWidth ?? image.containerWidth ?? DISPLAY_CROP_WIDTH
      const ch = el?.clientHeight ?? image.containerHeight ?? DISPLAY_CROP_HEIGHT
      const next = { ...image, ...partial }
      const cover = computeInitialScale(next.naturalWidth, next.naturalHeight, cw, ch)
      const contain = computeContainScale(next.naturalWidth, next.naturalHeight, cw, ch)
      const maxScale = Math.max(cover * MAX_ZOOM_FACTOR, 1)
      const scale = clampCropScale(next.scale, contain, maxScale)
      const clamped = clampCropOffsets({
        scale,
        offsetX: next.offsetX,
        offsetY: next.offsetY,
        naturalWidth: next.naturalWidth,
        naturalHeight: next.naturalHeight,
        containerWidth: cw,
        containerHeight: ch,
      })
      onChange({
        ...partial,
        scale,
        ...clamped,
        ...cropPatchForState({ ...next, scale, ...clamped }, cw, ch),
      })
    },
    [image, onChange]
  )

  const onPointerDown = (e) => {
    if (!isEditing) return
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startY = e.clientY
    const origX = image.offsetX
    const origY = image.offsetY

    const move = (ev) => {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      applyClamp({
        offsetX: origX + dx,
        offsetY: origY + dy,
      })
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  const handleWheelNative = useCallback(
    (e) => {
      if (!isEditing) return
      e.preventDefault()
      e.stopPropagation()
      const el = frameRef.current
      const cw = el?.clientWidth ?? image.containerWidth ?? DISPLAY_CROP_WIDTH
      const ch = el?.clientHeight ?? image.containerHeight ?? DISPLAY_CROP_HEIGHT
      const nw = image.naturalWidth
      const nh = image.naturalHeight
      const cover = computeInitialScale(nw, nh, cw, ch)
      const contain = computeContainScale(nw, nh, cw, ch)
      const maxScale = Math.max(cover * MAX_ZOOM_FACTOR, 1)
      const factor = 1 - e.deltaY * 0.001
      const prevScale = image.scale
      let newScale = clampCropScale(prevScale * factor, contain, maxScale)
      let offsetX = image.offsetX
      let offsetY = image.offsetY
      // Optional: entering letterbox from cover — snap to center for predictable framing
      if (prevScale >= cover && newScale < cover) {
        offsetX = 0
        offsetY = 0
      }
      const clamped = clampCropOffsets({
        scale: newScale,
        offsetX,
        offsetY,
        naturalWidth: nw,
        naturalHeight: nh,
        containerWidth: cw,
        containerHeight: ch,
      })
      onChange({
        scale: newScale,
        ...clamped,
        ...cropPatchForState({ ...image, scale: newScale, ...clamped }, cw, ch),
      })
    },
    [isEditing, image, onChange]
  )

  useEffect(() => {
    const el = frameRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheelNative, { passive: false })
    return () => el.removeEventListener('wheel', handleWheelNative)
  }, [handleWheelNative])

  const onDoubleClick = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const el = frameRef.current
    const cw = el?.clientWidth ?? image.containerWidth ?? DISPLAY_CROP_WIDTH
    const ch = el?.clientHeight ?? image.containerHeight ?? DISPLAY_CROP_HEIGHT
    const init = computeInitialScale(image.naturalWidth, image.naturalHeight, cw, ch)
    onChange({
      initialScale: init,
      scale: init,
      offsetX: 0,
      offsetY: 0,
      ...cropPatchForState(
        { ...image, scale: init, offsetX: 0, offsetY: 0 },
        cw,
        ch
      ),
    })
  }

  const { naturalWidth, naturalHeight, scale, offsetX, offsetY } = image

  const showLowResHint = naturalWidth > 0 && naturalWidth < LOW_RES_DISPLAY_THRESHOLD

  return (
    <div className="image-crop-wrap">
      <div
        ref={frameRef}
        className={`image-crop-frame ${isEditing ? 'image-crop-frame--editing' : ''}`}
        onClick={(e) => {
          e.stopPropagation()
          setIsEditing(true)
        }}
        onPointerDown={onPointerDown}
        onDoubleClick={onDoubleClick}
        role="presentation"
      >
        <img
          src={image.objectUrl}
          alt=""
          className="image-crop-img"
          draggable={false}
          width={naturalWidth}
          height={naturalHeight}
          style={{
            transform: `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px)) scale(${scale})`,
          }}
        />
        {showLowResHint ? (
          <span className="image-crop-lowres-hint" title="表示より低い解像度の画像です">
            低解像度
          </span>
        ) : null}
      </div>
      <button
        type="button"
        className="image-clear"
        onClick={(e) => {
          e.stopPropagation()
          onClear()
        }}
        aria-label="画像を削除"
      >
        ×
      </button>
    </div>
  )
}
