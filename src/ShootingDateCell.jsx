import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土']

export function parseYMD(s) {
  if (!s || !String(s).trim()) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s).trim())
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  const d = Number(m[3])
  const dt = new Date(y, mo, d)
  if (
    dt.getFullYear() !== y ||
    dt.getMonth() !== mo ||
    dt.getDate() !== d
  ) {
    return null
  }
  return dt
}

export function toYMD(d) {
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${day}`
}

/** 表示用 yyyy/MM/dd（YYYY-MM-DD 以外の旧データはそのまま表示） */
export function formatDisplayYMD(ymdString) {
  const raw = String(ymdString ?? '').trim()
  const d = parseYMD(raw)
  if (!d) return raw
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function buildMonthGrid(viewMonth) {
  const y = viewMonth.getFullYear()
  const m = viewMonth.getMonth()
  const first = new Date(y, m, 1)
  const startPad = first.getDay()
  const total = daysInMonth(y, m)
  const cells = []
  for (let i = 0; i < startPad; i++) cells.push(null)
  for (let day = 1; day <= total; day++) {
    cells.push(new Date(y, m, day))
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

/** ローカル日付が同一か（時刻無視） */
function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** 未入力時の既定ハイライト用（本日 0:00 ローカル） */
function todayDate() {
  const n = new Date()
  return new Date(n.getFullYear(), n.getMonth(), n.getDate())
}

/** 日付1行目の基準（viewport）。textarea は高さ120pxなので rect 全体ではなく1行分で計算 */
function getTextAreaFirstLineMetrics(textareaEl) {
  const rect = textareaEl.getBoundingClientRect()
  const style = window.getComputedStyle(textareaEl)
  const padTop = parseFloat(style.paddingTop) || 0
  const padLeft = parseFloat(style.paddingLeft) || 0
  const fs = parseFloat(style.fontSize) || 14
  const lhRaw = style.lineHeight
  let lineHeight = fs * 1.4
  if (lhRaw && lhRaw !== 'normal') {
    const p = parseFloat(lhRaw)
    if (Number.isFinite(p)) lineHeight = p
  }
  const gapBelow = 4
  const lineTop = rect.top + padTop
  const lineBottom = lineTop + lineHeight
  return {
    left: rect.left + padLeft,
    /** 1行目のすぐ下にカレンダーを置くときの top */
    belowFirstLineTop: lineBottom + gapBelow,
    /** 下に入らないときは 1 行目の「上」に重ねる基準（セル上端ではない） */
    lineTop,
    lineBottom,
  }
}

export default function ShootingDateCell({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()))
  const [pos, setPos] = useState({ top: 0, left: 0, width: 260 })
  const triggerRef = useRef(null)
  const calendarRef = useRef(null)

  const display = formatDisplayYMD(value ?? '')

  const updatePosition = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const m = getTextAreaFirstLineMetrics(el)
    const width = 260
    const calH = calendarRef.current?.offsetHeight || 280
    const margin = 8
    const gapFlip = 4
    /* 数字の左端。下にはみ出すときは 1 行目の直上に出す（textarea 全体の上に飛ばさない） */
    let left = m.left
    let top = m.belowFirstLineTop
    if (left + width > window.innerWidth - margin) {
      left = Math.max(margin, window.innerWidth - width - margin)
    }
    if (left < margin) left = margin
    if (top + calH > window.innerHeight - margin) {
      top = m.lineTop - calH - gapFlip
    }
    if (top < margin) top = margin
    setPos({ top, left, width })
  }, [])

  const openCalendar = useCallback(() => {
    const parsed = parseYMD(value ?? '')
    if (parsed) {
      setViewMonth(startOfMonth(parsed))
    } else {
      setViewMonth(startOfMonth(new Date()))
    }
    setOpen(true)
  }, [value])

  useLayoutEffect(() => {
    if (!open) return
    triggerRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    updatePosition()
    /* 初回はカレンダー高さが取れないことがあるので 1 フレーム後に再配置 */
    const id = requestAnimationFrame(() => updatePosition())
    return () => cancelAnimationFrame(id)
  }, [open, viewMonth, updatePosition])

  useEffect(() => {
    if (!open) return
    const onScroll = () => updatePosition()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      const t = e.target
      if (triggerRef.current?.contains(t)) return
      if (calendarRef.current?.contains(t)) return
      setOpen(false)
    }
    const id = setTimeout(() => {
      document.addEventListener('mousedown', onDoc)
    }, 0)
    return () => {
      clearTimeout(id)
      document.removeEventListener('mousedown', onDoc)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const selectDate = (d) => {
    onChange(toYMD(d))
    setOpen(false)
  }

  const prevMonth = () => {
    setViewMonth((v) => new Date(v.getFullYear(), v.getMonth() - 1, 1))
  }

  const nextMonth = () => {
    setViewMonth((v) => new Date(v.getFullYear(), v.getMonth() + 1, 1))
  }

  const grid = buildMonthGrid(viewMonth)
  const selected = parseYMD(value ?? '')
  /** 入力済みならその日付、未入力なら本日をカレンダー上でハイライト */
  const highlightDate = selected ?? todayDate()

  const calendarEl =
    open && typeof document !== 'undefined' ? (
      <div
        ref={calendarRef}
        className="shooting-date-calendar"
        role="dialog"
        aria-label="日付を選択"
        style={{
          position: 'fixed',
          top: pos.top,
          left: pos.left,
          width: pos.width,
          zIndex: 10050,
        }}
      >
        <div className="shooting-date-calendar__header">
          <button type="button" className="shooting-date-calendar__nav" onClick={prevMonth} aria-label="前の月">
            ‹
          </button>
          <span className="shooting-date-calendar__title">
            {viewMonth.getFullYear()}年 {viewMonth.getMonth() + 1}月
          </span>
          <button type="button" className="shooting-date-calendar__nav" onClick={nextMonth} aria-label="次の月">
            ›
          </button>
        </div>
        <div className="shooting-date-calendar__weekdays">
          {WEEKDAYS_JA.map((w) => (
            <span key={w} className="shooting-date-calendar__weekday">
              {w}
            </span>
          ))}
        </div>
        <div className="shooting-date-calendar__grid">
          {grid.map((d, i) => {
            if (!d) {
              return <span key={`e-${i}`} className="shooting-date-calendar__day shooting-date-calendar__day--empty" />
            }
            const isHighlighted = isSameDay(d, highlightDate)
            return (
              <button
                key={d.getTime()}
                type="button"
                className={`shooting-date-calendar__day${isHighlighted ? ' shooting-date-calendar__day--selected' : ''}`}
                aria-current={isHighlighted ? 'date' : undefined}
                onMouseDown={(e) => {
                  e.preventDefault()
                  selectDate(d)
                }}
              >
                {d.getDate()}
              </button>
            )
          })}
        </div>
      </div>
    ) : null

  return (
    <div className="shooting-date-cell">
      <textarea
        ref={triggerRef}
        readOnly
        className="cell-textarea shooting-date-cell__field"
        value={display}
        placeholder=""
        onClick={(e) => {
          e.preventDefault()
          openCalendar()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            openCalendar()
          }
        }}
        aria-label="撮影日（クリックでカレンダー）"
        aria-haspopup="dialog"
        aria-expanded={open}
        rows={1}
      />
      {calendarEl ? createPortal(calendarEl, document.body) : null}
    </div>
  )
}
