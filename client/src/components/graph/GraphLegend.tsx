export function GraphLegend() {
  return (
    <div className="legend" aria-label="Graph legend">
      <div className="legend-item">
        <span className="swatch file" /> File
      </div>
      <div className="legend-item">
        <span className="swatch directory" /> Folder
      </div>
      <div className="legend-item">
        <span className="swatch selected" /> Selected
      </div>
      <div className="legend-item">
        <span className="swatch pulse" /> Changed in commit
      </div>
      <div className="legend-item">
        <span className="swatch line" /> Import link
      </div>
    </div>
  )
}
