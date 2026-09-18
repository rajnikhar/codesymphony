import { useCallback, useMemo, useState } from 'react'
import {
  analyzeRepository,
  explainFile,
  fetchGraph,
  fetchNeighborhood,
  fetchTimeline,
} from '../services/repositoryApi'
import type {
  ExplainFileResponse,
  FileNeighborhood,
  GraphResponse,
  RepositoryMode,
  TimelineCommit,
} from '../types'
import type { StoryChapter } from '../utils/story'
import { friendlyError, type AppStatus } from '../utils/status'

type UseRepositoryStoryOptions = {
  onRepoRemembered?: (url: string) => void
  onPastReposHide?: () => void
}

export function useRepositoryStory(options: UseRepositoryStoryOptions = {}) {
  const { onRepoRemembered, onPastReposHide } = options

  const [url, setUrl] = useState('')
  const [status, setStatus] = useState<AppStatus>(null)
  const [loading, setLoading] = useState(false)
  const [repositoryId, setRepositoryId] = useState<string | null>(null)
  const [mode, setMode] = useState<RepositoryMode | null>(null)
  const [canonicalUrl, setCanonicalUrl] = useState<string | null>(null)
  const [fullGraph, setFullGraph] = useState<GraphResponse | null>(null)
  const [commits, setCommits] = useState<TimelineCommit[]>([])
  const [scrubIndex, setScrubIndex] = useState(0)
  const [chapter, setChapter] = useState<StoryChapter>('overview')
  const [showAdvancedMap, setShowAdvancedMap] = useState(false)
  const [neighborhood, setNeighborhood] = useState<FileNeighborhood | null>(
    null,
  )
  const [explanation, setExplanation] = useState<ExplainFileResponse | null>(
    null,
  )
  const [explaining, setExplaining] = useState(false)

  const storyReady = fullGraph !== null

  const pulsedPaths = useMemo(() => {
    const commit = commits[scrubIndex]
    if (!commit) {
      return new Set<string>()
    }
    return new Set<string>(commit.filesChanged)
  }, [commits, scrubIndex])

  const resetSessionFields = useCallback(() => {
    setFullGraph(null)
    setCommits([])
    setScrubIndex(0)
    setChapter('overview')
    setShowAdvancedMap(false)
    setNeighborhood(null)
    setExplanation(null)
    setCanonicalUrl(null)
    setRepositoryId(null)
    setMode(null)
  }, [])

  const goHome = useCallback(() => {
    resetSessionFields()
    setStatus(null)
    setLoading(false)
    setUrl('')
    onPastReposHide?.()
  }, [onPastReposHide, resetSessionFields])

  const runIngest = useCallback(
    async (repoUrl: string) => {
      const trimmed = repoUrl.trim()
      if (!trimmed) {
        return
      }
      setUrl(trimmed)
      setLoading(true)
      setStatus(null)
      onPastReposHide?.()
      resetSessionFields()
      try {
        const analyzed = await analyzeRepository(trimmed)
        setRepositoryId(analyzed.repositoryId)
        setMode(analyzed.mode)
        const [graphResponse, timelineResponse] = await Promise.all([
          fetchGraph(analyzed.repositoryId),
          fetchTimeline(analyzed.repositoryId),
        ])
        setFullGraph(graphResponse)
        setCommits(timelineResponse.commits)
        setScrubIndex(0)
        setCanonicalUrl(trimmed)
        onRepoRemembered?.(trimmed)
        if (graphResponse.nodes.length === 0) {
          setStatus({
            tone: 'info',
            title: 'Story opened, but the map is empty',
            detail:
              'We cloned the repo, yet no allowlisted source files landed in the graph.',
          })
        }
      } catch (error) {
        setStatus(friendlyError(error))
      } finally {
        setLoading(false)
      }
    },
    [onPastReposHide, onRepoRemembered, resetSessionFields],
  )

  const openFileInsight = useCallback(
    async (path: string) => {
      if (!repositoryId) {
        return
      }
      setExplanation(null)
      setStatus(null)
      try {
        const result = await fetchNeighborhood(repositoryId, path)
        setNeighborhood(result)
        setExplaining(true)
        try {
          const explained = await explainFile(repositoryId, path)
          setExplanation(explained)
        } catch (error) {
          setStatus({
            tone: 'info',
            title: 'Relations are ready; meaning stalled',
            detail:
              error instanceof Error
                ? error.message
                : 'You can still explore used-by and depends-on.',
          })
        } finally {
          setExplaining(false)
        }
      } catch (error) {
        setStatus(friendlyError(error))
      }
    },
    [repositoryId],
  )

  const askExplain = useCallback(async () => {
    if (!repositoryId || !neighborhood) {
      return
    }
    setExplaining(true)
    setStatus(null)
    try {
      const result = await explainFile(repositoryId, neighborhood.path)
      setExplanation(result)
    } catch (error) {
      setStatus(friendlyError(error))
    } finally {
      setExplaining(false)
    }
  }, [neighborhood, repositoryId])

  const closeFocus = useCallback(() => {
    setNeighborhood(null)
    setExplanation(null)
  }, [])

  const changeScrubIndex = useCallback(
    (index: number) => {
      setScrubIndex(index)
      if (!neighborhood) {
        setChapter('history')
      }
    },
    [neighborhood],
  )

  const toggleAdvancedMap = useCallback(() => {
    setShowAdvancedMap((value) => !value)
  }, [])

  return {
    url,
    setUrl,
    status,
    setStatus,
    loading,
    repositoryId,
    mode,
    canonicalUrl,
    fullGraph,
    commits,
    scrubIndex,
    chapter,
    setChapter,
    showAdvancedMap,
    neighborhood,
    explanation,
    explaining,
    storyReady,
    pulsedPaths,
    goHome,
    runIngest,
    openFileInsight,
    askExplain,
    closeFocus,
    changeScrubIndex,
    toggleAdvancedMap,
  }
}
