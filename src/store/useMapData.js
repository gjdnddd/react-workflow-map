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
    (source, target, label) => {
      const newEdge = { id: makeId('edge'), source, target, label: label || '' }
      const nextEdges = [...edges, newEdge]
      setEdges(nextEdges)
      persist(nodes, nextEdges)
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

  const updateEdge = useCallback(
    (edgeId, label) => {
      const nextEdges = edges.map((e) => (e.id === edgeId ? { ...e, label } : e))
      setEdges(nextEdges)
      persist(nodes, nextEdges)
    },
    [nodes, edges, persist],
  )

  return { nodes, edges, status, error, addNode, deleteNode, addEdge, deleteEdge, updateEdge }
}
