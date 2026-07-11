// 1덩어리용 목업 데이터 - 추후 Gist JSON으로 교체 예정
export const mockNodes = [
  { id: 'hq', label: 'HQ', parentId: null, description: '모든 시스템의 출발점', links: [] },

  { id: 'branch-fornext', label: 'ForNext', parentId: 'hq', description: '키움 실시간알림 + 채점엔진', links: [] },
  { id: 'branch-mmapi', label: 'mmAPI', parentId: 'hq', description: 'SOXL 무한매수법 자동매매', links: [] },
  { id: 'branch-dashboard', label: '대시보드', parentId: 'hq', description: '개인 투자 대시보드 모음', links: [] },

  { id: 'unit-fornext-alert', label: '실시간알림', parentId: 'branch-fornext', description: '키움 API 기반 알림 유닛', links: [] },
  { id: 'unit-fornext-score', label: '채점엔진', parentId: 'branch-fornext', description: '공식 채점 로직', links: [] },

  { id: 'unit-mmapi-buy', label: '매수로직', parentId: 'branch-mmapi', description: '분할매수 스케줄러', links: [] },
  { id: 'unit-mmapi-log', label: '거래로그', parentId: 'branch-mmapi', description: 'GCP VM 로그 저장', links: [] },

  { id: 'unit-dashboard-seed', label: 'SEED', parentId: 'branch-dashboard', description: '메리츠 HTS CSV 기반 대시보드', links: [{ label: 'GitHub Pages', url: 'https://gjdnddd.github.io' }] },
  { id: 'unit-dashboard-vr', label: 'VR대시보드', parentId: 'branch-dashboard', description: 'TQQQ VR 전략 관리', links: [] },

  // 최하위(leaf) 노드 예시 - 3단계 깊이
  { id: 'leaf-alert-detail', label: '알림 조건 설정', parentId: 'unit-fornext-alert', description: '장전 지표 기반 알림 트리거 조건 정의. 무한 depth 예시용 leaf 노드.', links: [] },
]

export const mockEdges = [
  { id: 'e-mmapi-dashboard', source: 'branch-mmapi', target: 'branch-dashboard', label: '데이터 제공' },
]
