import { useState } from 'react'

const COLOR_PRESETS = [
  { name: '코랄', value: '#ff6d5a' },
  { name: '블루', value: '#3b82f6' },
  { name: '그린', value: '#22c55e' },
  { name: '퍼플', value: '#a855f7' },
  { name: '그레이', value: '#6b7280' },
]

export default function EdgeEditor({ sourceLabel, targetLabel, initialLabel = '', initialColor, onSubmit, onDelete, onCancel }) {
  const [label, setLabel] = useState(initialLabel)
  const [color, setColor] = useState(initialColor || COLOR_PRESETS[0].value)
  const isEdit = onDelete != null

  function handleSubmit(e) {
    e.preventDefault()
    onSubmit(label.trim(), color)
  }

  return (
    <form className="editor-overlay" onSubmit={handleSubmit}>
      <div className="editor-box">
        <h3>{isEdit ? '연결선 수정' : '연결선 추가'}</h3>
        <p>{sourceLabel} → {targetLabel}</p>
        <label>
          관계 라벨
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="예: 데이터 제공, 의존"
            autoFocus
          />
        </label>
        <label>
          색상
          <div className="color-swatch-row">
            {COLOR_PRESETS.map((c) => (
              <button
                key={c.value}
                type="button"
                title={c.name}
                className={`color-swatch${color === c.value ? ' selected' : ''}`}
                style={{ background: c.value }}
                onClick={() => setColor(c.value)}
              />
            ))}
          </div>
        </label>
        <div className="editor-actions">
          {isEdit && (
            <button type="button" className="danger" onClick={onDelete}>삭제</button>
          )}
          <button type="button" onClick={onCancel}>취소</button>
          <button type="submit">{isEdit ? '저장' : '연결'}</button>
        </div>
      </div>
    </form>
  )
}
