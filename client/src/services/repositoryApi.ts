import type {
  AnalyzeResponse,
  ExplainFileResponse,
  FileNeighborhood,
  GraphResponse,
  RepositoryStatus,
  TimelineResponse,
  TreeResponse,
} from '../types'

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8090'

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json()
  if (!response.ok) {
    const message =
      typeof body === 'object' && body && 'message' in body
        ? String((body as { message: string }).message)
        : `Request failed (${response.status})`
    throw new Error(message)
  }
  return body as T
}

export async function pingHealth(): Promise<string> {
  const response = await fetch(`${API_BASE}/api/health`)
  const data = await readJson<{ status: string; service: string }>(response)
  return `${data.service}: ${data.status}`
}

export async function analyzeRepository(url: string): Promise<AnalyzeResponse> {
  const response = await fetch(`${API_BASE}/api/repos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  return readJson<AnalyzeResponse>(response)
}

export async function fetchRepositoryStatus(
  repositoryId: string,
): Promise<RepositoryStatus> {
  const response = await fetch(`${API_BASE}/api/repos/${repositoryId}`)
  return readJson<RepositoryStatus>(response)
}

export async function fetchGraph(repositoryId: string): Promise<GraphResponse> {
  const response = await fetch(`${API_BASE}/api/repos/${repositoryId}/graph`)
  return readJson<GraphResponse>(response)
}

export async function expandGraphDirectory(
  repositoryId: string,
  path: string,
): Promise<GraphResponse> {
  const params = new URLSearchParams({ path })
  const response = await fetch(
    `${API_BASE}/api/repos/${repositoryId}/graph/expand?${params}`,
  )
  return readJson<GraphResponse>(response)
}

export async function fetchTimeline(
  repositoryId: string,
): Promise<TimelineResponse> {
  const response = await fetch(`${API_BASE}/api/repos/${repositoryId}/timeline`)
  return readJson<TimelineResponse>(response)
}

export async function fetchNeighborhood(
  repositoryId: string,
  path: string,
): Promise<FileNeighborhood> {
  const params = new URLSearchParams({ path })
  const response = await fetch(
    `${API_BASE}/api/repos/${repositoryId}/files/neighborhood?${params}`,
  )
  return readJson<FileNeighborhood>(response)
}

export async function fetchTree(repositoryId: string): Promise<TreeResponse> {
  const response = await fetch(`${API_BASE}/api/repos/${repositoryId}/tree`)
  return readJson<TreeResponse>(response)
}

export async function explainFile(
  repositoryId: string,
  path: string,
): Promise<ExplainFileResponse> {
  const response = await fetch(
    `${API_BASE}/api/repos/${repositoryId}/files/explain`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    },
  )
  return readJson<ExplainFileResponse>(response)
}

export { API_BASE }
