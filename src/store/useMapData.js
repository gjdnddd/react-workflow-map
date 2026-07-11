import { useCallback, useEffect, useState } from 'react'
import { fetchMapData, saveMapData } from '../data/gistSync'
import { mockNodes, mockEdges } from '../data/mockData'

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
        const loadedNodes = data.nodes?.length ? data.nodes : mockNodes
        const loadedEdges = data.edges?.length ? data.edges : (data.nodes?.length ? [] : mockEdges)
        setNodes(loadedNodes)
        setEdges(loadedEdges)
        setStatus('ready')
      })
      .catch((e) => {
        setError(e.message)
        setNodes(mockNodes)
        setEdges(mockEdges)
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

  return { nodes, edges, status, error, addNode, deleteNode, addEdge, deleteEdge }
}
