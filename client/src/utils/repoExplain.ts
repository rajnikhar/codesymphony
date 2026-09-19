import type { GraphEdge, GraphNode, TimelineCommit, TreeResponse } from '../types'
import { buildRepoStory, type SpineFile } from './story'

export type BriefSentence = {
  id: string
  text: string
}

export type ReadFirstFile = {
  path: string
  name: string
  why: string
}

export type PackageHint = {
  name: string
  fileCount: number
}

export type TourStop = {
  id: string
  title: string
  blurb: string
  path: string
  chapterHint: 'spine' | 'links' | 'history' | 'playground'
}

export type FlowStep = {
  path: string
  name: string
}

export type RepoExplanation = {
  repoLabel: string
  sentences: BriefSentence[]
  readFirst: ReadFirstFile[]
  packages: PackageHint[]
  flow: FlowStep[]
  flowBlurb: string
  tour: TourStop[]
  stats: {
    files: number
    links: number
    commits: number
  }
}

function shortName(path: string): string {
  return path.split('/').pop() ?? path
}

function topLevelDir(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/').filter(Boolean)
  if (parts.length <= 1) {
    return '(root)'
  }
  // Prefer package-ish second segment for src/foo layout
  if (
    (parts[0] === 'src' || parts[0] === 'lib' || parts[0] === 'app') &&
    parts.length >= 2
  ) {
    return parts[1]
  }
  return parts[0]
}

function guessLanguageFamily(paths: string[]): string {
  let py = 0
  let js = 0
  let java = 0
  for (const path of paths) {
    const lower = path.toLowerCase()
    if (lower.endsWith('.py')) {
      py++
    } else if (
      lower.endsWith('.ts') ||
      lower.endsWith('.tsx') ||
      lower.endsWith('.js') ||
      lower.endsWith('.jsx')
    ) {
      js++
    } else if (lower.endsWith('.java')) {
      java++
    }
  }
  if (py >= js && py >= java && py > 0) {
    return 'Python'
  }
  if (java >= js && java >= py && java > 0) {
    return 'Java'
  }
  if (js > 0) {
    return 'JavaScript/TypeScript'
  }
  return 'mixed-language'
}

function looksLikeEntryName(path: string): boolean {
  const name = shortName(path).toLowerCase()
  const stem = name.replace(/\.[^.]+$/, '')
  return (
    stem === 'main' ||
    stem === 'index' ||
    stem === 'app' ||
    stem === 'cli' ||
    stem === 'server' ||
    stem === '__main__' ||
    stem === 'api' ||
    stem.endsWith('_main') ||
    name === 'application.java' ||
    name === 'manage.py'
  )
}

function pickEntry(spine: SpineFile[], fileNodes: GraphNode[]): SpineFile | null {
  const entries = spine.filter((file) => file.role === 'entry')
  const named = [...entries, ...spine].find((file) => looksLikeEntryName(file.path))
  if (named) {
    return named
  }
  if (entries.length > 0) {
    return [...entries].sort((a, b) => b.outDegree - a.outDegree)[0]
  }
  // Fallback: file with out>0 and low in
  const candidates = spine.filter((file) => file.outDegree > 0)
  if (candidates.length > 0) {
    return [...candidates].sort(
      (a, b) => a.inDegree - b.inDegree || b.outDegree - a.outDegree,
    )[0]
  }
  if (fileNodes.length > 0) {
    const node = fileNodes[0]
    return {
      path: node.path,
      name: shortName(node.path),
      commitCount: node.commitCount,
      churn: node.churn,
      inDegree: 0,
      outDegree: 0,
      score: 0,
      role: 'active',
    }
  }
  return null
}

function pickHub(spine: SpineFile[], tree: TreeResponse | null): SpineFile | null {
  if (tree?.trunk) {
    const fromSpine = spine.find((file) => file.path === tree.trunk!.path)
    if (fromSpine) {
      return fromSpine
    }
    return {
      path: tree.trunk.path,
      name: shortName(tree.trunk.path),
      commitCount: 0,
      churn: 0,
      inDegree: tree.trunk.inDegree,
      outDegree: 0,
      score: tree.trunk.inDegree * 1000,
      role: 'hub',
    }
  }
  const hubs = spine.filter((file) => file.role === 'hub' || file.inDegree > 0)
  if (hubs.length === 0) {
    return spine[0] ?? null
  }
  return [...hubs].sort((a, b) => b.inDegree - a.inDegree || b.score - a.score)[0]
}

function packageHints(fileNodes: GraphNode[]): PackageHint[] {
  const counts = new Map<string, number>()
  for (const node of fileNodes) {
    const dir = topLevelDir(node.path)
    counts.set(dir, (counts.get(dir) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([name, fileCount]) => ({ name, fileCount }))
    .sort((a, b) => b.fileCount - a.fileCount)
    .slice(0, 4)
}

function buildTypicalFlow(
  entry: SpineFile | null,
  hub: SpineFile | null,
  edges: GraphEdge[],
  pathSet: Set<string>,
): FlowStep[] {
  if (!entry && !hub) {
    return []
  }
  if (!entry) {
    return hub ? [{ path: hub.path, name: hub.name }] : []
  }
  if (!hub || entry.path === hub.path) {
    return [{ path: entry.path, name: entry.name }]
  }

  // BFS from entry along import edges (from → to) toward hub
  const adj = new Map<string, string[]>()
  for (const edge of edges) {
    if (!pathSet.has(edge.from) || !pathSet.has(edge.to)) {
      continue
    }
    const list = adj.get(edge.from) ?? []
    list.push(edge.to)
    adj.set(edge.from, list)
  }

  const queue: string[] = [entry.path]
  const prev = new Map<string, string | null>([[entry.path, null]])
  while (queue.length > 0) {
    const current = queue.shift()!
    if (current === hub.path) {
      break
    }
    for (const next of adj.get(current) ?? []) {
      if (prev.has(next)) {
        continue
      }
      prev.set(next, current)
      queue.push(next)
      if (prev.size > 400) {
        break
      }
    }
  }

  if (prev.has(hub.path)) {
    const chain: string[] = []
    let cursor: string | null = hub.path
    while (cursor) {
      chain.push(cursor)
      cursor = prev.get(cursor) ?? null
    }
    chain.reverse()
    return chain.slice(0, 5).map((path) => ({ path, name: shortName(path) }))
  }

  // No path found — still show entry → hub as the conceptual flow
  return [
    { path: entry.path, name: entry.name },
    { path: hub.path, name: hub.name },
  ]
}

function buildTour(
  entry: SpineFile | null,
  hub: SpineFile | null,
  packages: PackageHint[],
  fileNodes: GraphNode[],
  commits: TimelineCommit[],
  tree: TreeResponse | null,
): TourStop[] {
  const stops: TourStop[] = []
  const used = new Set<string>()

  const push = (stop: TourStop) => {
    if (used.has(stop.path) || stops.length >= 6) {
      return
    }
    used.add(stop.path)
    stops.push(stop)
  }

  if (entry) {
    push({
      id: 'entry',
      title: 'Start at the entry',
      blurb: `${entry.name} reaches outward (${entry.outDegree} imports) — a natural place to begin reading.`,
      path: entry.path,
      chapterHint: 'spine',
    })
  }

  if (hub) {
    push({
      id: 'hub',
      title: 'Meet the core hub',
      blurb: `${hub.name} is imported by ${hub.inDegree} file${hub.inDegree === 1 ? '' : 's'} — the shared center of the graph.`,
      path: hub.path,
      chapterHint: 'playground',
    })
  }

  // Busiest package sample
  const topPkg = packages[0]
  if (topPkg && topPkg.name !== '(root)') {
    const sample =
      fileNodes.find((node) => topLevelDir(node.path) === topPkg.name) ?? null
    if (sample) {
      push({
        id: 'package',
        title: `Walk the ${topPkg.name}/ area`,
        blurb: `${topPkg.name}/ holds about ${topPkg.fileCount} mapped files — a main cluster of this repo.`,
        path: sample.path,
        chapterHint: 'playground',
      })
    }
  }

  // Hot recent file from last commits
  for (let i = commits.length - 1; i >= Math.max(0, commits.length - 40); i--) {
    const commit = commits[i]
    const candidate = commit.filesChanged.find(
      (path) =>
        path &&
        !used.has(path) &&
        fileNodes.some((node) => node.path === path),
    )
    if (candidate) {
      push({
        id: 'recent',
        title: 'See what moved recently',
        blurb: `${shortName(candidate)} showed up in recent history — open it to see how change ripples.`,
        path: candidate,
        chapterHint: 'history',
      })
      break
    }
  }

  // Peripheral / quieter file for contrast
  const quiet = [...fileNodes]
    .filter((node) => !used.has(node.path))
    .sort((a, b) => a.commitCount - b.commitCount || a.churn - b.churn)[0]
  if (quiet && (!tree?.trunk || quiet.path !== tree.trunk.path)) {
    push({
      id: 'edge',
      title: 'Notice the quieter edge',
      blurb: `${shortName(quiet.path)} is less central — useful contrast against the hub.`,
      path: quiet.path,
      chapterHint: 'links',
    })
  }

  if (stops.length === 0 && hub) {
    push({
      id: 'solo',
      title: 'Open the main file',
      blurb: `Start with ${hub.name} — it’s the strongest signal we have in this map.`,
      path: hub.path,
      chapterHint: 'spine',
    })
  }

  return stops
}

export function buildRepoExplanation(args: {
  nodes: GraphNode[]
  edges: GraphEdge[]
  commits: TimelineCommit[]
  tree: TreeResponse | null
  mode: string | null
  canonicalUrl: string | null
}): RepoExplanation {
  const { nodes, edges, commits, tree, mode, canonicalUrl } = args
  const story = buildRepoStory(nodes, edges, commits)
  const repoLabel = canonicalUrl
    ? canonicalUrl.replace(/^https?:\/\/(www\.)?github\.com\//, '')
    : 'this repository'

  const entry = pickEntry(story.spine, story.fileNodes)
  const hub = pickHub(story.spine, tree)
  const packages = packageHints(story.fileNodes)
  const lang = guessLanguageFamily(story.fileNodes.map((node) => node.path))
  const pathSet = new Set(story.fileNodes.map((node) => node.path))
  const flow = buildTypicalFlow(entry, hub, edges, pathSet)

  const sentences: BriefSentence[] = []

  sentences.push({
    id: 'who',
    text: `${repoLabel} maps as a ${lang} codebase with ${story.fileNodes.length} source files and ${story.edgeCount} import links in this view.`,
  })

  if (mode === 'HISTORY_ONLY') {
    sentences.push({
      id: 'mode',
      text: 'Import coverage is thin here, so we lean on commit history to surface the files that matter most.',
    })
  } else if (story.edgeCount > 0) {
    sentences.push({
      id: 'mode',
      text: 'Connections below are file-level imports — a structural map of who depends on whom, not a call graph.',
    })
  }

  if (packages.length > 0) {
    const listed = packages
      .slice(0, 3)
      .map((pkg) => `${pkg.name}/ (${pkg.fileCount})`)
      .join(', ')
    sentences.push({
      id: 'packages',
      text: `Main clusters by folder: ${listed}.`,
    })
  }

  if (entry) {
    sentences.push({
      id: 'entry',
      text: `A good entry point is ${entry.name} — it imports others more than it is imported.`,
    })
  }

  if (hub) {
    sentences.push({
      id: 'hub',
      text: `The structural center is ${hub.name}, depended on by ${hub.inDegree} file${hub.inDegree === 1 ? '' : 's'}${tree?.trunk?.path === hub.path ? ' (the playground trunk)' : ''}.`,
    })
  }

  if (commits.length > 0) {
    sentences.push({
      id: 'history',
      text: `We tracked ${commits.length} commits — scrub History to see which files moved together over time.`,
    })
  }

  sentences.push({
    id: 'how',
    text: 'Read the three files below first, follow the typical path, then take the guided tour — open any file for a plain-English scene.',
  })

  const readFirst: ReadFirstFile[] = []
  if (entry) {
    readFirst.push({
      path: entry.path,
      name: entry.name,
      why: 'Entry — start reading here',
    })
  }
  if (hub && hub.path !== entry?.path) {
    readFirst.push({
      path: hub.path,
      name: hub.name,
      why: 'Hub — most depended-on',
    })
  }
  // Third: highest churn file not already listed
  const third = [...story.fileNodes]
    .filter((node) => !readFirst.some((item) => item.path === node.path))
    .sort((a, b) => b.churn - a.churn || b.commitCount - a.commitCount)[0]
  if (third) {
    readFirst.push({
      path: third.path,
      name: shortName(third.path),
      why: 'Active — high edit gravity',
    })
  }

  const flowBlurb =
    flow.length >= 2
      ? `A typical path through the map: ${flow.map((step) => step.name).join(' → ')}.`
      : flow.length === 1
        ? `Begin with ${flow[0].name} — we don’t have a longer import path yet.`
        : 'Not enough import edges to sketch a path — use History and the spine instead.'

  const tour = buildTour(entry, hub, packages, story.fileNodes, commits, tree)

  return {
    repoLabel,
    sentences: sentences.slice(0, 8),
    readFirst: readFirst.slice(0, 3),
    packages,
    flow,
    flowBlurb,
    tour,
    stats: {
      files: story.fileNodes.length,
      links: story.edgeCount,
      commits: commits.length,
    },
  }
}
