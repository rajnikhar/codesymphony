import type { GraphEdge, GraphNode, TimelineCommit } from '../types'

export type StoryChapter = 'overview' | 'spine' | 'links' | 'history'

export type SpineFile = {
  path: string
  name: string
  commitCount: number
  churn: number
  inDegree: number
  outDegree: number
  score: number
  role: 'hub' | 'entry' | 'leaf' | 'active'
}

export type StoryLink = {
  from: string
  to: string
  fromName: string
  toName: string
}

export type RepoStoryModel = {
  fileNodes: GraphNode[]
  edgeCount: number
  spine: SpineFile[]
  links: StoryLink[]
  hotCommit: TimelineCommit | null
}

function shortName(path: string): string {
  return path.split('/').pop() ?? path
}

export function buildRepoStory(
  nodes: GraphNode[],
  edges: GraphEdge[],
  commits: TimelineCommit[],
): RepoStoryModel {
  let fileNodes = nodes.filter((node) => node.kind === 'file')

  // Fallback: synthesize file nodes from commit touches (history-only / empty graph)
  if (fileNodes.length === 0 && commits.length > 0) {
    const churn = new Map<string, { commits: number; weight: number }>()
    for (const commit of commits) {
      for (const path of commit.filesChanged) {
        if (!path || path.includes('node_modules')) {
          continue
        }
        const current = churn.get(path) ?? { commits: 0, weight: 0 }
        current.commits += 1
        current.weight += 1 + commit.linesAdded + commit.linesDeleted
        churn.set(path, current)
      }
    }
    fileNodes = [...churn.entries()]
      .sort((a, b) => b[1].weight - a[1].weight)
      .slice(0, 150)
      .map(([path, stats]) => ({
        id: path,
        path,
        kind: 'file',
        commitCount: stats.commits,
        churn: stats.weight,
      }))
  }

  const pathSet = new Set(fileNodes.map((node) => node.path))

  const inDegree = new Map<string, number>()
  const outDegree = new Map<string, number>()
  for (const path of pathSet) {
    inDegree.set(path, 0)
    outDegree.set(path, 0)
  }

  const links: StoryLink[] = []
  for (const edge of edges) {
    if (!pathSet.has(edge.from) || !pathSet.has(edge.to)) {
      continue
    }
    outDegree.set(edge.from, (outDegree.get(edge.from) ?? 0) + 1)
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1)
    links.push({
      from: edge.from,
      to: edge.to,
      fromName: shortName(edge.from),
      toName: shortName(edge.to),
    })
  }

  const spine: SpineFile[] = fileNodes
    .map((node) => {
      const inn = inDegree.get(node.path) ?? 0
      const out = outDegree.get(node.path) ?? 0
      const score = inn * 3 + out * 2 + node.commitCount * 1.5 + node.churn * 0.02
      let role: SpineFile['role'] = 'active'
      if (inn === 0 && out > 0) {
        role = 'entry'
      } else if (inn >= 2 && out >= 1) {
        role = 'hub'
      } else if (out === 0 && inn > 0) {
        role = 'leaf'
      } else if (inn === 0 && out === 0 && node.commitCount > 0) {
        role = 'active'
      }
      return {
        path: node.path,
        name: shortName(node.path),
        commitCount: node.commitCount,
        churn: node.churn,
        inDegree: inn,
        outDegree: out,
        score,
        role,
      }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)

  const hotCommit =
    commits.length === 0
      ? null
      : [...commits].sort(
          (a, b) =>
            b.filesChanged.length + b.linesAdded + b.linesDeleted -
            (a.filesChanged.length + a.linesAdded + a.linesDeleted),
        )[0]

  return {
    fileNodes,
    edgeCount: links.length,
    spine,
    links: links.slice(0, 12),
    hotCommit,
  }
}

export function chapterCopy(
  chapter: StoryChapter,
  mode: string | null,
): { title: string; body: string } {
  switch (chapter) {
    case 'overview':
      return {
        title: 'The story of this codebase',
        body:
          mode === 'HISTORY_ONLY'
            ? 'Import links are sparse — we sample the hottest files from history so every public repo still gets a spine.'
            : 'We’ll walk the spine of the repo: the files that hold it together, how they link, and what changed recently.',
      }
    case 'spine':
      return {
        title: 'The spine',
        body: 'These files score highest as hubs, entry points, or heavily edited centers. Pick one to hear its role.',
      }
    case 'links':
      return {
        title: 'How pieces connect',
        body: 'Each line is an import: one file reaching into another. Follow a link to open that conversation.',
      }
    case 'history':
      return {
        title: 'What moved lately',
        body: 'Scrub the timeline — each beat highlights files touched in that commit. Change is the soundtrack.',
      }
  }
}
