const GIST_ID = 'a90d93d48694b58bc7ddf190dc636730'
const FILE_NAME = 'map-data.json'
const TOKEN_KEY = 'rwm_gh_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || ''
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export async function fetchMapData() {
  const res = await fetch(`https://api.github.com/gists/${GIST_ID}`)
  if (!res.ok) throw new Error(`Gist 읽기 실패 (${res.status})`)
  const gist = await res.json()
  const file = gist.files[FILE_NAME]
  if (!file) throw new Error(`Gist에 ${FILE_NAME} 파일이 없습니다`)
  return JSON.parse(file.content)
}

export async function saveMapData(data) {
  const token = getToken()
  if (!token) throw new Error('저장하려면 GitHub 토큰이 필요합니다')

  const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
    method: 'PATCH',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github+json',
    },
    body: JSON.stringify({
      files: {
        [FILE_NAME]: { content: JSON.stringify(data, null, 2) },
      },
    }),
  })
  if (!res.ok) throw new Error(`Gist 저장 실패 (${res.status})`)
  return res.json()
}
