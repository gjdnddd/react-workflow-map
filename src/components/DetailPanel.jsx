export default function DetailPanel({ node, onBack }) {
  return (
    <div className="detail-panel">
      <button className="back-button" onClick={onBack}>← 뒤로</button>
      <h2>{node.label}</h2>
      <p>{node.description || '설명 없음'}</p>
      {node.links?.length > 0 && (
        <ul className="detail-links">
          {node.links.map((link) => (
            <li key={link.url}>
              <a href={link.url} target="_blank" rel="noreferrer">{link.label}</a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
