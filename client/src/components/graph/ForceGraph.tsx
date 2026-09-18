import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import type { GraphEdge, GraphNode } from '../../types'

type ForceGraphProps = {
  nodes: GraphNode[]
  edges: GraphEdge[]
  pulsedPaths: Set<string>
  selectedPath?: string | null
  onNodeClick: (node: GraphNode) => void
  onNodeActivate: (node: GraphNode) => void
}

type SimNode = GraphNode & d3.SimulationNodeDatum
type SimLink = d3.SimulationLinkDatum<SimNode> & { kind: string }

export function ForceGraph({
  nodes,
  edges,
  pulsedPaths,
  selectedPath = null,
  onNodeClick,
  onNodeActivate,
}: ForceGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const onNodeClickRef = useRef(onNodeClick)
  const onNodeActivateRef = useRef(onNodeActivate)

  useEffect(() => {
    onNodeClickRef.current = onNodeClick
    onNodeActivateRef.current = onNodeActivate
  }, [onNodeClick, onNodeActivate])

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const width = container.clientWidth || 800
    const height = container.clientHeight || 420

    container.replaceChildren()

    const svg = d3
      .select(container)
      .append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('width', '100%')
      .attr('height', '100%')

    const simNodes: SimNode[] = nodes.map((node) => ({ ...node }))
    const nodeById = new Map(simNodes.map((node) => [node.id, node]))
    const simLinks: SimLink[] = edges
      .filter((edge) => nodeById.has(edge.from) && nodeById.has(edge.to))
      .map((edge) => ({
        source: edge.from,
        target: edge.to,
        kind: edge.kind,
      }))

    const simulation = d3
      .forceSimulation(simNodes)
      .force(
        'link',
        d3
          .forceLink<SimNode, SimLink>(simLinks)
          .id((node) => node.id)
          .distance(90),
      )
      .force('charge', d3.forceManyBody().strength(-280))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(28))

    const link = svg
      .append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(simLinks)
      .join('line')
      .attr('stroke', '#b8b2a6')
      .attr('stroke-width', 1.4)
      .attr('stroke-opacity', 0.9)

    const nodeSelection = svg
      .append('g')
      .attr('class', 'nodes')
      .selectAll<SVGGElement, SimNode>('g')
      .data(simNodes)
      .join('g')
      .attr('cursor', 'pointer')

    const dragBehaviour = d3
      .drag<SVGGElement, SimNode>()
      .on('start', (event, d) => {
        if (!event.active) {
          simulation.alphaTarget(0.3).restart()
        }
        d.fx = d.x
        d.fy = d.y
      })
      .on('drag', (event, d) => {
        d.fx = event.x
        d.fy = event.y
      })
      .on('end', (event, d) => {
        if (!event.active) {
          simulation.alphaTarget(0)
        }
        d.fx = null
        d.fy = null
      })

    nodeSelection.call(dragBehaviour)

    nodeSelection
      .append('circle')
      .attr('r', (d) => radiusFor(d))
      .attr('fill', (d) => colorFor(d))
      .attr('stroke', '#d5d0c6')
      .attr('stroke-width', 1.5)

    nodeSelection
      .append('text')
      .text((d) => shortLabel(d.path))
      .attr('x', 0)
      .attr('y', 28)
      .attr('text-anchor', 'middle')
      .attr('fill', '#5e5a54')
      .attr('font-size', 11)

    nodeSelection.on('click', (event, d) => {
      event.stopPropagation()
      onNodeClickRef.current(d)
    })

    nodeSelection.on('dblclick', (event, d) => {
      event.stopPropagation()
      onNodeActivateRef.current(d)
    })

    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as SimNode).x ?? 0)
        .attr('y1', (d) => (d.source as SimNode).y ?? 0)
        .attr('x2', (d) => (d.target as SimNode).x ?? 0)
        .attr('y2', (d) => (d.target as SimNode).y ?? 0)

      nodeSelection.attr(
        'transform',
        (d) => `translate(${d.x ?? 0},${d.y ?? 0})`,
      )
    })

    return () => {
      simulation.stop()
      container.replaceChildren()
    }
  }, [nodes, edges])

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }
    d3.select(container)
      .selectAll<SVGCircleElement, SimNode>('circle')
      .attr('fill', (d) => colorFor(d))
      .classed('pulsing', (d) => isPulsed(d, pulsedPaths))
      .classed('selected', (d) => d.path === selectedPath || d.id === selectedPath)
      .attr('stroke', (d) => {
        if (d.path === selectedPath || d.id === selectedPath) {
          return '#a65d2f'
        }
        return isPulsed(d, pulsedPaths) ? '#0e6b5c' : '#d5d0c6'
      })
      .attr('stroke-width', (d) =>
        d.path === selectedPath || d.id === selectedPath || isPulsed(d, pulsedPaths)
          ? 3
          : 1.5,
      )
      .attr('r', (d) => {
        const base = radiusFor(d)
        if (d.path === selectedPath || d.id === selectedPath) {
          return base + 5
        }
        return isPulsed(d, pulsedPaths) ? base + 4 : base
      })
  }, [pulsedPaths, nodes, selectedPath])

  return <div className="force-graph" ref={containerRef} />
}

function radiusFor(node: GraphNode): number {
  return Math.min(22, 8 + Math.sqrt(Math.max(node.churn, 1)) * 1.2)
}

function colorFor(node: GraphNode): string {
  if (node.kind === 'directory') {
    return '#5e5a54'
  }
  if (node.kind === 'aggregate') {
    return '#b8b2a6'
  }
  return '#0e6b5c'
}

function shortLabel(path: string): string {
  const parts = path.split('/')
  return parts[parts.length - 1] || path
}

function isPulsed(node: GraphNode, pulsedPaths: Set<string>): boolean {
  if (pulsedPaths.has(node.path) || pulsedPaths.has(node.id)) {
    return true
  }
  for (const changed of pulsedPaths) {
    if (node.kind === 'directory') {
      if (changed === node.path || changed.startsWith(`${node.path}/`)) {
        return true
      }
      if (node.path === '(root)' && !changed.includes('/')) {
        return true
      }
    }
    if (changed === node.path || changed.endsWith(`/${node.path}`)) {
      return true
    }
  }
  return false
}
