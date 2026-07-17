import { useCallback, useMemo, useState } from 'react'
import { useMapData } from './store/useMapData'
import { useMapNavigation } from './store/useMapNavigation'
import MapView from './components/MapView'
import DetailPanel from './components/DetailPanel'
import NodeEditor from './components/NodeEditor'
import EdgeEditor from './components/EdgeEditor'
import TokenModal from './components/TokenModal'
import './App.css'

const STATUS_LABEL = {
  loading: '불러오는 중...',
  ready: '저장됨',
  saving: '저장 중...',
  error: '오류',
}

function App() {
  const { nodes, edges, status, error, addNode, deleteNode, updateNode, moveNode, repositionNode, repositionNodeInFocus, addEdge, deleteEdge, updateEdge } = useMapData()
  const { currentNode, children, goInto, goBack, goToRoot, goToNode, path } = useMapNavigation(nodes, 'hq')

  const [mode, setMode] = useState('navigate') // navigate | connect | delete | edit
  const [connectFrom, setConnectFrom] = useState(null)
  const [showNodeEditor, setShowNodeEditor] = useState(false)
  const [showTokenModal, setShowTokenModal] = useState(false)
  const [pendingEdge, setPendingEdge] = useState(null) // { source, target }
  const [editingEdge, setEditingEdge] = useState(null) // 기존 연결선(edge 레코드)
  const [editingNode, setEditingNode] = useState(null) // 기존 노드(node 레코드) - 이름/설명 수정
  const [focusNodeId, setFocusNodeId] = useState(null) // 연결 포커스 모드 대상 노드
  const [movingNodeId, setMovingNodeId] = useState(null) // "잘라내기"로 들고 있는 노드 — 멀리 떨어진 곳으로 이동

  // 모든 노드의 연결 개수(브랜치 무관, 전체 edges 기준) — 배지 표시용
  const connectionCounts = useMemo(() => {
    const m = {}
    for (const e of edges) {
      m[e.source] = (m[e.source] || 0) + 1
      m[e.target] = (m[e.target] || 0) + 1
    }
    return m
  }, [edges])
  const connectionCountOf = useCallback((id) => connectionCounts[id] || 0, [connectionCounts])

  // 배지 클릭: 이미 그 노드에 포커스 중이면 해제, 아니면 포커스 진입
  const onBadgeClick = useCallback((id) => {
    setMode('navigate')
    setConnectFrom(null)
    setFocusNodeId((cur) => (cur === id ? null : id))
  }, [])

  // 포커스 모드 파생 데이터: 중심 노드 + 연결된 노드들 + 라벨용 엣지 맵
  const focusNode = focusNodeId ? nodes.find((n) => n.id === focusNodeId) : null
  const focusData = useMemo(() => {
    if (!focusNode) return null
    const related = edges.filter((e) => e.source === focusNode.id || e.target === focusNode.id)
    const centerEdgeMap = {}
    const connectedNodes = []
    const seen = new Set()
    for (const e of related) {
      const otherId = e.source === focusNode.id ? e.target : e.source
      if (otherId === focusNode.id) continue // 자기 자신 연결(루프)은 방사형에서 제외
      const node = nodes.find((n) => n.id === otherId)
      if (!node) continue
      if (!seen.has(otherId)) {
        seen.add(otherId)
        connectedNodes.push(node)
      }
      // 같은 노드로 엣지가 여러 개면 첫 번째를 라벨/클릭 대표로 사용
      if (!centerEdgeMap[otherId]) {
        centerEdgeMap[otherId] = {
          id: e.id, label: e.label, color: e.color, labelOffset: e.labelOffset,
          source: e.source, target: e.target,
        }
      }
    }
    return { connectedNodes, centerEdgeMap }
  }, [focusNode, edges, nodes])

  const inFocus = !!focusNode

  if (status === 'loading' || !currentNode) {
    return <div className="loading-screen">불러오는 중...</div>
  }

  const isLeaf = children.length === 0 && currentNode.id !== 'hq'
  const siblingEdges = edges.filter(
    (e) => children.some((c) => c.id === e.source) && children.some((c) => c.id === e.target),
  )

  function handleNodeAction(nodeId) {
    if (inFocus) {
      // 포커스 모드: 다른 연결 노드를 클릭하면 그 노드 중심으로 포커스 재시작
      setFocusNodeId(nodeId)
      return
    }
    if (mode === 'connect') {
      if (!connectFrom) {
        setConnectFrom(nodeId)
      } else if (connectFrom !== nodeId) {
        const source = children.find((c) => c.id === connectFrom)
        const target = children.find((c) => c.id === nodeId)
        setPendingEdge({ source, target })
        setConnectFrom(null)
      }
      return
    }
    if (mode === 'delete') {
      const target = nodes.find((n) => n.id === nodeId)
      if (window.confirm(`"${target.label}" 및 하위 유닛을 모두 삭제할까요?`)) {
        deleteNode(nodeId)
      }
      setMode('navigate')
      return
    }
    if (mode === 'edit') {
      const target = nodes.find((n) => n.id === nodeId)
      if (target) setEditingNode(target)
      setMode('navigate')
      return
    }
    if (mode === 'move') {
      setMovingNodeId(nodeId)
      setMode('navigate')
      return
    }
    goInto(nodeId)
  }

  function toggleMode(next) {
    setConnectFrom(null)
    setMode((prev) => (prev === next ? 'navigate' : next))
  }

  function handleEdgeClick(edgeId) {
    if (!inFocus && mode !== 'navigate') return // 연결/삭제 모드 중엔 엣지 편집 비활성(포커스 모드는 허용)
    const edge = edges.find((e) => e.id === edgeId)
    if (edge) setEditingEdge(edge)
  }

  // 드래그로 형제 노드 위에 놓았을 때 재부모화. 대상이 자기 자신의 하위(또는 자기 자신)면
  // 순환 구조가 되므로 막는다.
  function isNodeOrDescendant(candidateId, targetId) {
    let cur = nodes.find((n) => n.id === targetId)
    while (cur) {
      if (cur.id === candidateId) return true
      cur = cur.parentId ? nodes.find((n) => n.id === cur.parentId) : null
    }
    return false
  }

  function handleNodeReparent(nodeId, newParentId) {
    if (nodeId === newParentId) return
    if (isNodeOrDescendant(nodeId, newParentId)) {
      window.alert('자기 자신의 하위로는 이동할 수 없습니다.')
      return
    }
    const dragged = nodes.find((n) => n.id === nodeId)
    const target = nodes.find((n) => n.id === newParentId)
    if (window.confirm(`"${dragged.label}"을(를) "${target.label}" 아래로 이동할까요?`)) {
      moveNode(nodeId, newParentId)
    }
  }

  // 형제 위가 아닌 빈 자리에 드래그해서 놓았을 때: 위치만 자유롭게 저장
  function handleNodeReposition(nodeId, pos) {
    repositionNode(nodeId, pos)
  }

  // 연결선 라벨을 드래그해서 옮겼을 때 저장
  function handleEdgeLabelMove(edgeId, labelOffset) {
    updateEdge(edgeId, { labelOffset })
  }

  // "잘라내기"로 들고 있는 노드를, 지금 보고 있는(드릴다운/포커스로 도착한) 노드 밑으로 이동.
  // 화면에 동시에 안 보이는 먼 곳으로도 옮길 수 있음(형제 드래그의 한계를 보완).
  const movingNode = movingNodeId ? nodes.find((n) => n.id === movingNodeId) : null
  function handleMoveHere() {
    const targetId = inFocus ? focusNode.id : currentNode.id
    if (movingNodeId === targetId) {
      window.alert('같은 위치입니다.')
      return
    }
    if (isNodeOrDescendant(movingNodeId, targetId)) {
      window.alert('자기 자신의 하위로는 이동할 수 없습니다.')
      return
    }
    const target = nodes.find((n) => n.id === targetId)
    if (window.confirm(`"${movingNode.label}"을(를) "${target.label}" 아래로 이동할까요?`)) {
      moveNode(movingNodeId, targetId)
      setMovingNodeId(null)
    }
  }

  return (
    <div className="app-shell">
      {inFocus ? (
        <header className="app-header focus-header">
          <span className="focus-title">🔗 {focusNode.label} 의 연결</span>
          <div className="header-actions">
            <button
              onClick={() => {
                const id = focusNode.id
                setFocusNodeId(null)
                goToNode(id)
              }}
            >
              📍 실제 위치로
            </button>
            <button onClick={() => setFocusNodeId(null)}>✕ 닫기</button>
            <span className={`status status-${status}`}>{STATUS_LABEL[status]}</span>
          </div>
        </header>
      ) : (
        <header className="app-header">
          <button onClick={goToRoot} disabled={path.length === 1}>⌂ HQ</button>
          <button onClick={goBack} disabled={path.length === 1}>← 뒤로</button>
          <span className="breadcrumb">{path.join(' / ')}</span>

          <div className="header-actions">
            <button
              className={mode === 'connect' ? 'active' : ''}
              onClick={() => toggleMode('connect')}
              disabled={isLeaf}
            >
              {mode === 'connect' ? (connectFrom ? '연결할 대상 클릭' : '연결할 노드 클릭') : '🔗 연결'}
            </button>
            <button
              className={mode === 'delete' ? 'active' : ''}
              onClick={() => toggleMode('delete')}
              disabled={isLeaf}
            >
              {mode === 'delete' ? '삭제할 노드 클릭' : '🗑 삭제'}
            </button>
            <button
              className={mode === 'edit' ? 'active' : ''}
              onClick={() => toggleMode('edit')}
              disabled={isLeaf}
            >
              {mode === 'edit' ? '수정할 노드 클릭' : '✏️ 수정'}
            </button>
            <button
              className={mode === 'move' ? 'active' : ''}
              onClick={() => toggleMode('move')}
              disabled={isLeaf || !!movingNodeId}
            >
              {mode === 'move' ? '이동할 노드 클릭' : '✂️ 이동'}
            </button>
            <button onClick={() => setShowNodeEditor(true)}>+ 추가</button>
            <button onClick={() => setShowTokenModal(true)}>🔑 토큰</button>
            <span className={`status status-${status}`}>{STATUS_LABEL[status]}</span>
          </div>
        </header>
      )}

      {error && <div className="error-banner">{error}</div>}

      {movingNode && (
        <div className="move-banner">
          <span>✂️ <strong>{movingNode.label}</strong> 이동 중 — 원하는 위치로 이동한 뒤 아래 버튼을 눌러주세요</span>
          <div className="move-banner-actions">
            <button onClick={handleMoveHere}>📌 여기로 이동</button>
            <button onClick={() => setMovingNodeId(null)}>취소</button>
          </div>
        </div>
      )}

      <main className="map-area">
        {inFocus ? (
          <MapView
            centerNode={focusNode}
            children={focusData.connectedNodes}
            siblingEdges={[]}
            connectSelection={[]}
            connectionCountOf={connectionCountOf}
            centerEdgeMap={focusData.centerEdgeMap}
            dragEnabled
            reparentEnabled={false}
            layoutField="focusLayout"
            onNodeAction={handleNodeAction}
            onEdgeAction={handleEdgeClick}
            onEdgeLabelMove={handleEdgeLabelMove}
            onBadgeClick={onBadgeClick}
            onNodeReposition={(nodeId, pos) => repositionNodeInFocus(nodeId, pos)}
          />
        ) : isLeaf ? (
          <DetailPanel node={currentNode} onBack={goBack} />
        ) : (
          <MapView
            centerNode={currentNode}
            children={children}
            siblingEdges={siblingEdges}
            connectSelection={connectFrom ? [connectFrom] : []}
            connectionCountOf={connectionCountOf}
            dragEnabled={mode === 'navigate'}
            onNodeAction={handleNodeAction}
            onEdgeAction={handleEdgeClick}
            onEdgeLabelMove={handleEdgeLabelMove}
            onBadgeClick={onBadgeClick}
            onNodeReparent={handleNodeReparent}
            onNodeReposition={handleNodeReposition}
          />
        )}
      </main>

      {showNodeEditor && (
        <NodeEditor
          onCancel={() => setShowNodeEditor(false)}
          onSubmit={(values) => {
            addNode(currentNode.id, values)
            setShowNodeEditor(false)
          }}
        />
      )}

      {editingNode && (
        <NodeEditor
          initialValues={editingNode}
          onCancel={() => setEditingNode(null)}
          onSubmit={(values) => {
            updateNode(editingNode.id, values)
            setEditingNode(null)
          }}
          onDelete={() => {
            if (window.confirm(`"${editingNode.label}" 및 하위 유닛을 모두 삭제할까요?`)) {
              deleteNode(editingNode.id)
            }
            setEditingNode(null)
          }}
        />
      )}

      {pendingEdge && (
        <EdgeEditor
          sourceLabel={pendingEdge.source.label}
          targetLabel={pendingEdge.target.label}
          onCancel={() => setPendingEdge(null)}
          onSubmit={(label, color) => {
            addEdge(pendingEdge.source.id, pendingEdge.target.id, label, color)
            setPendingEdge(null)
            setMode('navigate')
          }}
        />
      )}

      {editingEdge && (
        <EdgeEditor
          sourceLabel={nodes.find((n) => n.id === editingEdge.source)?.label || '?'}
          targetLabel={nodes.find((n) => n.id === editingEdge.target)?.label || '?'}
          initialLabel={editingEdge.label}
          initialColor={editingEdge.color}
          onCancel={() => setEditingEdge(null)}
          onSubmit={(label, color) => {
            updateEdge(editingEdge.id, { label, color })
            setEditingEdge(null)
          }}
          onDelete={() => {
            if (window.confirm('이 연결선을 삭제할까요?')) {
              deleteEdge(editingEdge.id)
            }
            setEditingEdge(null)
          }}
        />
      )}

      {showTokenModal && <TokenModal onClose={() => setShowTokenModal(false)} />}
    </div>
  )
}

export default App
