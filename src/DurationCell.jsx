const STEP = 1

function parseNum(raw) {
  const t = String(raw ?? '')
    .trim()
    .replace(/,/g, '.')
  if (t === '') return null
  const n = parseFloat(t)
  return Number.isFinite(n) ? n : null
}

/** 常に整数（0 以上）。小数点は出さない */
function formatNum(n) {
  if (!Number.isFinite(n)) return ''
  const r = Math.max(0, Math.round(n))
  return String(r)
}

/** App.jsx でホバー用クラス付与に使用 */
export function hasDurationNumericValue(value) {
  return parseNum(value) !== null
}

export default function DurationCell({ value, onChange }) {
  const str = value ?? ''

  const applyDelta = (delta) => {
    const cur = parseNum(str)
    if (cur === null) return
    const next = Math.max(0, cur + delta)
    onChange(formatNum(next))
  }

  const handleBlur = () => {
    const n = parseNum(str)
    if (n === null) return
    const normalized = formatNum(n)
    if (normalized !== str) onChange(normalized)
  }

  return (
    <>
      <textarea
        inputMode="numeric"
        className="cell-textarea cell-textarea--duration"
        value={str}
        rows={1}
        spellCheck={false}
        onChange={(e) => {
          const v = e.target.value.replace(/\r?\n/g, '')
          onChange(v)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.preventDefault()
        }}
        onBlur={handleBlur}
        aria-label="尺（秒）"
      />
      <button
        type="button"
        tabIndex={-1}
        className="duration-arrow duration-arrow--left"
        aria-label="尺を減らす"
        onClick={() => applyDelta(-STEP)}
      >
        ◀
      </button>
      <button
        type="button"
        tabIndex={-1}
        className="duration-arrow duration-arrow--right"
        aria-label="尺を増やす"
        onClick={() => applyDelta(STEP)}
      >
        ▶
      </button>
    </>
  )
}
