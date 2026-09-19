import type { GraphEdge, GraphNode, TimelineCommit } from '../types'

export type StoryChapter = 'overview' | 'spine' | 'links' | 'history' | 'playground'

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

function isNonCodePath(path: string): boolean {
  const lower = path.replace(/\\/g, '/').toLowerCase()
  const name = lower.slice(lower.lastIndexOf('/') + 1)
  if (!name) {
    return true
  }
  if (
    name === 'license' ||
    name === 'licence' ||
    name.startsWith('license.') ||
    name.startsWith('licence.') ||
    name === 'copying' ||
    name === 'changelog' ||
    name === 'authors' ||
    name === 'contributors' ||
    name.startsWith('readme')
  ) {
    return true
  }
  return (
    name.endsWith('.md') ||
    name.endsWith('.rst') ||
    name.endsWith('.txt') ||
    name.endsWith('.png') ||
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    name.endsWith('.gif') ||
    name.endsWith('.svg') ||
    name.endsWith('.ico') ||
    name.endsWith('.ipynb') ||
    name.endsWith('.csv') ||
    name.endsWith('.json') ||
    name.endsWith('.yml') ||
    name.endsWith('.yaml') ||
    name.endsWith('.toml') ||
    name.endsWith('.lock')
  )
}

export function buildRepoStory(
  nodes: GraphNode[],
  edges: GraphEdge[],
  commits: TimelineCommit[],
): RepoStoryModel {
  let fileNodes = nodes.filter(
    (node) => node.kind === 'file' && !isNonCodePath(node.path),
  )

  // Fallback: synthesize file nodes from commit touches (history-only / empty graph)
  if (fileNodes.length === 0 && commits.length > 0) {
    const churn = new Map<string, { commits: number; weight: number }>()
    for (const commit of commits) {
      for (const path of commit.filesChanged) {
        if (!path || path.includes('node_modules') || isNonCodePath(path)) {
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
      // Primary: in-degree; secondary: out-degree; commit count is only a tiebreaker.
      const score = inn * 1000 + out * 10 + node.commitCount * 0.01
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
    .filter((file) => file.inDegree > 0 || file.outDegree > 0)
    .sort((a, b) => b.score - a.score || b.commitCount - a.commitCount)
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
        title: 'Understand this codebase',
        body:
          mode === 'HISTORY_ONLY'
            ? 'A short brief from history and structure — then a guided path through the files that matter.'
            : 'A plain-English brief, the files to read first, a typical import path, and a short guided tour.',
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
    case 'playground':
      return {
        title: 'How it hangs together',
        body: 'Brief + tour + follow-path on the tree. Trunk is the hub, branches are folders, leaves are files — learn the whole repo by walking it.',
      }
  }
}
