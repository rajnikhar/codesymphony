/**
 * Dependency depth for layered layout.
 *
 * Edge direction: A → B means "A imports B".
 * Depth 0 = roots (in-degree 0 — nothing imports them — entry points).
 * depth(n) = longest path from any root to n along import edges.
 */

export type DepthEdge = {
  from: string
  to: string
  weight?: number
}

export type DepthResult = {
  depthById: Map<string, number>
  /** Edges kept for layering (cycles broken). */
  layeringEdges: DepthEdge[]
  /** Edges removed solely to break cycles for layout. */
  brokenCycleEdges: DepthEdge[]
  /** Nodes that participate in at least one cycle. */
  cyclicIds: Set<string>
  maxDepth: number
}

export function computeDependencyDepth(
  nodeIds: string[],
  edges: DepthEdge[],
): DepthResult {
  const ids = [...new Set(nodeIds)]
  const idSet = new Set(ids)

  const adjacency = new Map<string, string[]>()
  const inDegree = new Map<string, number>()
  for (const id of ids) {
    adjacency.set(id, [])
    inDegree.set(id, 0)
  }

  const uniqueEdges: DepthEdge[] = []
  const seen = new Set<string>()
  for (const edge of edges) {
    if (!idSet.has(edge.from) || !idSet.has(edge.to) || edge.from === edge.to) {
      continue
    }
    const key = `${edge.from}\0${edge.to}`
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    uniqueEdges.push(edge)
    adjacency.get(edge.from)!.push(edge.to)
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1)
  }

  const { layeringEdges, brokenCycleEdges, cyclicIds } = breakCycles(
    ids,
    uniqueEdges,
    adjacency,
    inDegree,
  )

  // Rebuild adjacency from cycle-broken edges for longest-path depths.
  const forward = new Map<string, string[]>()
  const layerIn = new Map<string, number>()
  for (const id of ids) {
    forward.set(id, [])
    layerIn.set(id, 0)
  }
  for (const edge of layeringEdges) {
    forward.get(edge.from)!.push(edge.to)
    layerIn.set(edge.to, (layerIn.get(edge.to) ?? 0) + 1)
  }

  const depthById = new Map<string, number>()
  const queue: string[] = []
  for (const id of ids) {
    if ((layerIn.get(id) ?? 0) === 0) {
      depthById.set(id, 0)
      queue.push(id)
    }
  }

  // Kahn + longest path relaxation (DAG after cycle break).
  const remaining = new Map(layerIn)
  while (queue.length > 0) {
    const node = queue.shift()!
    const base = depthById.get(node) ?? 0
    for (const next of forward.get(node) ?? []) {
      const candidate = base + 1
      const current = depthById.get(next)
      if (current === undefined || candidate > current) {
        depthById.set(next, candidate)
      }
      const left = (remaining.get(next) ?? 1) - 1
      remaining.set(next, left)
      if (left === 0) {
        queue.push(next)
      }
    }
  }

  // Isolated / leftover nodes default to depth 0.
  for (const id of ids) {
    if (!depthById.has(id)) {
      depthById.set(id, 0)
    }
  }

  let maxDepth = 0
  for (const depth of depthById.values()) {
    maxDepth = Math.max(maxDepth, depth)
  }

  return {
    depthById,
    layeringEdges,
    brokenCycleEdges,
    cyclicIds,
    maxDepth,
  }
}

export function bandLabel(depth: number, maxDepth: number): string {
  if (depth === 0) {
    return 'Entry points'
  }
  if (depth === maxDepth && maxDepth > 0) {
    return 'Foundational / shared'
  }
  return `Layer ${depth + 1}`
}

/**
 * Keep layout readable: collapse long chains into at most `maxBands` strips
 * while preserving entry (0) and foundational (last) identity.
 */
export function compressDepths(
  depthById: Map<string, number>,
  maxBands = 6,
): Map<string, number> {
  let maxDepth = 0
  for (const depth of depthById.values()) {
    maxDepth = Math.max(maxDepth, depth)
  }
  const bandCount = maxDepth + 1
  if (bandCount <= maxBands || maxDepth === 0) {
    return new Map(depthById)
  }

  const targetMax = maxBands - 1
  const compressed = new Map<string, number>()
  for (const [id, depth] of depthById) {
    if (depth === 0) {
      compressed.set(id, 0)
      continue
    }
    if (depth === maxDepth) {
      compressed.set(id, targetMax)
      continue
    }
    const scaled = Math.round((depth / maxDepth) * targetMax)
    compressed.set(id, Math.min(targetMax - 1, Math.max(1, scaled)))
  }
  return compressed
}

export function directoryParent(path: string): string {
  const slash = path.lastIndexOf('/')
  if (slash < 0) {
    return '(root)'
  }
  return path.slice(0, slash) || '(root)'
}

/**
 * Break cycles by dropping back-edges discovered during DFS.
 * Dropped edges become same-layer peers (layout only).
 */
function breakCycles(
  ids: string[],
  edges: DepthEdge[],
  adjacency: Map<string, string[]>,
  _inDegree: Map<string, number>,
): {
  layeringEdges: DepthEdge[]
  brokenCycleEdges: DepthEdge[]
  cyclicIds: Set<string>
} {
  const WHITE = 0
  const GRAY = 1
  const BLACK = 2
  const color = new Map<string, number>()
  for (const id of ids) {
    color.set(id, WHITE)
  }

  const backEdgeKeys = new Set<string>()
  const cyclicIds = new Set<string>()

  function dfs(node: string, stack: Set<string>) {
    color.set(node, GRAY)
    stack.add(node)
    for (const next of adjacency.get(node) ?? []) {
      const state = color.get(next) ?? WHITE
      if (state === GRAY) {
        // Back edge closes a cycle.
        backEdgeKeys.add(`${node}\0${next}`)
        cyclicIds.add(node)
        cyclicIds.add(next)
        for (const id of stack) {
          cyclicIds.add(id)
        }
        continue
      }
      if (state === WHITE) {
        dfs(next, stack)
      }
    }
    stack.delete(node)
    color.set(node, BLACK)
  }

  for (const id of ids) {
    if ((color.get(id) ?? WHITE) === WHITE) {
      dfs(id, new Set())
    }
  }

  const layeringEdges: DepthEdge[] = []
  const brokenCycleEdges: DepthEdge[] = []
  for (const edge of edges) {
    const key = `${edge.from}\0${edge.to}`
    if (backEdgeKeys.has(key)) {
      brokenCycleEdges.push(edge)
    } else {
      layeringEdges.push(edge)
    }
  }

  return { layeringEdges, brokenCycleEdges, cyclicIds }
}

export type EdgeLayerKind = 'down' | 'same' | 'skip' | 'cycle'

export function classifyLayerEdge(
  fromDepth: number,
  toDepth: number,
  isBrokenCycle: boolean,
): EdgeLayerKind {
  if (isBrokenCycle) {
    return 'cycle'
  }
  if (fromDepth === toDepth) {
    return 'same'
  }
  // A imports B → B should be deeper (higher depth number).
  if (toDepth === fromDepth + 1) {
    return 'down'
  }
  if (toDepth > fromDepth + 1) {
    return 'skip'
  }
  // Upward (shouldn't happen after cycle break) — treat as same-layer peer.
  return 'same'
}
