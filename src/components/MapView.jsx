import { useEffect, useMemo, useRef, useState } from 'react'
import { ReactFlow, ReactFlowProvider, Background, Controls, useReactFlow } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import MapErrorBoundary from './MapErrorBoundary'

const BASE_RADIUS = 240
const NODE_WIDTH = 170
const NODE_HEIGHT = 56
const NODE_GAP = 30
const PADDING = 80

function MapNode({ data }) {
  const initial = data.label?.trim()?.[0] || '?'
  return (
    <div className={`n8n-node${data.isCenter ? ' n8n-node-center' : ''}${data.isDragging ? ' n8n-node-dragging' : ''}`}>
      <span className="n8n-node-icon">{initial}</span>
      <span className="n8n-node-label">{data.label}</span>
      {data.connectionCount > 0 && (
        <button
          type="button"
          className="n8n-node-badge"
          title="연결된 노드 보기"
          onClick={(e) => {
            e.stopPropagation()
            data.onBadgeClick?.(data.id)
          }}
        >
          🔗{data.connectionCount}
        </button>
      )}
    </div>
  )
}

const nodeTypes = { mapNode: MapNode }

// 자식 노드가 많으면 원의 둘레가 부족해 카드끼리 겹친다. 자식 수에 맞춰
// 반지름을 늘려서(둘레 ≈ 카드 폭 합) 기본 배치에서부터 안 겹치게 한다.
function radiusFor(count) {
  if (count <= 1) return BASE_RADIUS
  const circumference = count * (NODE_WIDTH + NODE_GAP)
  return Math.max(BASE_RADIUS, circumference / (2 * Math.PI))
}

function buildRadialLayout(centerNode, children, connectSelection, countOf, onBadgeClick, dragEnabled, dropTargetId, draggingId, layoutField = 'layout') {
  const centerFlowNode = {
    id: centerNode.id,
    type: 'mapNode',
    position: { x: 0, y: 0 },
    data: {
      id: centerNode.id,
      label: centerNode.label,
      isCenter: true,
      connectionCount: countOf(centerNode.id),
      onBadgeClick,
    },
    draggable: false,
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
  }

  const radius = radiusFor(children.length)

  const childFlowNodes = children.map((child, i) => {
    const angle = (2 * Math.PI * i) / children.length - Math.PI / 2
    const defaultPos = { x: radius * Math.cos(angle), y: radius * Math.sin(angle) }
    const savedLayout = child[layoutField]
    const position = savedLayout ? { x: savedLayout.x, y: savedLayout.y } : defaultPos
    const selected = connectSelection?.includes(child.id)
    const classNames = [
      selected ? 'node-selected' : '',
      child.id === dropTargetId ? 'node-drop-target' : '',
    ].filter(Boolean).join(' ')
    return {
      id: child.id,
      type: 'mapNode',
      position,
      data: {
        id: child.id,
        label: child.label,
        isCenter: false,
        isDragging: child.id === draggingId,
        connectionCount: countOf(child.id),
        onBadgeClick,
      },
      className: classNames,
      draggable: dragEnabled,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    }
  })

  return [centerFlowNode, ...childFlowNodes]
}

// 드래그 중인 노드와 다른 형제 노드가 겹치는지 확인 (드롭 대상 판정용)
function findOverlapTarget(draggedId, draggedPos, siblings) {
  for (const n of siblings) {
    if (n.id === draggedId) continue
    const dx = Math.abs(n.position.x - draggedPos.x)
    const dy = Math.abs(n.position.y - draggedPos.y)
    if (dx < NODE_WIDTH * 0.6 && dy < NODE_HEIGHT * 0.6) return n.id
  }
  return null
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

// 중심점끼리 잇지 않고, 상대 노드 방향으로 카드 경계선까지만 선을 당겨서
// 연결선이 카드 위로 겹쳐 그려지지 않도록 한다.
function trimToRect(cx, cy, towardX, towardY, halfW, halfH) {
  const dx = towardX - cx
  const dy = towardY - cy
  if (dx === 0 && dy === 0) return { x: cx, y: cy }
  const scale = Math.min(
    dx !== 0 ? halfW / Math.abs(dx) : Infinity,
    dy !== 0 ? halfH / Math.abs(dy) : Infinity,
  )
  return { x: cx + dx * scale, y: cy + dy * scale }
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
  return { d: `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`, midX: cx, midY: cy }
}

const DEFAULT_EDGE_COLOR = '#ff6d5a'

// centerEdgeMap: 포커스 모드에서 { childId: { id, label, color, labelOffset } } — 중심에서
// 각 자식으로 그리는 실제 연결선. 값이 있으면 컬러+라벨+클릭(수정) 가능, 없으면 계층용 회색 선.
function EdgeOverlay({ nodes, centerId, siblingEdges, centerEdgeMap, viewport, dragOverridePos, onEdgeAction, onEdgeLabelMove }) {
  const byId = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes])
  const [draggingLabel, setDraggingLabel] = useState(null) // { edgeId, startX, startY, baseOffset, liveOffset }

  useEffect(() => {
    if (!draggingLabel) return
    function onMove(e) {
      const dx = (e.clientX - draggingLabel.startX) / viewport.zoom
      const dy = (e.clientY - draggingLabel.startY) / viewport.zoom
      setDraggingLabel((prev) => prev && ({
        ...prev,
        liveOffset: { dx: prev.baseOffset.dx + dx, dy: prev.baseOffset.dy + dy },
      }))
    }
    function onUp() {
      setDraggingLabel((prev) => {
        if (prev) onEdgeLabelMove?.(prev.edgeId, prev.liveOffset)
        return null
      })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggingLabel?.edgeId, viewport.zoom])

  function positionOf(node) {
    if (dragOverridePos && dragOverridePos.id === node.id) return dragOverridePos
    return node.position
  }

  function centerOf(node) {
    const pos = positionOf(node)
    return { x: pos.x + NODE_WIDTH / 2, y: pos.y + NODE_HEIGHT / 2 }
  }

  // 라벨(pill)이 어떤 노드 카드 위에 겹치면, 그 노드를 드래그하려던 클릭을 라벨이
  // 가로채 버린다(연결선만 움직이고 노드는 안 움직이는 문제). 겹칠 땐 라벨의
  // 클릭/드래그를 비활성화해서 클릭이 아래 노드로 그대로 전달되게 한다.
  function overlapsAnyNode(x, y, w, h) {
    return nodes.some((n) => {
      const p = positionOf(n)
      return x < p.x + NODE_WIDTH && x + w > p.x && y < p.y + NODE_HEIGHT && y + h > p.y
    })
  }

  function trimmedPath(fromNode, toNode) {
    const c1 = centerOf(fromNode)
    const c2 = centerOf(toNode)
    const p1 = trimToRect(c1.x, c1.y, c2.x, c2.y, NODE_WIDTH / 2, NODE_HEIGHT / 2)
    const p2 = trimToRect(c2.x, c2.y, c1.x, c1.y, NODE_WIDTH / 2, NODE_HEIGHT / 2)
    return curvedPath(p1.x, p1.y, p2.x, p2.y)
  }

  // 중심 → 각 노드. 포커스 모드면 연결선(라벨/클릭), 아니면 계층용 회색 선.
  const centerLines = nodes
    .filter((n) => n.id !== centerId)
    .map((n) => {
      const edge = centerEdgeMap?.[n.id]
      return {
        id: `c-${n.id}`,
        edgeId: edge?.id,
        label: edge?.label,
        color: edge?.color,
        labelOffset: edge?.labelOffset,
        ...trimmedPath(byId[centerId], n),
      }
    })

  // 형제↔형제 연결선(일반 모드에서만 채워짐)
  const siblingLines = siblingEdges
    .filter((e) => byId[e.source] && byId[e.target])
    .map((e) => ({
      id: e.id,
      label: e.label,
      color: e.color,
      labelOffset: e.labelOffset,
      ...trimmedPath(byId[e.source], byId[e.target]),
    }))

  const labeledLines = [
    ...centerLines.filter((l) => l.edgeId),
    ...siblingLines,
  ]

  return (
    <svg className="edge-overlay" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
      <defs>
        {['#ff6d5a', '#3b82f6', '#22c55e', '#a855f7', '#6b7280'].map((c) => (
          <marker key={c} id={`arrow-${c.slice(1)}`} markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill={c} />
          </marker>
        ))}
      </defs>
      <g transform={`translate(${viewport.x}, ${viewport.y}) scale(${viewport.zoom})`}>
        {/* 계층용 회색 선 (포커스 모드가 아닌 중심→자식) */}
        {centerLines
          .filter((l) => !l.edgeId)
          .map((l) => (
            <path key={l.id} d={l.d} fill="none" stroke="#d7d9e3" strokeWidth={2} />
          ))}

        {/* 라벨 있는 연결선 (색상 지정 가능, 클릭 시 수정) */}
        {labeledLines.map((l) => {
          const color = l.color || DEFAULT_EDGE_COLOR
          const isDraggingThis = !!draggingLabel && draggingLabel.edgeId === (l.edgeId || l.id)
          const offset = isDraggingThis ? draggingLabel.liveOffset : (l.labelOffset || { dx: 0, dy: 0 })
          const labelX = l.midX + offset.dx
          const labelY = l.midY + offset.dy
          // 선의 중간 지점이 노드 카드와 겹치면(조밀한 배치에서 흔함) 그 투명 히트 영역이
          // 노드 클릭/드래그를 가로챌 수 있으니, 겹칠 땐 히트 영역을 비활성화한다.
          const lineHitBlocked = overlapsAnyNode(l.midX - 8, l.midY - 8, 16, 16)
          return (
            <g key={l.id}>
              {/* 실제 보이는 선보다 넓은 투명 히트 영역 — 클릭하기 쉽게 */}
              <path
                d={l.d}
                fill="none"
                stroke="transparent"
                strokeWidth={16}
                style={{ pointerEvents: lineHitBlocked ? 'none' : 'stroke', cursor: 'pointer' }}
                onClick={() => onEdgeAction?.(l.edgeId || l.id)}
              />
              <path d={l.d} fill="none" stroke={color} strokeWidth={2} markerEnd={`url(#arrow-${color.slice(1)})`} />
              {/* 라벨과 선 중점을 잇는 가는 안내선 (라벨을 옮겼을 때만) */}
              {(offset.dx !== 0 || offset.dy !== 0) && (
                <line x1={l.midX} y1={l.midY} x2={labelX} y2={labelY} stroke={color} strokeWidth={1} strokeDasharray="3,3" opacity={0.5} />
              )}
              {l.label && (() => {
                const pillX = labelX - (l.label.length * 3.6 + 10)
                const pillY = labelY - 11
                const pillW = l.label.length * 7.2 + 20
                const pillH = 22
                // 드래그 중인 라벨 자신은 항상 조작 가능해야 하니 겹침 검사에서 제외
                const blocked = !isDraggingThis && overlapsAnyNode(pillX, pillY, pillW, pillH)
                return (
                  <g
                    style={{ pointerEvents: blocked ? 'none' : 'auto', cursor: isDraggingThis ? 'grabbing' : 'grab' }}
                    onPointerDown={(e) => {
                      e.stopPropagation()
                      setDraggingLabel({
                        edgeId: l.edgeId || l.id,
                        startX: e.clientX,
                        startY: e.clientY,
                        baseOffset: l.labelOffset || { dx: 0, dy: 0 },
                        liveOffset: l.labelOffset || { dx: 0, dy: 0 },
                      })
                    }}
                    onClick={(e) => {
                      // 드래그 없이 순수 클릭일 때만 수정창 오픈 (드래그 종료 시 클릭 이벤트가 같이 발생하는 걸 방지)
                      if (draggingLabel) return
                      onEdgeAction?.(l.edgeId || l.id)
                    }}
                  >
                  <rect
                    x={pillX}
                    y={pillY}
                    width={pillW}
                    height={pillH}
                    rx={11}
                    fill={color + '22'}
                    stroke={color}
                    strokeWidth={1}
                  />
                  <text
                    x={labelX}
                    y={labelY + 4}
                    fill={color}
                    fontSize={12}
                    fontWeight={600}
                    textAnchor="middle"
                  >
                    {l.label}
                  </text>
                  </g>
                )
              })()}
            </g>
          )
        })}
      </g>
    </svg>
  )
}

function MapViewInner({
  centerNode,
  children,
  siblingEdges,
  connectSelection,
  connectionCountOf,
  centerEdgeMap,
  dragEnabled,
  reparentEnabled = true,
  layoutField = 'layout',
  onNodeAction,
  onEdgeAction,
  onEdgeLabelMove,
  onBadgeClick,
  onNodeReparent,
  onNodeReposition,
}) {
  const [dropTargetId, setDropTargetId] = useState(null)
  const [draggingId, setDraggingId] = useState(null)
  const [dragOverridePos, setDragOverridePos] = useState(null) // { id, x, y } — 드래그 중 실시간 위치(엣지가 따라가도록)
  const nodes = useMemo(
    () => buildRadialLayout(centerNode, children, connectSelection, connectionCountOf, onBadgeClick, dragEnabled, dropTargetId, draggingId, layoutField),
    [centerNode, children, connectSelection, connectionCountOf, onBadgeClick, dragEnabled, dropTargetId, draggingId, layoutField],
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
        onNodeDragStart={(_, node) => setDraggingId(node.id)}
        onNodeDrag={(_, node) => {
          if (reparentEnabled) {
            const target = findOverlapTarget(node.id, node.position, nodes.filter((n) => n.id !== centerNode.id))
            setDropTargetId(target)
          }
          setDragOverridePos({ id: node.id, x: node.position.x, y: node.position.y })
        }}
        onNodeDragStop={(_, node) => {
          if (reparentEnabled && dropTargetId) {
            onNodeReparent?.(node.id, dropTargetId)
          } else {
            onNodeReposition?.(node.id, { x: node.position.x, y: node.position.y })
          }
          setDropTargetId(null)
          setDraggingId(null)
          setDragOverridePos(null)
        }}
        onMove={(_, vp) => setViewport(vp)}
        nodesConnectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant="dots" gap={20} size={1.5} color="#d7d9e3" bgColor="#f6f6f9" />
        <Controls showInteractive={false} />
      </ReactFlow>
      <EdgeOverlay
        nodes={nodes}
        centerId={centerNode.id}
        siblingEdges={siblingEdges}
        centerEdgeMap={centerEdgeMap}
        viewport={viewport}
        dragOverridePos={dragOverridePos}
        onEdgeAction={onEdgeAction}
        onEdgeLabelMove={onEdgeLabelMove}
      />
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
