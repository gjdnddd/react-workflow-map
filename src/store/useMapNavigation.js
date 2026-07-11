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

  return { path, currentNode, children, goInto, goBack, goToRoot }
}
