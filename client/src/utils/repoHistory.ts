const STORAGE_KEY = 'codesymphony.pastRepos'
const MAX_ENTRIES = 12

export type PastRepo = {
  url: string
  label: string
  visitedAt: number
}

function labelFromUrl(url: string): string {
  return url
    .trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//i, '')
    .replace(/\.git$/i, '')
}

export function loadPastRepos(): PastRepo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return []
    }
    const parsed = JSON.parse(raw) as PastRepo[]
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed
      .filter((entry) => entry && typeof entry.url === 'string')
      .slice(0, MAX_ENTRIES)
  } catch {
    return []
  }
}

export function rememberRepo(url: string): PastRepo[] {
  const trimmed = url.trim()
  if (!trimmed) {
    return loadPastRepos()
  }
  const next: PastRepo = {
    url: trimmed,
    label: labelFromUrl(trimmed),
    visitedAt: Date.now(),
  }
  const existing = loadPastRepos().filter(
    (entry) => entry.url.toLowerCase() !== trimmed.toLowerCase(),
  )
  const merged = [next, ...existing].slice(0, MAX_ENTRIES)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
  } catch {
    // ignore quota / private mode
  }
  return merged
}

export function clearPastRepos(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
