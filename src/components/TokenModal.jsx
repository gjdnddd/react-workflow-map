import { useState } from 'react'
import { getToken, setToken } from '../data/gistSync'

export default function TokenModal({ onClose }) {
  const [value, setValue] = useState(getToken())

  function handleSave(e) {
    e.preventDefault()
    setToken(value.trim())
    onClose()
  }

  return (
    <form className="editor-overlay" onSubmit={handleSave}>
      <div className="editor-box">
        <h3>GitHub 토큰 설정</h3>
        <p>Gist 쓰기 권한(gist scope)이 있는 Personal Access Token을 입력하세요. 브라우저에만 저장됩니다.</p>
        <label>
          토큰
          <input
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
        </label>
        <div className="editor-actions">
          <button type="button" onClick={onClose}>취소</button>
          <button type="submit">저장</button>
        </div>
      </div>
    </form>
  )
}
