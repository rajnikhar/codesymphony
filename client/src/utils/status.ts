export type StatusTone = 'info' | 'error' | 'success'

export type AppStatus = {
  tone: StatusTone
  title: string
  detail: string
} | null

/** Map raw API / network errors into calm Gallery Mist copy. */
export function friendlyError(error: unknown): AppStatus {
  const raw =
    error instanceof Error ? error.message : 'Something went wrong'

  const lower = raw.toLowerCase()

  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('load failed')
  ) {
    return {
      tone: 'error',
      title: 'We couldn’t reach CodeSymphony core',
      detail:
        'Start Spring Boot on :8090, keep this tab on the same machine, then try again.',
    }
  }

  if (lower.includes('parsing microservice') || lower.includes('/parse')) {
    return {
      tone: 'error',
      title: 'The parser isn’t answering',
      detail:
        'Start the FastAPI parser on :8001 (uvicorn in backend/parser), then tell the story again.',
    }
  }

  if (lower.includes('404') || lower.includes('not found')) {
    return {
      tone: 'error',
      title: 'That repository wasn’t found',
      detail:
        'Use a public GitHub URL you can open in a browser. Private repos need credentials we don’t have yet.',
    }
  }

  if (lower.includes('timeout') || lower.includes('timed out')) {
    return {
      tone: 'error',
      title: 'This is taking too long',
      detail:
        'Large repos can stall. Try a smaller public repo, or retry in a moment.',
    }
  }

  if (lower.includes('exceeds the supported limit') || lower.includes('413')) {
    return {
      tone: 'error',
      title: 'This repository is too large to clone safely',
      detail:
        'We protect this machine with a hard file ceiling. Try a smaller repo, or a project without huge vendored trees.',
    }
  }

  return {
    tone: 'error',
    title: 'We couldn’t finish that step',
    detail: raw,
  }
}
