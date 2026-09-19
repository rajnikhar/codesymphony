export type TreeTrunk = {
  path: string
  inDegree: number
  firstCommitIndex: number
}

export type TreeFile = {
  path: string
  inDegree: number
  firstCommitIndex: number
  commitIndicesTouched: number[]
}

export type TreeBranch = {
  directory: string
  depth: number
  churn: number
  fileCount: number
  firstCommitIndex: number
  files: TreeFile[]
  overflowCount: number
  subBranches: TreeBranch[]
}

export type TreeResponse = {
  repoId: string
  generatedAt: string
  mode: 'tree' | 'no_structure_detected' | string
  trunk: TreeTrunk | null
  branches: TreeBranch[]
  totalCommits: number
  languageCoverage: Record<string, number>
}
