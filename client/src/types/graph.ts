import type { RepositoryMode } from './repository'

export type GraphNode = {
  id: string
  path: string
  kind: string
  commitCount: number
  churn: number
}

export type GraphEdge = {
  from: string
  to: string
  kind: string
}

export type GraphResponse = {
  repositoryId: string
  mode: RepositoryMode
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export type RelatedFile = {
  path: string
  language: string
  commitCount: number
  churn: number
  relation: string
}

export type FileNeighborhood = {
  repositoryId: string
  path: string
  language: string
  commitCount: number
  churn: number
  dependsOn: RelatedFile[]
  usedBy: RelatedFile[]
  focusGraph: GraphResponse
}
