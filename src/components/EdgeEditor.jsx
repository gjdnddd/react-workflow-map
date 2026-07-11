import { useState } from 'react'

export default function EdgeEditor({ sourceLabel, targetLabel, onSubmit, onCancel }) {
  const [label, setLabel] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    onSubmit(label.trim())
  }

  return (
    <form className="editor-overlay" onSubmit={handleSubmit}>
      <div className="editor-box">
        <h3>연결선 추가</h3>
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
          <button type="button" onClick={onCancel}>취소</button>
          <button type="submit">연결</button>
        </div>
      </div>
    </form>
  )
}
