import type { GraphEdge, TreeBranch, TreeFile, TreeResponse } from '../types'

export type PlaygroundMode = 'map' | 'tour' | 'path' | 'grow'

export type PlaygroundQuest = {
  id: string
  prompt: string
  hint: string
  /** Paths that count as a correct answer */
  acceptPaths: string[]
  success: string
}

export type FlatTreeFile = TreeFile & {
  directory: string
}

export function flattenTreeFiles(tree: TreeResponse): FlatTreeFile[] {
  const out: FlatTreeFile[] = []
  const walk = (branches: TreeBranch[]) => {
    for (const branch of branches) {
      for (const file of branch.files) {
        out.push({ ...file, directory: branch.directory })
      }
      walk(branch.subBranches)
    }
  }
  walk(tree.branches)
  if (tree.trunk) {
    const already = out.some((file) => file.path === tree.trunk!.path)
    if (!already) {
      const dir = tree.trunk.path.includes('/')
        ? tree.trunk.path.slice(0, tree.trunk.path.lastIndexOf('/'))
        : ''
      out.push({
        path: tree.trunk.path,
        inDegree: tree.trunk.inDegree,
        firstCommitIndex: tree.trunk.firstCommitIndex,
        commitIndicesTouched: [],
        directory: dir,
      })
    }
  }
  return out
}

/** Import neighbors: who this file imports (dependsOn) and who imports it (usedBy). */
export function neighborsOf(
  path: string,
  edges: GraphEdge[],
): { dependsOn: string[]; usedBy: string[] } {
  const dependsOn: string[] = []
  const usedBy: string[] = []
  for (const edge of edges) {
    if (edge.from === path) {
      dependsOn.push(edge.to)
    }
    if (edge.to === path) {
      usedBy.push(edge.from)
    }
  }
  return { dependsOn, usedBy }
}

export function relatedPaths(path: string, edges: GraphEdge[]): Set<string> {
  const { dependsOn, usedBy } = neighborsOf(path, edges)
  return new Set([path, ...dependsOn, ...usedBy])
}

export function shortFileName(path: string): string {
  return path.split('/').pop() ?? path
}

export function buildPlaygroundQuests(tree: TreeResponse): PlaygroundQuest[] {
  const files = flattenTreeFiles(tree)
  const quests: PlaygroundQuest[] = []

  if (tree.trunk) {
    quests.push({
      id: 'find-trunk',
      prompt: 'Find the trunk — the most depended-on file',
      hint: 'Look for the largest / central leaf near the stem.',
      acceptPaths: [tree.trunk.path],
      success: `${shortFileName(tree.trunk.path)} is the hub — ${tree.trunk.inDegree} files import it.`,
    })
  }

  const byDir = new Map<string, FlatTreeFile[]>()
  for (const file of files) {
    if (!file.directory) {
      continue
    }
    const list = byDir.get(file.directory) ?? []
    list.push(file)
    byDir.set(file.directory, list)
  }

  let richest: { directory: string; files: FlatTreeFile[] } | null = null
  for (const [directory, list] of byDir) {
    if (!richest || list.length > richest.files.length) {
      richest = { directory, files: list }
    }
  }

  if (richest && richest.files.length > 0) {
    const biggest = [...richest.files].sort((a, b) => b.inDegree - a.inDegree)[0]
    if (biggest && biggest.inDegree > 0) {
      quests.push({
        id: 'biggest-in-folder',
        prompt: `Click the most-imported file in ${richest.directory}/`,
        hint: 'Leaf size = in-degree (how many files import it).',
        acceptPaths: [biggest.path],
        success: `${shortFileName(biggest.path)} leads ${richest.directory}/ with ${biggest.inDegree} importers.`,
      })
    }
  }

  const topBranch = [...tree.branches].sort((a, b) => b.churn - a.churn)[0]
  if (topBranch) {
    const pathsInBranch: string[] = []
    const collect = (branch: TreeBranch) => {
      for (const file of branch.files) {
        pathsInBranch.push(file.path)
      }
      for (const child of branch.subBranches) {
        collect(child)
      }
    }
    collect(topBranch)
    if (pathsInBranch.length > 0) {
      quests.push({
        id: 'hot-folder',
        prompt: `Which folder changed the most? Click any leaf in ${topBranch.directory}/`,
        hint: 'Thicker branches = more churn (edits over time).',
        acceptPaths: pathsInBranch,
        success: `${topBranch.directory}/ has the highest churn on this tree — that’s where history hit hardest.`,
      })
    }
  }

  return quests.slice(0, 3)
}
