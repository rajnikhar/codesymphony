export type RepositoryMode = 'FULL' | 'HISTORY_ONLY'

export type AnalyzeResponse = {
  repositoryId: string
  status: string
  mode: RepositoryMode
  message: string
}

export type RepositoryStatus = {
  repositoryId: string
  status: string
  mode: RepositoryMode
  canonicalUrl: string
  fileCount: number
  edgeCount: number
  message: string
}

export type ExplainFileResponse = {
  path: string
  title: string
  summary: string
  story: string
  points: string[]
  howToReadTheMap: string[]
  questionPrompt: string
}
