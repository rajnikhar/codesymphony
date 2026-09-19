import { useMemo, useState } from 'react'
import type { GraphEdge, TreeBranch, TreeFile, TreeResponse } from '../../types'
import { relatedPaths } from '../../utils/playgroundLearn'
import {
  getLeafColor,
  hashString,
  seededUnit,
  LEAF_BROWN,
} from '../../utils/treeVisual'

const MAX_DEPTH = 3
const MIN_THICKNESS = 2
const MIN_LEAF_R = 3
const MAX_LEAF_R = 14
const TRUNK_BROWN = '#5c4030'
const BRANCH_BROWN = '#6b5344'
const LINK_COLOR = '#7ec8a3'
const FOCUS_RING = '#e8c547'

type GrowingTreeProps = {
  tree: TreeResponse
  scrubIndex: number
  edges?: GraphEdge[]
  selectedPath?: string | null
  focusPath?: string | null
  /** When set, only these paths stay bright (tour / path modes). */
  highlightPaths?: Set<string> | null
  /** Ordered path for “follow the flow” — draws sequential links. */
  pathChain?: string[]
  selectedDirectory?: string | null
  legendPulse?: 'indegree' | 'churn' | null
  showLabels?: boolean
  onSelectFile?: (path: string) => void
  onHoverFile?: (path: string | null) => void
  onSelectBranch?: (directory: string) => void
}

type DrawSegment = {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
  thickness: number
  firstCommitIndex: number
  directory?: string
  churn?: number
}

type DrawLeaf = {
  id: string
  path: string
  x: number
  y: number
  radius: number
  inDegree: number
  firstCommitIndex: number
  commitIndicesTouched: number[]
  isTrunk?: boolean
}

type DrawFoliage = {
  id: string
  x: number
  y: number
  count: number
  firstCommitIndex: number
}

export function GrowingTree({
  tree,
  scrubIndex,
  edges = [],
  selectedPath = null,
  focusPath = null,
  highlightPaths = null,
  pathChain = [],
  selectedDirectory = null,
  legendPulse = null,
  showLabels = true,
  onSelectFile,
  onHoverFile,
  onSelectBranch,
}: GrowingTreeProps) {
  const [hovered, setHovered] = useState<DrawLeaf | null>(null)
  const totalCommits = tree.totalCommits
  const activeFocus = focusPath ?? hovered?.path ?? selectedPath

  const geometry = useMemo(() => buildGeometry(tree), [tree])

  const leafByPath = useMemo(() => {
    const map = new Map<string, DrawLeaf>()
    for (const leaf of geometry.leaves) {
      map.set(leaf.path, leaf)
    }
    return map
  }, [geometry.leaves])

  const highlight = useMemo(() => {
    if (highlightPaths && highlightPaths.size > 0) {
      return highlightPaths
    }
    if (!activeFocus) {
      return null
    }
    return relatedPaths(activeFocus, edges)
  }, [highlightPaths, activeFocus, edges])

  const linkPairs = useMemo(() => {
    if (!activeFocus || !highlight || (highlightPaths && highlightPaths.size > 0)) {
      return [] as Array<{ x1: number; y1: number; x2: number; y2: number; key: string }>
    }
    const focusLeaf = leafByPath.get(activeFocus)
    if (!focusLeaf) {
      return []
    }
    const pairs: Array<{ x1: number; y1: number; x2: number; y2: number; key: string }> = []
    for (const edge of edges) {
      let other: string | null = null
      if (edge.from === activeFocus) {
        other = edge.to
      } else if (edge.to === activeFocus) {
        other = edge.from
      }
      if (!other || !highlight.has(other)) {
        continue
      }
      const otherLeaf = leafByPath.get(other)
      if (!otherLeaf || otherLeaf.firstCommitIndex > scrubIndex) {
        continue
      }
      pairs.push({
        key: `${edge.from}->${edge.to}`,
        x1: focusLeaf.x,
        y1: focusLeaf.y,
        x2: otherLeaf.x,
        y2: otherLeaf.y,
      })
    }
    return pairs.slice(0, 24)
  }, [activeFocus, edges, highlight, highlightPaths, leafByPath, scrubIndex])

  const chainPairs = useMemo(() => {
    const pairs: Array<{ x1: number; y1: number; x2: number; y2: number; key: string }> = []
    for (let i = 0; i < pathChain.length - 1; i++) {
      const a = leafByPath.get(pathChain[i])
      const b = leafByPath.get(pathChain[i + 1])
      if (!a || !b) {
        continue
      }
      if (a.firstCommitIndex > scrubIndex || b.firstCommitIndex > scrubIndex) {
        continue
      }
      pairs.push({
        key: `chain:${pathChain[i]}->${pathChain[i + 1]}`,
        x1: a.x,
        y1: a.y,
        x2: b.x,
        y2: b.y,
      })
    }
    return pairs
  }, [pathChain, leafByPath, scrubIndex])

  const maxInDegree = useMemo(
    () => Math.max(1, ...geometry.leaves.map((leaf) => leaf.inDegree)),
    [geometry.leaves],
  )
  const maxChurn = useMemo(
    () =>
      Math.max(
        1,
        ...geometry.segments
          .map((segment) => segment.churn ?? 0)
          .filter((value) => value > 0),
      ),
    [geometry.segments],
  )

  const visibleSegments = geometry.segments.filter(
    (segment) => segment.firstCommitIndex <= scrubIndex,
  )
  const visibleLeaves = geometry.leaves.filter(
    (leaf) => leaf.firstCommitIndex <= scrubIndex,
  )
  const visibleFoliage = geometry.foliage.filter(
    (cluster) => cluster.firstCommitIndex <= scrubIndex,
  )

  const labeledLeaves = useMemo(() => {
    if (!showLabels) {
      return [] as DrawLeaf[]
    }
    const ranked = [...visibleLeaves].sort((a, b) => b.inDegree - a.inDegree)
    const picks: DrawLeaf[] = []
    const trunk = ranked.find((leaf) => leaf.isTrunk)
    if (trunk) {
      picks.push(trunk)
    }
    for (const leaf of ranked) {
      if (picks.length >= 5) {
        break
      }
      if (!picks.some((item) => item.path === leaf.path)) {
        picks.push(leaf)
      }
    }
    if (selectedPath) {
      const selected = visibleLeaves.find((leaf) => leaf.path === selectedPath)
      if (selected && !picks.some((item) => item.path === selected.path)) {
        picks.push(selected)
      }
    }
    if (highlightPaths) {
      for (const path of highlightPaths) {
        const leaf = visibleLeaves.find((item) => item.path === path)
        if (leaf && !picks.some((item) => item.path === leaf.path)) {
          picks.push(leaf)
        }
      }
    }
    return picks.slice(0, 8)
  }, [showLabels, visibleLeaves, selectedPath, highlightPaths])

  if (totalCommits <= 0) {
    return null
  }

  return (
    <div className="growing-tree-wrap">
      <svg
        className="growing-tree"
        viewBox={`0 0 ${geometry.width} ${geometry.height}`}
        role="img"
        aria-label="Repository structure as a tree — click leaves to learn connections"
      >
        <rect
          x={0}
          y={0}
          width={geometry.width}
          height={geometry.height}
          fill="#1a1a1a"
          rx={12}
        />

        {visibleSegments.map((segment) => {
          const churnBoost =
            legendPulse === 'churn' && segment.churn
              ? 0.55 + (segment.churn / maxChurn) * 0.45
              : 1
          const isSelectedBranch =
            Boolean(segment.directory) && segment.directory === selectedDirectory
          const dimmed = Boolean(highlight) && !isSelectedBranch && churnBoost === 1
          const clickable = Boolean(segment.directory && onSelectBranch)
          return (
            <line
              key={segment.id}
              className={
                clickable ? 'tree-branch-line tree-branch-clickable' : 'tree-branch-line'
              }
              x1={segment.x1}
              y1={segment.y1}
              x2={segment.x2}
              y2={segment.y2}
              stroke={
                isSelectedBranch
                  ? FOCUS_RING
                  : segment.id.startsWith('trunk')
                    ? TRUNK_BROWN
                    : BRANCH_BROWN
              }
              strokeWidth={
                segment.thickness *
                (legendPulse === 'churn' && segment.churn
                  ? 1 + (segment.churn / maxChurn) * 0.8
                  : 1) *
                (isSelectedBranch ? 1.25 : 1)
              }
              strokeLinecap="round"
              opacity={dimmed ? 0.28 : churnBoost}
              onClick={() => {
                if (segment.directory) {
                  onSelectBranch?.(segment.directory)
                }
              }}
            />
          )
        })}

        {chainPairs.map((pair) => (
          <line
            key={pair.key}
            className="tree-path-chain"
            x1={pair.x1}
            y1={pair.y1}
            x2={pair.x2}
            y2={pair.y2}
            stroke={FOCUS_RING}
            strokeWidth={2.4}
            strokeOpacity={0.95}
            strokeLinecap="round"
          />
        ))}

        {linkPairs.map((pair) => (
          <line
            key={pair.key}
            className="tree-link-line"
            x1={pair.x1}
            y1={pair.y1}
            x2={pair.x2}
            y2={pair.y2}
            stroke={LINK_COLOR}
            strokeWidth={1.6}
            strokeOpacity={0.85}
          />
        ))}

        {visibleFoliage.map((cluster) => (
          <g key={cluster.id} className="tree-foliage" opacity={highlight ? 0.25 : 1}>
            {Array.from({ length: Math.min(cluster.count, 24) }, (_, i) => {
              const ang = seededUnit(hashString(cluster.id), i) * Math.PI * 2
              const dist = 4 + seededUnit(hashString(cluster.id), i + 40) * 18
              return (
                <circle
                  key={`${cluster.id}-${i}`}
                  cx={cluster.x + Math.cos(ang) * dist}
                  cy={cluster.y + Math.sin(ang) * dist}
                  r={1.6 + seededUnit(hashString(cluster.id), i + 80) * 1.4}
                  fill={LEAF_BROWN}
                  opacity={0.55}
                />
              )
            })}
          </g>
        ))}

        {visibleLeaves.map((leaf) => {
          const inHighlight = !highlight || highlight.has(leaf.path)
          const color = getLeafColor(
            leaf.commitIndicesTouched,
            scrubIndex,
            totalCommits,
          )
          const sizeBoost =
            legendPulse === 'indegree'
              ? 1 + (leaf.inDegree / maxInDegree) * 0.7
              : 1
          const isFocus =
            leaf.path === activeFocus || leaf.path === selectedPath
          return (
            <g key={leaf.id}>
              {isFocus && (
                <circle
                  cx={leaf.x}
                  cy={leaf.y}
                  r={leaf.radius * sizeBoost + 5}
                  fill="none"
                  stroke={FOCUS_RING}
                  strokeWidth={2}
                  opacity={0.9}
                />
              )}
              <circle
                className="tree-leaf"
                cx={leaf.x}
                cy={leaf.y}
                r={leaf.radius * sizeBoost}
                fill={color}
                stroke={leaf.isTrunk ? FOCUS_RING : '#2a241c'}
                strokeWidth={leaf.isTrunk ? 2 : 1}
                opacity={inHighlight ? 1 : 0.18}
                onMouseEnter={() => {
                  setHovered(leaf)
                  onHoverFile?.(leaf.path)
                }}
                onMouseLeave={() => {
                  setHovered(null)
                  onHoverFile?.(null)
                }}
                onClick={() => onSelectFile?.(leaf.path)}
              />
            </g>
          )
        })}

        {labeledLeaves.map((leaf) => (
          <text
            key={`label:${leaf.path}`}
            x={leaf.x + leaf.radius + 6}
            y={leaf.y + 4}
            className="tree-leaf-label"
            fill="#f0ebe3"
            fontSize={11}
            fontWeight={leaf.isTrunk ? 700 : 500}
            pointerEvents="none"
          >
            {leaf.isTrunk ? `Trunk · ${shortName(leaf.path)}` : shortName(leaf.path)}
          </text>
        ))}

        {hovered && (
          <g className="tree-tooltip" pointerEvents="none">
            <rect
              x={hovered.x + 12}
              y={hovered.y - 36}
              width={Math.min(240, 36 + hovered.path.length * 6.2)}
              height={44}
              rx={8}
              fill="#2a2a2a"
              stroke="#444"
            />
            <text
              x={hovered.x + 22}
              y={hovered.y - 18}
              fill="#f5f5f5"
              fontSize={12}
              fontWeight={600}
            >
              {shortName(hovered.path)}
            </text>
            <text x={hovered.x + 22} y={hovered.y - 4} fill="#b0b0b0" fontSize={11}>
              imported by {hovered.inDegree} · click to inspect
            </text>
          </g>
        )}
      </svg>
    </div>
  )
}

function buildGeometry(tree: TreeResponse) {
  const width = 960
  const height = 640
  const segments: DrawSegment[] = []
  const leaves: DrawLeaf[] = []
  const foliage: DrawFoliage[] = []

  const originX = width / 2
  const originY = height - 36
  const trunkTopY = height * 0.62
  const trunkPath = tree.trunk?.path ?? 'trunk'
  const trunkFirst = tree.trunk?.firstCommitIndex ?? 0

  segments.push({
    id: `trunk:${trunkPath}`,
    x1: originX,
    y1: originY,
    x2: originX,
    y2: trunkTopY,
    thickness: 18,
    firstCommitIndex: trunkFirst,
    churn: 0,
  })

  if (tree.trunk) {
    const trunkTouches = findFileTouches(tree, tree.trunk.path)
    leaves.push({
      id: `trunk-leaf:${tree.trunk.path}`,
      path: tree.trunk.path,
      x: originX,
      y: trunkTopY,
      radius: leafRadius(tree.trunk.inDegree),
      inDegree: tree.trunk.inDegree,
      firstCommitIndex: tree.trunk.firstCommitIndex,
      commitIndicesTouched: trunkTouches,
      isTrunk: true,
    })
  }

  const topBranches = tree.branches
  const baseAngle = Math.PI / 2
  const spread = Math.PI * 0.95
  const angles = spaceAngles(
    topBranches.map((branch, index) => {
      const seed = hashString(branch.directory)
      const jitter = (seededUnit(seed, index) - 0.5) * ((35 * Math.PI) / 180)
      return (
        baseAngle -
        spread / 2 +
        (spread * (index + 0.5)) / Math.max(topBranches.length, 1) +
        jitter
      )
    }),
  )

  topBranches.forEach((branch, index) => {
    const maxBranchChurn = Math.max(1, ...topBranches.map((item) => item.churn))
    const thickness = Math.max(MIN_THICKNESS, 4 + (branch.churn / maxBranchChurn) * 10)
    const length = 110 + seededUnit(hashString(branch.directory), 3) * 40
    renderBranchNode({
      branch,
      originX,
      originY: trunkTopY,
      angle: angles[index] ?? baseAngle,
      length,
      thickness,
      depth: 1,
      segments,
      leaves,
      foliage,
      maxInDegree: maxInDegreeInTree(tree),
    })
  })

  return { width, height, segments, leaves, foliage }
}

function renderBranchNode(args: {
  branch: TreeBranch
  originX: number
  originY: number
  angle: number
  length: number
  thickness: number
  depth: number
  segments: DrawSegment[]
  leaves: DrawLeaf[]
  foliage: DrawFoliage[]
  maxInDegree: number
}) {
  const {
    branch,
    originX,
    originY,
    angle,
    length,
    thickness,
    depth,
    segments,
    leaves,
    foliage,
    maxInDegree,
  } = args

  const endX = originX + length * Math.cos(angle)
  const endY = originY - length * Math.sin(angle)
  const seed = hashString(branch.directory)

  segments.push({
    id: `branch:${branch.directory}:${depth}`,
    x1: originX,
    y1: originY,
    x2: endX,
    y2: endY,
    thickness,
    firstCommitIndex: branch.firstCommitIndex,
    directory: branch.directory,
    churn: branch.churn,
  })

  branch.files.forEach((file, fileIndex) => {
    placeLeaf(
      file,
      endX,
      endY,
      seed,
      fileIndex,
      branch.firstCommitIndex,
      leaves,
      maxInDegree,
    )
  })

  if (branch.overflowCount > 0) {
    foliage.push({
      id: `foliage:${branch.directory}`,
      x: endX,
      y: endY,
      count: branch.overflowCount,
      firstCommitIndex: branch.firstCommitIndex,
    })
  }

  if (depth >= MAX_DEPTH) {
    return
  }

  const children = branch.subBranches
  if (children.length === 0) {
    const childCount = 2 + Math.floor(seededUnit(seed, 9) * 3)
    const rawAngles = Array.from({ length: childCount }, (_, i) => {
      const jitter = (seededUnit(seed, i + 11) - 0.5) * ((35 * Math.PI) / 180)
      return angle + jitter
    })
    const spaced = spaceAngles(rawAngles)
    spaced.forEach((childAngle, i) => {
      const childLength = length * 0.7
      const childThickness = Math.max(thickness * 0.65, MIN_THICKNESS)
      const cx = endX + childLength * Math.cos(childAngle)
      const cy = endY - childLength * Math.sin(childAngle)
      segments.push({
        id: `twig:${branch.directory}:${i}`,
        x1: endX,
        y1: endY,
        x2: cx,
        y2: cy,
        thickness: childThickness,
        firstCommitIndex: branch.firstCommitIndex,
        churn: branch.churn * 0.4,
      })
    })
    return
  }

  const rawChildAngles = children.map((child, i) => {
    const jitter =
      (seededUnit(hashString(child.directory), i) - 0.5) * ((35 * Math.PI) / 180)
    return angle + jitter
  })
  const childAngles = spaceAngles(rawChildAngles)
  children.forEach((child, i) => {
    renderBranchNode({
      branch: child,
      originX: endX,
      originY: endY,
      angle: childAngles[i] ?? angle,
      length: length * 0.7,
      thickness: Math.max(thickness * 0.65, MIN_THICKNESS),
      depth: depth + 1,
      segments,
      leaves,
      foliage,
      maxInDegree,
    })
  })
}

function placeLeaf(
  file: TreeFile,
  tipX: number,
  tipY: number,
  seed: number,
  index: number,
  branchFirst: number,
  leaves: DrawLeaf[],
  maxInDegree: number,
) {
  const ang = seededUnit(seed, index + 20) * Math.PI * 2
  const dist = 8 + seededUnit(seed, index + 50) * 22
  leaves.push({
    id: `leaf:${file.path}`,
    path: file.path,
    x: tipX + Math.cos(ang) * dist,
    y: tipY + Math.sin(ang) * dist,
    radius: leafRadius(file.inDegree, maxInDegree),
    inDegree: file.inDegree,
    firstCommitIndex: Math.max(file.firstCommitIndex, branchFirst),
    commitIndicesTouched: file.commitIndicesTouched,
  })
}

function leafRadius(inDegree: number, maxInDegree = 20): number {
  const t = Math.min(1, inDegree / Math.max(maxInDegree, 1))
  return MIN_LEAF_R + t * (MAX_LEAF_R - MIN_LEAF_R)
}

function maxInDegreeInTree(tree: TreeResponse): number {
  let max = tree.trunk?.inDegree ?? 1
  const walk = (branches: TreeBranch[]) => {
    for (const branch of branches) {
      for (const file of branch.files) {
        max = Math.max(max, file.inDegree)
      }
      walk(branch.subBranches)
    }
  }
  walk(tree.branches)
  return Math.max(max, 1)
}

function spaceAngles(angles: number[]): number[] {
  if (angles.length <= 1) {
    return angles
  }
  const minGap = (15 * Math.PI) / 180
  const sorted = angles
    .map((angle, index) => ({ angle, index }))
    .sort((a, b) => a.angle - b.angle)
  for (let pass = 0; pass < 8; pass++) {
    for (let i = 1; i < sorted.length; i++) {
      const gap = sorted[i].angle - sorted[i - 1].angle
      if (gap < minGap) {
        const push = (minGap - gap) / 2
        sorted[i - 1].angle -= push
        sorted[i].angle += push
      }
    }
  }
  const result = new Array<number>(angles.length)
  for (const item of sorted) {
    result[item.index] = item.angle
  }
  return result
}

function shortName(path: string): string {
  return path.split('/').pop() ?? path
}

function findFileTouches(tree: TreeResponse, path: string): number[] {
  const walk = (branches: TreeBranch[]): number[] | null => {
    for (const branch of branches) {
      for (const file of branch.files) {
        if (file.path === path) {
          return file.commitIndicesTouched
        }
      }
      const nested = walk(branch.subBranches)
      if (nested) {
        return nested
      }
    }
    return null
  }
  return walk(tree.branches) ?? []
}
