import { useState } from 'react'

export default function NodeEditor({ initialValues, onSubmit, onDelete, onCancel }) {
  const isEdit = onDelete != null
  const [label, setLabel] = useState(initialValues?.label || '')
  const [description, setDescription] = useState(initialValues?.description || '')
  const firstLink = initialValues?.links?.[0]
  const [linkLabel, setLinkLabel] = useState(firstLink?.label || '')
  const [linkUrl, setLinkUrl] = useState(firstLink?.url || '')

  function handleSubmit(e) {
    e.preventDefault()
    if (!label.trim()) return
    const links = linkUrl.trim() ? [{ label: linkLabel.trim() || linkUrl.trim(), url: linkUrl.trim() }] : []
    onSubmit({ label: label.trim(), description: description.trim(), links })
  }

  return (
    <form className="editor-overlay" onSubmit={handleSubmit}>
      <div className="editor-box">
        <h3>{isEdit ? '노드 수정' : '노드 추가'}</h3>
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
          {isEdit && (
            <button type="button" className="danger" onClick={onDelete}>삭제</button>
          )}
          <button type="button" onClick={onCancel}>취소</button>
          <button type="submit">{isEdit ? '저장' : '추가'}</button>
        </div>
      </div>
    </form>
  )
}
