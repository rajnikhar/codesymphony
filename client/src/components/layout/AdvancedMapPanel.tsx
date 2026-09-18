import type { GraphEdge, GraphNode } from '../../types'
import { ForceGraph } from '../graph/ForceGraph'
import { GraphLegend } from '../graph/GraphLegend'

type AdvancedMapPanelProps = {
  nodes: GraphNode[]
  edges: GraphEdge[]
  pulsedPaths: Set<string>
  selectedPath: string | null
  onFileClick: (path: string) => void
}

export function AdvancedMapPanel({
  nodes,
  edges,
  pulsedPaths,
  selectedPath,
  onFileClick,
}: AdvancedMapPanelProps) {
  return (
    <section className="graph-panel" aria-label="Advanced dependency map">
      <div className="graph-toolbar">
        <h2>Advanced map</h2>
        <GraphLegend />
      </div>
      <ForceGraph
        nodes={nodes}
        edges={edges}
        pulsedPaths={pulsedPaths}
        selectedPath={selectedPath}
        onNodeClick={(node) => {
          if (node.kind === 'file') {
            onFileClick(node.path)
          }
        }}
        onNodeActivate={() => undefined}
      />
    </section>
  )
}
