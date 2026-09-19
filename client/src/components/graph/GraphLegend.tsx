export function GraphLegend() {
  return (
    <div className="legend" aria-label="Graph legend">
      <div className="legend-item">Layers = dependency depth</div>
      <div className="legend-item">
        <span className="swatch file" /> Size = in-degree
      </div>
      <div className="legend-item">
        <span className="swatch selected" /> Color = churn
      </div>
      <div className="legend-item">
        <span className="swatch line dashed" /> Same-layer / cyclic
      </div>
      <div className="legend-item">
        <span className="swatch line faint" /> Skip-layer import
      </div>
      <div className="legend-item">
        <span className="swatch pulse" /> Commit pulse
      </div>
    </div>
  )
}
