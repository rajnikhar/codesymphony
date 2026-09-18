import type { RepositoryMode } from './repository'

export type TimelineCommit = {
  index: number
  commitHash: string
  timestamp: string
  filesChanged: string[]
  linesAdded: number
  linesDeleted: number
}

export type TimelineResponse = {
  repositoryId: string
  mode: RepositoryMode
  commitCount: number
  commits: TimelineCommit[]
}
