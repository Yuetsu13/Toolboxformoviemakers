/** 尺列の文字列を秒（整数）に */
export function parseDurationSeconds(durationStr) {
  const t = String(durationStr ?? '')
    .trim()
    .replace(/,/g, '.')
  if (t === '') return 0
  const n = parseFloat(t)
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0
}

/** 行 0 … rowIndex までの尺の合計秒 */
export function cumulativeSecondsThroughRow(rows, rowIndex) {
  let sum = 0
  for (let i = 0; i <= rowIndex; i++) {
    sum += parseDurationSeconds(rows[i]?.duration)
  }
  return sum
}

/** 秒 → MM:SS または HH:MM:SS */
export function formatElapsedTimeFromSeconds(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

/**
 * 表示用の時間経過。
 * - 自動: 尺列の累積秒（1行目のみ合計0秒のとき 00:00、2行目以降で合計0は空）
 * - 手入力: elapsedTimeManual が true のとき row.elapsedTime
 */
export function getElapsedTimeDisplay(row, rowIndex, rows) {
  if (row.elapsedTimeManual) {
    return row.elapsedTime ?? ''
  }
  const cum = cumulativeSecondsThroughRow(rows, rowIndex)
  if (rowIndex === 0) {
    if (cum === 0) return '00:00'
    return formatElapsedTimeFromSeconds(cum)
  }
  if (cum === 0) return ''
  return formatElapsedTimeFromSeconds(cum)
}
