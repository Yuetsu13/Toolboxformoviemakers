import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

/**
 * 先頭行の直下（viewport 固定）に候補を表示。親の overflow では切れない。
 */
function getFirstLineBelowPosition(textareaEl) {
  if (!textareaEl) return null
  const rect = textareaEl.getBoundingClientRect()
  const style = window.getComputedStyle(textareaEl)
  const padTop = parseFloat(style.paddingTop) || 0
  const fs = parseFloat(style.fontSize) || 14
  const lhRaw = style.lineHeight
  let lineHeight = fs * 1.4
  if (lhRaw && lhRaw !== 'normal') {
    const parsed = parseFloat(lhRaw)
    if (Number.isFinite(parsed)) lineHeight = parsed
  }
  const gap = 4
  const top = rect.top + padTop + lineHeight + gap
  const spaceBelow = window.innerHeight - top - 16
  const maxHeight = Math.min(280, Math.max(80, spaceBelow))
  return {
    top,
    left: rect.left,
    width: rect.width,
    maxHeight,
  }
}

/**
 * シーン・ロケーション・モデル等: 他列と同じ textarea。入力済み値を候補にフォーカスで表示（body レイヤー）。
 * 一度でも手入力したらそのセルでは候補は出さない（空欄に戻すと再表示）。
 */
export default function HistoryTextareaCell({ value, onChange, options = [] }) {
  const [open, setOpen] = useState(false)
  const [fixedPos, setFixedPos] = useState(null)
  /** 手入力があったら候補 UI は出さない。候補クリックのみでは false のまま */
  const [suppressSuggestions, setSuppressSuggestions] = useState(false)
  const textareaRef = useRef(null)
  const dropdownRef = useRef(null)

  const hasSuggestions = options.length > 0 && !suppressSuggestions

  const close = useCallback(() => {
    setOpen(false)
    setFixedPos(null)
  }, [])

  const updatePosition = useCallback(() => {
    const pos = getFirstLineBelowPosition(textareaRef.current)
    setFixedPos(pos)
  }, [])

  useLayoutEffect(() => {
    if (open && hasSuggestions) {
      updatePosition()
    }
  }, [open, hasSuggestions, updatePosition, value])

  useEffect(() => {
    if (!open) return
    const onScrollOrResize = () => updatePosition()
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      const t = e.target
      if (textareaRef.current?.contains(t)) return
      if (dropdownRef.current?.contains(t)) return
      close()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, close])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') close()
    }
    if (open) {
      document.addEventListener('keydown', onKey)
      return () => document.removeEventListener('keydown', onKey)
    }
  }, [open, close])

  const selectOption = (v) => {
    setSuppressSuggestions(false)
    onChange(v)
    close()
  }

  /** キーボード・ペースト等の直接入力では候補を以後出さない */
  const handleTextareaChange = (e) => {
    setSuppressSuggestions(true)
    close()
    onChange(e.target.value)
  }

  useEffect(() => {
    if (!(value ?? '').trim()) {
      setSuppressSuggestions(false)
    }
  }, [value])

  const dropdownContent =
    open && hasSuggestions && fixedPos ? (
      <div
        ref={dropdownRef}
        className="history-dropdown history-dropdown--portal"
        role="listbox"
        style={{
          position: 'fixed',
          top: fixedPos.top,
          left: fixedPos.left,
          width: fixedPos.width,
          maxHeight: fixedPos.maxHeight,
          zIndex: 10050,
        }}
      >
        <div className="history-dropdown-list">
          {options.map((opt) => (
            <button
              type="button"
              key={opt}
              className="history-dropdown-item"
              role="option"
              onMouseDown={(e) => {
                e.preventDefault()
                selectOption(opt)
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
    ) : null

  return (
    <div className="history-textarea-cell">
      <textarea
        ref={textareaRef}
        className="cell-textarea"
        value={value ?? ''}
        onChange={handleTextareaChange}
        onFocus={() => {
          if (options.length > 0 && !suppressSuggestions) {
            setOpen(true)
            requestAnimationFrame(() => updatePosition())
          }
        }}
        spellCheck={false}
        aria-autocomplete="list"
        aria-expanded={open && hasSuggestions}
      />
      {dropdownContent && typeof document !== 'undefined'
        ? createPortal(dropdownContent, document.body)
        : null}
    </div>
  )
}
