import { useMemo, useState } from 'react'

// 현재 포커스 노드, 방문 경로(뒤로가기용)를 관리하는 훅
export function useMapNavigation(nodes, rootId = 'hq') {
  const [path, setPath] = useState([rootId])

  const currentId = path[path.length - 1]
  const currentNode = nodes.find((n) => n.id === currentId)
  const children = useMemo(
    () => nodes.filter((n) => n.parentId === currentId),
    [nodes, currentId],
  )

  function goInto(nodeId) {
    setPath((p) => [...p, nodeId])
  }

  function goBack() {
    setPath((p) => (p.length > 1 ? p.slice(0, -1) : p))
  }

  function goToRoot() {
    setPath([rootId])
  }

  // 임의의 노드로 바로 이동 — parentId를 따라 루트까지 조상 체인을 만들어 경로로 설정.
  // 연결 포커스 모드에서 "이 노드의 실제 위치로 이동" 기능에 사용.
  function goToNode(nodeId) {
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]))
    const chain = []
    let cur = byId[nodeId]
    const guard = new Set() // 혹시 모를 순환 방지
    while (cur && !guard.has(cur.id)) {
      guard.add(cur.id)
      chain.unshift(cur.id)
      cur = cur.parentId ? byId[cur.parentId] : null
    }
    if (chain.length === 0) return
    // 체인이 루트에서 시작하지 않으면(데이터 이상) 루트를 앞에 붙여 최소한 접근 가능하게
    setPath(chain[0] === rootId ? chain : [rootId, ...chain])
  }

  return { path, currentNode, children, goInto, goBack, goToRoot, goToNode }
}
