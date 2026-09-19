import { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import type { GraphEdge, GraphNode } from '../../types'
import {
  bandLabel,
  classifyLayerEdge,
  compressDepths,
  computeDependencyDepth,
  directoryParent,
  type EdgeLayerKind,
} from '../../utils/dependencyDepth'

const DEFAULT_LAYER_CAP = 36
const FOUNDATIONAL_MIN_RADIUS = 10

type ForceGraphProps = {
  nodes: GraphNode[]
  edges: GraphEdge[]
  pulsedPaths: Set<string>
  selectedPath?: string | null
  onNodeClick: (node: GraphNode) => void
  onNodeActivate: (node: GraphNode) => void
}

type SimNode = GraphNode &
  d3.SimulationNodeDatum & {
    inDegree: number
    outDegree: number
    depth: number
    cyclic: boolean
    directory: string
    isolated: boolean
  }

type SimLink = d3.SimulationLinkDatum<SimNode> & {
  kind: string
  weight: number
  layerKind: EdgeLayerKind
}

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
  const [expandedLayers, setExpandedLayers] = useState<Set<number>>(
    () => new Set(),
  )
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)

  const model = useMemo(
    () => buildLayerModel(nodes, edges, expandedLayers, DEFAULT_LAYER_CAP),
    [nodes, edges, expandedLayers],
  )

  useEffect(() => {
    onNodeClickRef.current = onNodeClick
    onNodeActivateRef.current = onNodeActivate
  }, [onNodeClick, onNodeActivate])

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const width = container.clientWidth || 960
    const height = Math.max(container.clientHeight || 560, 420)
    container.replaceChildren()

    const svg = d3
      .select(container)
      .append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('width', '100%')
      .attr('height', '100%')

    const defs = svg.append('defs')
    defs
      .append('marker')
      .attr('id', 'arrow-down')
      .attr('viewBox', '0 -4 8 8')
      .attr('refX', 8)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-3.5L8,0L0,3.5')
      .attr('fill', '#8a847a')

    const bandCount = model.bands.length || 1
    const labelWidth = 128
    const plotLeft = labelWidth + 12
    const plotWidth = width - plotLeft - 16
    const bandGap = 10
    const usableHeight = height - 24
    const totalWeight = model.bands.reduce((sum, band) => sum + band.weight, 0) || 1

    let yCursor = 12
    const bandLayout = model.bands.map((band) => {
      const bandHeight = Math.max(
        72,
        (usableHeight - bandGap * (bandCount - 1)) * (band.weight / totalWeight),
      )
      const top = yCursor
      const centerY = top + bandHeight / 2
      yCursor += bandHeight + bandGap
      return { ...band, top, height: bandHeight, centerY }
    })

    // Band backgrounds + directory group cues + labels
    const bandLayer = svg.append('g').attr('class', 'bands')
    for (const band of bandLayout) {
      bandLayer
        .append('rect')
        .attr('x', 0)
        .attr('y', band.top)
        .attr('width', width)
        .attr('height', band.height)
        .attr('fill', band.depth % 2 === 0 ? 'rgba(255,253,249,0.55)' : 'rgba(243,241,236,0.7)')
        .attr('stroke', 'rgba(213,208,198,0.45)')

      bandLayer
        .append('text')
        .attr('x', 12)
        .attr('y', band.centerY)
        .attr('dominant-baseline', 'middle')
        .attr('fill', '#5e5a54')
        .attr('font-size', 12)
        .attr('font-weight', 600)
        .text(band.label)

      if (band.hiddenCount > 0) {
        const expandBtn = bandLayer
          .append('g')
          .attr('transform', `translate(${12}, ${band.top + band.height - 22})`)
          .attr('cursor', 'pointer')
        expandBtn
          .append('text')
          .attr('fill', '#0e6b5c')
          .attr('font-size', 11)
          .text(
            expandedLayers.has(band.depth)
              ? 'Show fewer'
              : `+${band.hiddenCount} more in this layer`,
          )
        expandBtn.on('click', (event) => {
          event.stopPropagation()
          setExpandedLayers((prev) => {
            const next = new Set(prev)
            if (next.has(band.depth)) {
              next.delete(band.depth)
            } else {
              next.add(band.depth)
            }
            return next
          })
        })
      }

      // Subtle directory grouping rectangles within the band
      for (const group of band.directoryGroups) {
        bandLayer
          .append('rect')
          .attr('x', plotLeft + group.x)
          .attr('y', band.centerY - 28)
          .attr('width', Math.max(group.width, 40))
          .attr('height', 56)
          .attr('rx', 10)
          .attr('fill', 'rgba(14, 107, 92, 0.04)')
          .attr('stroke', 'rgba(14, 107, 92, 0.12)')
      }
    }

    const simNodes: SimNode[] = model.visibleNodes.map((node) => {
      const band = bandLayout.find((item) => item.depth === node.depth)!
      return {
        ...node,
        x: plotLeft + 40 + Math.random() * Math.max(plotWidth - 80, 40),
        y: band.centerY,
      }
    })
    const nodeById = new Map(simNodes.map((node) => [node.id, node]))

    const simLinks: SimLink[] = model.visibleEdges
      .filter((edge) => nodeById.has(edge.from) && nodeById.has(edge.to))
      .map((edge) => ({
        source: edge.from,
        target: edge.to,
        kind: edge.kind,
        weight: edge.weight,
        layerKind: edge.layerKind,
      }))

    const maxIn = Math.max(1, ...simNodes.map((node) => node.inDegree))
    const maxChurn = Math.max(1, ...simNodes.map((node) => node.churn))
    const maxWeight = Math.max(1, ...simLinks.map((link) => link.weight))
    const deepest = model.maxDepth

    const simulation = d3
      .forceSimulation(simNodes)
      .force(
        'link',
        d3
          .forceLink<SimNode, SimLink>(
            simLinks.filter((link) => link.layerKind === 'down' || link.layerKind === 'skip'),
          )
          .id((node) => node.id)
          .distance((link) => (link.layerKind === 'skip' ? 120 : 70))
          .strength((link) => (link.layerKind === 'skip' ? 0.05 : 0.15)),
      )
      .force('charge', d3.forceManyBody().strength(-180))
      .force(
        'x',
        d3
          .forceX<SimNode>((node) => {
            const band = bandLayout.find((item) => item.depth === node.depth)
            const groups = band?.directoryGroups ?? []
            const group = groups.find((item) => item.directory === node.directory)
            if (group) {
              return plotLeft + group.x + group.width / 2
            }
            return plotLeft + plotWidth / 2
          })
          .strength(0.08),
      )
      .force(
        'y',
        d3
          .forceY<SimNode>((node) => {
            const band = bandLayout.find((item) => item.depth === node.depth)
            return band?.centerY ?? height / 2
          })
          .strength(0.85),
      )
      .force(
        'collision',
        d3
          .forceCollide<SimNode>()
          .radius((node) => radiusFor(node, maxIn, deepest) + 8)
          .strength(0.9),
      )

    const link = svg
      .append('g')
      .attr('class', 'links')
      .selectAll('path')
      .data(simLinks)
      .join('path')
      .attr('fill', 'none')
      .attr('stroke', (d) => strokeForKind(d.layerKind))
      .attr('stroke-width', (d) => 1 + 2.2 * (d.weight / maxWeight))
      .attr('stroke-opacity', (d) => opacityForKind(d.layerKind))
      .attr('stroke-dasharray', (d) =>
        d.layerKind === 'same' || d.layerKind === 'cycle' ? '5 4' : null,
      )
      .attr('marker-end', (d) =>
        d.layerKind === 'down' || d.layerKind === 'skip' ? 'url(#arrow-down)' : null,
      )

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
          simulation.alphaTarget(0.25).restart()
        }
        d.fx = d.x
        d.fy = d.y
      })
      .on('drag', (event, d) => {
        const band = bandLayout.find((item) => item.depth === d.depth)
        d.fx = Math.max(plotLeft + 16, Math.min(width - 16, event.x))
        if (band) {
          d.fy = Math.max(band.top + 18, Math.min(band.top + band.height - 18, event.y))
        } else {
          d.fy = event.y
        }
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
      .attr('r', (d) => radiusFor(d, maxIn, deepest))
      .attr('fill', (d) => colorFor(d, maxChurn))
      .attr('stroke', (d) => (d.cyclic ? '#a65d2f' : '#d5d0c6'))
      .attr('stroke-width', (d) => (d.cyclic ? 2.5 : 1.5))
      .attr('stroke-dasharray', (d) => (d.cyclic ? '3 2' : null))

    nodeSelection
      .filter((d) => d.cyclic)
      .append('text')
      .attr('x', (d) => radiusFor(d, maxIn, deepest) - 2)
      .attr('y', (d) => -radiusFor(d, maxIn, deepest) + 2)
      .attr('font-size', 10)
      .attr('fill', '#a65d2f')
      .text('⚠')

    nodeSelection
      .append('text')
      .text((d) => shortLabel(d.path))
      .attr('x', 0)
      .attr('y', (d) => radiusFor(d, maxIn, deepest) + 12)
      .attr('text-anchor', 'middle')
      .attr('fill', '#3d3a35')
      .attr('font-size', 10)

    nodeSelection
      .on('mouseenter', (_event, d) => setHoveredId(d.id))
      .on('mouseleave', () => setHoveredId(null))
      .on('click', (event, d) => {
        event.stopPropagation()
        setFocusId(d.id)
        onNodeClickRef.current(d)
      })
      .on('dblclick', (event, d) => {
        event.stopPropagation()
        onNodeActivateRef.current(d)
      })

    svg.on('click', () => setFocusId(null))

    simulation.on('tick', () => {
      for (const node of simNodes) {
        const band = bandLayout.find((item) => item.depth === node.depth)
        if (!band) {
          continue
        }
        node.y = band.centerY * 0.15 + (node.y ?? band.centerY) * 0.85
        node.y = Math.max(band.top + 16, Math.min(band.top + band.height - 16, node.y ?? band.centerY))
        node.x = Math.max(plotLeft + 16, Math.min(width - 16, node.x ?? plotLeft))
      }

      link.attr('d', (d) => linkPath(d))
      nodeSelection.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`)
    })

    return () => {
      simulation.stop()
      container.replaceChildren()
    }
  }, [model, expandedLayers])

  // Hover / focus dimming
  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }
    const activeId = hoveredId ?? focusId
    const neighborIds = new Set<string>()
    if (activeId) {
      neighborIds.add(activeId)
      for (const edge of model.visibleEdges) {
        if (edge.from === activeId || edge.to === activeId) {
          neighborIds.add(edge.from)
          neighborIds.add(edge.to)
        }
      }
    }

    d3.select(container)
      .selectAll<SVGGElement, SimNode>('g.nodes g')
      .attr('opacity', (d) => {
        if (!activeId) {
          return d.isolated ? 0.45 : 1
        }
        return neighborIds.has(d.id) ? 1 : 0.12
      })

    d3.select(container)
      .selectAll<SVGPathElement, SimLink>('g.links path')
      .attr('opacity', (d) => {
        const source = typeof d.source === 'object' ? (d.source as SimNode).id : String(d.source)
        const target = typeof d.target === 'object' ? (d.target as SimNode).id : String(d.target)
        if (!activeId) {
          return opacityForKind(d.layerKind)
        }
        if (source === activeId || target === activeId) {
          return Math.max(opacityForKind(d.layerKind), 0.9)
        }
        return 0.04
      })
      .attr('marker-end', (d) => {
        const source = typeof d.source === 'object' ? (d.source as SimNode).id : String(d.source)
        const target = typeof d.target === 'object' ? (d.target as SimNode).id : String(d.target)
        const related =
          !activeId || source === activeId || target === activeId
        if (!related) {
          return null
        }
        return d.layerKind === 'down' || d.layerKind === 'skip'
          ? 'url(#arrow-down)'
          : null
      })

    const maxIn = Math.max(1, ...model.visibleNodes.map((node) => node.inDegree))
    const deepest = model.maxDepth
    d3.select(container)
      .selectAll<SVGCircleElement, SimNode>('circle')
      .classed('pulsing', (d) => isPulsed(d, pulsedPaths))
      .classed('selected', (d) => d.path === selectedPath || d.id === selectedPath)
      .attr('stroke', (d) => {
        if (d.path === selectedPath || d.id === selectedPath) {
          return '#a65d2f'
        }
        if (isPulsed(d, pulsedPaths)) {
          return '#0e6b5c'
        }
        return d.cyclic ? '#a65d2f' : '#d5d0c6'
      })
      .attr('r', (d) => {
        const base = radiusFor(d, maxIn, deepest)
        if (d.path === selectedPath || d.id === selectedPath) {
          return base + 4
        }
        return isPulsed(d, pulsedPaths) ? base + 3 : base
      })
  }, [hoveredId, focusId, model, pulsedPaths, selectedPath])

  return <div className="force-graph force-graph-hero force-graph-layered" ref={containerRef} />
}

type VisibleEdge = {
  from: string
  to: string
  kind: string
  weight: number
  layerKind: EdgeLayerKind
}

type BandModel = {
  depth: number
  label: string
  weight: number
  hiddenCount: number
  directoryGroups: { directory: string; x: number; width: number }[]
}

type LayerNode = GraphNode & {
  inDegree: number
  outDegree: number
  depth: number
  cyclic: boolean
  directory: string
  isolated: boolean
}

function buildLayerModel(
  nodes: GraphNode[],
  edges: GraphEdge[],
  expandedLayers: Set<number>,
  layerCap: number,
) {
  const fileNodes = nodes.filter((node) => node.kind === 'file' || node.kind === 'directory')
  const workingNodes = fileNodes.length > 0 ? fileNodes : nodes
  const ids = workingNodes.map((node) => node.id)
  const idSet = new Set(ids)

  const weightMap = new Map<string, number>()
  for (const edge of edges) {
    if (!idSet.has(edge.from) || !idSet.has(edge.to) || edge.from === edge.to) {
      continue
    }
    const key = `${edge.from}\0${edge.to}`
    weightMap.set(key, (weightMap.get(key) ?? 0) + 1)
  }
  const uniqueEdges = [...weightMap.entries()].map(([key, weight]) => {
    const [from, to] = key.split('\0')
    return { from, to, weight }
  })

  const depthResult = computeDependencyDepth(ids, uniqueEdges)
  const displayDepths = compressDepths(depthResult.depthById, 6)
  let displayMax = 0
  for (const depth of displayDepths.values()) {
    displayMax = Math.max(displayMax, depth)
  }
  const brokenKeys = new Set(
    depthResult.brokenCycleEdges.map((edge) => `${edge.from}\0${edge.to}`),
  )

  const inDegree = new Map<string, number>()
  const outDegree = new Map<string, number>()
  for (const id of ids) {
    inDegree.set(id, 0)
    outDegree.set(id, 0)
  }
  for (const edge of uniqueEdges) {
    outDegree.set(edge.from, (outDegree.get(edge.from) ?? 0) + 1)
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1)
  }

  const enriched: LayerNode[] = workingNodes.map((node) => {
    const inn = inDegree.get(node.id) ?? 0
    const out = outDegree.get(node.id) ?? 0
    return {
      ...node,
      inDegree: inn,
      outDegree: out,
      depth: displayDepths.get(node.id) ?? 0,
      cyclic: depthResult.cyclicIds.has(node.id),
      directory: directoryParent(node.path),
      isolated: inn + out === 0,
    }
  })

  // Prefer connected nodes; keep isolates at depth 0 but smaller visual weight.
  const depths = [...new Set(enriched.map((node) => node.depth))].sort((a, b) => a - b)
  const maxDepth = displayMax

  const visibleNodes: LayerNode[] = []
  const bands: BandModel[] = []
  const plotWidth = 700

  for (const depth of depths) {
    const inBand = enriched
      .filter((node) => node.depth === depth)
      .sort(
        (a, b) =>
          b.inDegree - a.inDegree ||
          b.churn - a.churn ||
          a.path.localeCompare(b.path),
      )
    const expanded = expandedLayers.has(depth)
    const capped = expanded ? inBand : inBand.slice(0, layerCap)
    const hiddenCount = Math.max(0, inBand.length - capped.length)
    visibleNodes.push(...capped)

    const byDir = new Map<string, LayerNode[]>()
    for (const node of capped) {
      const list = byDir.get(node.directory) ?? []
      list.push(node)
      byDir.set(node.directory, list)
    }
    const dirs = [...byDir.keys()].sort()
    const directoryGroups = dirs.map((directory, index) => {
      const count = byDir.get(directory)!.length
      const width = Math.max(56, (plotWidth / Math.max(dirs.length, 1)) * 0.85)
      const x = (plotWidth / Math.max(dirs.length, 1)) * index + 8
      return { directory, x, width: width * Math.min(1, 0.35 + count * 0.08) }
    })

    const avgSize =
      capped.reduce((sum, node) => sum + Math.max(node.inDegree, 1), 0) /
        Math.max(capped.length, 1) || 1

    bands.push({
      depth,
      label: bandLabel(depth, maxDepth),
      weight: 0.7 + Math.log2(1 + capped.length) * 0.35 + Math.log2(1 + avgSize) * 0.25,
      hiddenCount,
      directoryGroups,
    })
  }

  const visibleIds = new Set(visibleNodes.map((node) => node.id))
  const visibleEdges: VisibleEdge[] = uniqueEdges
    .filter((edge) => visibleIds.has(edge.from) && visibleIds.has(edge.to))
    .map((edge) => {
      const fromDepth = displayDepths.get(edge.from) ?? 0
      const toDepth = displayDepths.get(edge.to) ?? 0
      const key = `${edge.from}\0${edge.to}`
      return {
        from: edge.from,
        to: edge.to,
        kind: 'import',
        weight: edge.weight,
        layerKind: classifyLayerEdge(fromDepth, toDepth, brokenKeys.has(key)),
      }
    })

  return {
    visibleNodes,
    visibleEdges,
    bands,
    maxDepth,
  }
}

function radiusFor(node: SimNode | LayerNode, maxIn: number, maxDepth: number): number {
  if (node.isolated) {
    return 6
  }
  const centrality = node.inDegree / maxIn
  let radius = 8 + centrality * 14 + Math.min(5, Math.sqrt(Math.max(node.churn, 1)) * 0.35)
  if (node.depth === maxDepth && maxDepth > 0) {
    radius = Math.max(radius, FOUNDATIONAL_MIN_RADIUS)
  }
  return radius
}

function colorFor(node: SimNode | LayerNode, maxChurn: number): string {
  if (node.isolated) {
    return '#c5bfb4'
  }
  const hot = node.churn / Math.max(maxChurn, 1)
  if (hot > 0.66) {
    return '#a65d2f'
  }
  if (hot > 0.33) {
    return '#0e6b5c'
  }
  return '#5a9e92'
}

function strokeForKind(kind: EdgeLayerKind): string {
  switch (kind) {
    case 'cycle':
    case 'same':
      return '#a65d2f'
    case 'skip':
      return '#8a847a'
    default:
      return '#5e5a54'
  }
}

function opacityForKind(kind: EdgeLayerKind): number {
  switch (kind) {
    case 'skip':
      return 0.22
    case 'same':
    case 'cycle':
      return 0.55
    default:
      return 0.7
  }
}

function linkPath(link: SimLink): string {
  const source = link.source as SimNode
  const target = link.target as SimNode
  const x1 = source.x ?? 0
  const y1 = source.y ?? 0
  const x2 = target.x ?? 0
  const y2 = target.y ?? 0
  if (link.layerKind === 'same' || link.layerKind === 'cycle') {
    const lift = -28
    const mx = (x1 + x2) / 2
    const my = Math.min(y1, y2) + lift
    return `M${x1},${y1} Q${mx},${my} ${x2},${y2}`
  }
  if (link.layerKind === 'skip') {
    const mx = (x1 + x2) / 2
    const my = (y1 + y2) / 2
    return `M${x1},${y1} Q${mx + 18},${my} ${x2},${y2}`
  }
  return `M${x1},${y1} L${x2},${y2}`
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
    if (changed === node.path || changed.endsWith(`/${node.path}`)) {
      return true
    }
  }
  return false
}
