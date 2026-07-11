import { useEffect, useMemo, useRef, useState } from 'react'
import { ReactFlow, ReactFlowProvider, Background, Controls, useReactFlow } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import MapErrorBoundary from './MapErrorBoundary'

const RADIUS = 220
const NODE_WIDTH = 150
const NODE_HEIGHT = 48
const PADDING = 80

function buildRadialLayout(centerNode, children, connectSelection) {
  const centerFlowNode = {
    id: centerNode.id,
    position: { x: 0, y: 0 },
    data: { label: centerNode.label },
    className: 'node-center',
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
  }

  const childFlowNodes = children.map((child, i) => {
    const angle = (2 * Math.PI * i) / children.length - Math.PI / 2
    const selected = connectSelection?.includes(child.id)
    return {
      id: child.id,
      position: { x: RADIUS * Math.cos(angle), y: RADIUS * Math.sin(angle) },
      data: { label: child.label },
      className: selected ? 'node-child node-selected' : 'node-child',
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    }
  })

  return [centerFlowNode, ...childFlowNodes]
}

function computeCenteredViewport(nodes, containerWidth, containerHeight) {
  const xs = nodes.flatMap((n) => [n.position.x, n.position.x + NODE_WIDTH])
  const ys = nodes.flatMap((n) => [n.position.y, n.position.y + NODE_HEIGHT])
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const boundsWidth = maxX - minX || 1
  const boundsHeight = maxY - minY || 1

  const zoom = Math.min(
    (containerWidth - PADDING * 2) / boundsWidth,
    (containerHeight - PADDING * 2) / boundsHeight,
    1.2,
  )
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2

  return {
    x: containerWidth / 2 - centerX * zoom,
    y: containerHeight / 2 - centerY * zoom,
    zoom,
  }
}

// React Flow의 내장 엣지 렌더링은 ResizeObserver 기반 노드 측정에 의존하는데,
// 일부 임베드/자동화 환경에서 측정이 발화하지 않아 엣지가 그려지지 않는 경우가 있다.
// 노드 위치를 이미 직접 계산해 알고 있으므로, 연결선은 별도 SVG 오버레이로 직접 그린다.
function EdgeOverlay({ nodes, centerId, siblingEdges, viewport }) {
  const byId = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes])

  function centerOf(node) {
    return { x: node.position.x + NODE_WIDTH / 2, y: node.position.y + NODE_HEIGHT / 2 }
  }

  const parentLines = nodes
    .filter((n) => n.id !== centerId)
    .map((n) => {
      const c = centerOf(byId[centerId])
      const t = centerOf(n)
      return { id: `parent-${n.id}`, x1: c.x, y1: c.y, x2: t.x, y2: t.y, label: null, custom: false }
    })

  const customLines = siblingEdges
    .filter((e) => byId[e.source] && byId[e.target])
    .map((e) => {
      const s = centerOf(byId[e.source])
      const t = centerOf(byId[e.target])
      return { id: e.id, x1: s.x, y1: s.y, x2: t.x, y2: t.y, label: e.label, custom: true }
    })

  return (
    <svg className="edge-overlay" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
      <defs>
        <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#c084fc" />
        </marker>
      </defs>
      <g transform={`translate(${viewport.x}, ${viewport.y}) scale(${viewport.zoom})`}>
        {parentLines.map((l) => (
          <line key={l.id} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="#555" strokeWidth={2} />
        ))}
        {customLines.map((l) => (
          <g key={l.id}>
            <line x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="#c084fc" strokeWidth={2} markerEnd="url(#arrow)" />
            {l.label && (
              <text
                x={(l.x1 + l.x2) / 2}
                y={(l.y1 + l.y2) / 2 - 6}
                fill="#c084fc"
                fontSize={13}
                fontWeight={600}
                textAnchor="middle"
              >
                {l.label}
              </text>
            )}
          </g>
        ))}
      </g>
    </svg>
  )
}

function MapViewInner({ centerNode, children, siblingEdges, connectSelection, onNodeAction }) {
  const nodes = useMemo(
    () => buildRadialLayout(centerNode, children, connectSelection),
    [centerNode, children, connectSelection],
  )
  const { setViewport: setReactFlowViewport } = useReactFlow()
  const wrapperRef = useRef(null)
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 })

  useEffect(() => {
    if (!wrapperRef.current) return
    const rect = wrapperRef.current.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    const nextViewport = computeCenteredViewport(nodes, rect.width, rect.height)
    setReactFlowViewport(nextViewport, { duration: 0 })
    setViewport(nextViewport)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerNode.id, children.length, setReactFlowViewport])

  return (
    <div ref={wrapperRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={[]}
        onNodeClick={(_, node) => {
          if (node.id !== centerNode.id) onNodeAction(node.id)
        }}
        onMove={(_, vp) => setViewport(vp)}
        nodesDraggable={false}
        nodesConnectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
      <EdgeOverlay nodes={nodes} centerId={centerNode.id} siblingEdges={siblingEdges} viewport={viewport} />
    </div>
  )
}

export default function MapView(props) {
  return (
    <MapErrorBoundary>
      <ReactFlowProvider>
        <MapViewInner {...props} />
      </ReactFlowProvider>
    </MapErrorBoundary>
  )
}
