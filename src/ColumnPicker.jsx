import { useCallback, useMemo, useRef } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ALL_COLUMNS } from './columnConfig.js'

function SortableColumnRow({ col, index, onRemove }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: col.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`column-picker-selected-row ${isDragging ? 'column-picker-selected-row--dragging' : ''}`}
    >
      <span
        className="column-picker-drag-handle"
        {...attributes}
        {...listeners}
        title="ドラッグして並び替え"
        aria-label="ドラッグして並び替え"
      >
        ⋮⋮
      </span>
      <span className="column-picker-order">{index + 1}.</span>
      <span className="column-picker-label">{col.label}</span>
      <button
        type="button"
        className="column-picker-remove"
        onClick={() => onRemove(col.id)}
        aria-label={`${col.label} を削除`}
      >
        ×
      </button>
    </li>
  )
}

export default function ColumnPicker({
  selectedColumnIds,
  onAddColumn,
  onRemoveColumn,
  onReorderSelectedColumns,
  onImportExcel,
  onConfirm,
}) {
  const available = ALL_COLUMNS.filter((c) => !selectedColumnIds.includes(c.id))
  const selected = selectedColumnIds
    .map((id) => ALL_COLUMNS.find((c) => c.id === id))
    .filter(Boolean)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = useCallback(
    (event) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      const oldIndex = selectedColumnIds.indexOf(active.id)
      const newIndex = selectedColumnIds.indexOf(over.id)
      if (oldIndex === -1 || newIndex === -1) return
      onReorderSelectedColumns(arrayMove(selectedColumnIds, oldIndex, newIndex))
    },
    [selectedColumnIds, onReorderSelectedColumns]
  )

  const sortableIds = useMemo(() => selectedColumnIds, [selectedColumnIds])

  const fileInputRef = useRef(null)
  const handleFileChange = useCallback(
    (e) => {
      const file = e.target.files?.[0]
      if (file) onImportExcel?.(file)
      // 同じファイルをもう一度選んでも発火するように初期化
      e.target.value = ''
    },
    [onImportExcel]
  )

  return (
    <div className="column-picker">
      <div className="column-picker-intro">
        <h2>列の選択</h2>
        <p className="column-picker-hint">
          左の一覧から列をクリックして追加します。右の順番が表の左から右の並びになります。
        </p>
      </div>

      <div className="column-picker-panels">
        <div className="column-picker-panel column-picker-panel--available">
          <h3>利用可能な列</h3>
          <ul className="column-picker-list column-picker-list--available">
            {available.length === 0 ? (
              <li className="column-picker-empty">すべて選択済みです</li>
            ) : (
              available.map((col) => (
                <li key={col.id}>
                  <button
                    type="button"
                    className="column-picker-item"
                    onClick={() => onAddColumn(col.id)}
                  >
                    {col.label}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="column-picker-panel column-picker-panel--selected">
          <h3>選択中の列（上から左→右）</h3>
          {selected.length >= 2 && (
            <p className="column-picker-reorder-hint">⋮⋮ をドラッグして順番を変更できます</p>
          )}
          {selected.length === 0 ? (
            <ul className="column-picker-list column-picker-list--selected">
              <li className="column-picker-empty">列を追加してください</li>
            </ul>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                <ul className="column-picker-list column-picker-list--selected">
                  {selected.map((col, i) => (
                    <SortableColumnRow
                      key={col.id}
                      col={col}
                      index={i}
                      onRemove={onRemoveColumn}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>

      <div className="column-picker-actions">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <button
          type="button"
          className="btn btn-add"
          disabled={selectedColumnIds.length === 0}
          onClick={onConfirm}
        >
          絵コンテを編集
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => fileInputRef.current?.click()}
        >
          保存されたExcelで継続
        </button>
      </div>
    </div>
  )
}
