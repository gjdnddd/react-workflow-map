import { useEffect, useMemo, useRef, useState } from 'react'
import { ReactFlow, ReactFlowProvider, Background, Controls, useReactFlow } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import MapErrorBoundary from './MapErrorBoundary'

const RADIUS = 240
const NODE_WIDTH = 170
const NODE_HEIGHT = 56
const PADDING = 80

function MapNode({ data }) {
  const initial = data.label?.trim()?.[0] || '?'
  return (
    <div className={`n8n-node${data.isCenter ? ' n8n-node-center' : ''}`}>
      <span className="n8n-node-icon">{initial}</span>
      <span className="n8n-node-label">{data.label}</span>
    </div>
  )
}

const nodeTypes = { mapNode: MapNode }

function buildRadialLayout(centerNode, children, connectSelection) {
  const centerFlowNode = {
    id: centerNode.id,
    type: 'mapNode',
    position: { x: 0, y: 0 },
    data: { label: centerNode.label, isCenter: true },
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
  }

  const childFlowNodes = children.map((child, i) => {
    const angle = (2 * Math.PI * i) / children.length - Math.PI / 2
    const selected = connectSelection?.includes(child.id)
    return {
      id: child.id,
      type: 'mapNode',
      position: { x: RADIUS * Math.cos(angle), y: RADIUS * Math.sin(angle) },
      data: { label: child.label, isCenter: false },
      className: selected ? 'node-selected' : '',
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
function curvedPath(x1, y1, x2, y2) {
  // 두 점을 잇는 완만한 곡선(2차 베지어). 수직 방향으로 살짝 휘어지게 해 n8n 특유의
  // 부드러운 커넥션 라인 느낌을 낸다.
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy) || 1
  const curveAmount = Math.min(len * 0.18, 40)
  const nx = (-dy / len) * curveAmount
  const ny = (dx / len) * curveAmount
  const cx = mx + nx
  const cy = my + ny
  return { d: `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`, labelX: cx, labelY: cy }
}

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
      return { id: `parent-${n.id}`, ...curvedPath(c.x, c.y, t.x, t.y) }
    })

  const customLines = siblingEdges
    .filter((e) => byId[e.source] && byId[e.target])
    .map((e) => {
      const s = centerOf(byId[e.source])
      const t = centerOf(byId[e.target])
      return { id: e.id, label: e.label, ...curvedPath(s.x, s.y, t.x, t.y) }
    })

  return (
    <svg className="edge-overlay" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
      <defs>
        <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#ff6d5a" />
        </marker>
      </defs>
      <g transform={`translate(${viewport.x}, ${viewport.y}) scale(${viewport.zoom})`}>
        {parentLines.map((l) => (
          <path key={l.id} d={l.d} fill="none" stroke="#d7d9e3" strokeWidth={2} />
        ))}
        {customLines.map((l) => (
          <g key={l.id}>
            <path d={l.d} fill="none" stroke="#ff6d5a" strokeWidth={2} markerEnd="url(#arrow)" />
            {l.label && (
              <g>
                <rect
                  x={l.labelX - (l.label.length * 3.6 + 10)}
                  y={l.labelY - 11}
                  width={l.label.length * 7.2 + 20}
                  height={22}
                  rx={11}
                  fill="#ffe6e0"
                  stroke="#ff6d5a"
                  strokeWidth={1}
                />
                <text
                  x={l.labelX}
                  y={l.labelY + 4}
                  fill="#c9432f"
                  fontSize={12}
                  fontWeight={600}
                  textAnchor="middle"
                >
                  {l.label}
                </text>
              </g>
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

  // 노드가 바뀌거나 컨테이너 크기가 변할 때(모바일 회전/주소창 변화 등) 중앙 정렬 재계산
  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return

    const recenter = () => {
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      const nextViewport = computeCenteredViewport(nodes, rect.width, rect.height)
      setReactFlowViewport(nextViewport, { duration: 0 })
      setViewport(nextViewport)
    }

    recenter()

    const observer = new ResizeObserver(recenter)
    observer.observe(el)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerNode.id, children.length, setReactFlowViewport])

  return (
    <div ref={wrapperRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={[]}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => {
          if (node.id !== centerNode.id) onNodeAction(node.id)
        }}
        onMove={(_, vp) => setViewport(vp)}
        nodesDraggable={false}
        nodesConnectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant="dots" gap={20} size={1.5} color="#d7d9e3" bgColor="#f6f6f9" />
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
