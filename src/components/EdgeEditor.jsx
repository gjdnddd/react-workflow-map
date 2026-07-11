import { useState } from 'react'

export default function EdgeEditor({ sourceLabel, targetLabel, initialLabel = '', onSubmit, onDelete, onCancel }) {
  const [label, setLabel] = useState(initialLabel)
  const isEdit = onDelete != null

  function handleSubmit(e) {
    e.preventDefault()
    onSubmit(label.trim())
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
