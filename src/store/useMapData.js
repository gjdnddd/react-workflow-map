import { useCallback, useEffect, useState } from 'react'
import { fetchMapData, saveMapData } from '../data/gistSync'

// Gist가 비었거나 읽기 실패 시 보여줄 초기 상태: HQ 노드 하나만.
// (루트 id는 반드시 'hq' — useMapNavigation/App이 이 id를 루트로 사용)
const SEED_NODES = [
  { id: 'hq', label: 'HQ', parentId: null, description: '', links: [] },
]

let idCounter = 0
function makeId(prefix) {
  idCounter += 1
  return `${prefix}-${Date.now()}-${idCounter}`
}

export function useMapData() {
  const [nodes, setNodes] = useState([])
  const [edges, setEdges] = useState([])
  const [status, setStatus] = useState('loading') // loading | ready | saving | error
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchMapData()
      .then((data) => {
        setNodes(data.nodes?.length ? data.nodes : SEED_NODES)
        setEdges(data.edges?.length ? data.edges : [])
        setStatus('ready')
      })
      .catch((e) => {
        setError(e.message)
        setNodes(SEED_NODES)
        setEdges([])
        setStatus('error')
      })
  }, [])

  const persist = useCallback((nextNodes, nextEdges) => {
    setStatus('saving')
    saveMapData({ nodes: nextNodes, edges: nextEdges })
      .then(() => setStatus('ready'))
      .catch((e) => {
        setError(e.message)
        setStatus('error')
      })
  }, [])

  const addNode = useCallback(
    (parentId, { label, description, links }) => {
      const newNode = {
        id: makeId('node'),
        label,
        parentId,
        description: description || '',
        links: links || [],
      }
      const nextNodes = [...nodes, newNode]
      setNodes(nextNodes)
      persist(nextNodes, edges)
    },
    [nodes, edges, persist],
  )

  const deleteNode = useCallback(
    (nodeId) => {
      const idsToRemove = new Set()
      const collect = (id) => {
        idsToRemove.add(id)
        nodes.filter((n) => n.parentId === id).forEach((child) => collect(child.id))
      }
      collect(nodeId)
      const nextNodes = nodes.filter((n) => !idsToRemove.has(n.id))
      const nextEdges = edges.filter(
        (e) => !idsToRemove.has(e.source) && !idsToRemove.has(e.target),
      )
      setNodes(nextNodes)
      setEdges(nextEdges)
      persist(nextNodes, nextEdges)
    },
    [nodes, edges, persist],
  )

  const addEdge = useCallback(
    (source, target, label, color) => {
      const newEdge = { id: makeId('edge'), source, target, label: label || '', color: color || '#ff6d5a' }
      const nextEdges = [...edges, newEdge]
      setEdges(nextEdges)
      persist(nodes, nextEdges)
    },
    [nodes, edges, persist],
  )

  const updateNode = useCallback(
    (nodeId, { label, description, links }) => {
      const nextNodes = nodes.map((n) =>
        n.id === nodeId ? { ...n, label, description: description || '', links: links || [] } : n,
      )
      setNodes(nextNodes)
      persist(nextNodes, edges)
    },
    [nodes, edges, persist],
  )

  // 드래그로 다른 부모 밑으로 재배치. 연결선(edges)은 노드 id 기준이라 그대로 유지되고,
  // 하위 노드들도 parentId가 이 노드를 가리키므로 통째로 함께 이동한다.
  // 새 부모 밑에서는 좌표가 의미 없어지므로 수동 위치(layout)는 초기화한다.
  const moveNode = useCallback(
    (nodeId, newParentId) => {
      const nextNodes = nodes.map((n) =>
        n.id === nodeId ? { ...n, parentId: newParentId, layout: null } : n,
      )
      setNodes(nextNodes)
      persist(nextNodes, edges)
    },
    [nodes, edges, persist],
  )

  // 형제 위가 아닌 빈 공간에 드래그해서 놓았을 때: 그 자리를 기억(수동 배치)
  const repositionNode = useCallback(
    (nodeId, layout) => {
      const nextNodes = nodes.map((n) => (n.id === nodeId ? { ...n, layout } : n))
      setNodes(nextNodes)
      persist(nextNodes, edges)
    },
    [nodes, edges, persist],
  )

  // 연결 포커스 화면 전용 위치 저장. 일반 계층 화면의 layout과는 별개 필드라
  // 서로 영향을 주지 않는다.
  const repositionNodeInFocus = useCallback(
    (nodeId, focusLayout) => {
      const nextNodes = nodes.map((n) => (n.id === nodeId ? { ...n, focusLayout } : n))
      setNodes(nextNodes)
      persist(nextNodes, edges)
    },
    [nodes, edges, persist],
  )

  const deleteEdge = useCallback(
    (edgeId) => {
      const nextEdges = edges.filter((e) => e.id !== edgeId)
      setEdges(nextEdges)
      persist(nodes, nextEdges)
    },
    [nodes, edges, persist],
  )

  // patch: { label?, color?, labelOffset? } — 넘어온 필드만 갱신
  const updateEdge = useCallback(
    (edgeId, patch) => {
      const nextEdges = edges.map((e) => (e.id === edgeId ? { ...e, ...patch } : e))
      setEdges(nextEdges)
      persist(nodes, nextEdges)
    },
    [nodes, edges, persist],
  )

  return {
    nodes, edges, status, error,
    addNode, deleteNode, updateNode, moveNode, repositionNode, repositionNodeInFocus,
    addEdge, deleteEdge, updateEdge,
  }
}
