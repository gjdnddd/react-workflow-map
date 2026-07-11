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
      setNodes((prev) => {
        const next = [...prev, newNode]
        persist(next, edges)
        return next
      })
    },
    [edges, persist],
  )

  const deleteNode = useCallback(
    (nodeId) => {
      setNodes((prev) => {
        const idsToRemove = new Set()
        const collect = (id) => {
          idsToRemove.add(id)
          prev.filter((n) => n.parentId === id).forEach((child) => collect(child.id))
        }
        collect(nodeId)
        const next = prev.filter((n) => !idsToRemove.has(n.id))
        setEdges((prevEdges) => {
          const nextEdges = prevEdges.filter(
            (e) => !idsToRemove.has(e.source) && !idsToRemove.has(e.target),
          )
          persist(next, nextEdges)
          return nextEdges
        })
        return next
      })
    },
    [persist],
  )

  const addEdge = useCallback(
    (source, target, label) => {
      const newEdge = { id: makeId('edge'), source, target, label: label || '' }
      setEdges((prev) => {
        const next = [...prev, newEdge]
        persist(nodes, next)
        return next
      })
    },
    [nodes, persist],
  )

  const deleteEdge = useCallback(
    (edgeId) => {
      setEdges((prev) => {
        const next = prev.filter((e) => e.id !== edgeId)
        persist(nodes, next)
        return next
      })
    },
    [nodes, persist],
  )

  return { nodes, edges, status, error, addNode, deleteNode, addEdge, deleteEdge }
}
