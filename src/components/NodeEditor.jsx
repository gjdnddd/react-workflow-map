import { useState } from 'react'

export default function NodeEditor({ onSubmit, onCancel }) {
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [linkLabel, setLinkLabel] = useState('')
  const [linkUrl, setLinkUrl] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    if (!label.trim()) return
    const links = linkUrl.trim() ? [{ label: linkLabel.trim() || linkUrl.trim(), url: linkUrl.trim() }] : []
    onSubmit({ label: label.trim(), description: description.trim(), links })
  }

  return (
    <form className="editor-overlay" onSubmit={handleSubmit}>
      <div className="editor-box">
        <h3>노드 추가</h3>
        <label>
          이름
          <input value={label} onChange={(e) => setLabel(e.target.value)} autoFocus />
        </label>
        <label>
          설명
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label>
          링크 이름
          <input value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} />
        </label>
        <label>
          링크 URL
          <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
        </label>
        <div className="editor-actions">
          <button type="button" onClick={onCancel}>취소</button>
          <button type="submit">추가</button>
        </div>
      </div>
    </form>
  )
}
