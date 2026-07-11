import { useState } from 'react'
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
  const { nodes, edges, status, error, addNode, deleteNode, addEdge } = useMapData()
  const { currentNode, children, goInto, goBack, goToRoot, path } = useMapNavigation(nodes, 'hq')

  const [mode, setMode] = useState('navigate') // navigate | connect | delete
  const [connectFrom, setConnectFrom] = useState(null)
  const [showNodeEditor, setShowNodeEditor] = useState(false)
  const [showTokenModal, setShowTokenModal] = useState(false)
  const [pendingEdge, setPendingEdge] = useState(null) // { source, target }

  if (status === 'loading' || !currentNode) {
    return <div className="loading-screen">불러오는 중...</div>
  }

  const isLeaf = children.length === 0 && currentNode.id !== 'hq'
  const siblingEdges = edges.filter(
    (e) => children.some((c) => c.id === e.source) && children.some((c) => c.id === e.target),
  )

  function handleNodeAction(nodeId) {
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
    goInto(nodeId)
  }

  function toggleMode(next) {
    setConnectFrom(null)
    setMode((prev) => (prev === next ? 'navigate' : next))
  }

  return (
    <div className="app-shell">
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
          <button onClick={() => setShowNodeEditor(true)}>+ 추가</button>
          <button onClick={() => setShowTokenModal(true)}>🔑 토큰</button>
          <span className={`status status-${status}`}>{STATUS_LABEL[status]}</span>
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <main className="map-area">
        {isLeaf ? (
          <DetailPanel node={currentNode} onBack={goBack} />
        ) : (
          <MapView
            centerNode={currentNode}
            children={children}
            siblingEdges={siblingEdges}
            connectSelection={connectFrom ? [connectFrom] : []}
            onNodeAction={handleNodeAction}
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

      {pendingEdge && (
        <EdgeEditor
          sourceLabel={pendingEdge.source.label}
          targetLabel={pendingEdge.target.label}
          onCancel={() => setPendingEdge(null)}
          onSubmit={(label) => {
            addEdge(pendingEdge.source.id, pendingEdge.target.id, label)
            setPendingEdge(null)
            setMode('navigate')
          }}
        />
      )}

      {showTokenModal && <TokenModal onClose={() => setShowTokenModal(false)} />}
    </div>
  )
}

export default App
