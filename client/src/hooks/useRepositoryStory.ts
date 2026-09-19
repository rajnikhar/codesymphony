import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  analyzeRepository,
  explainFile,
  fetchGraph,
  fetchNeighborhood,
  fetchTimeline,
  fetchTree,
} from '../services/repositoryApi'
import type {
  ExplainFileResponse,
  FileNeighborhood,
  GraphResponse,
  RepositoryMode,
  TimelineCommit,
  TreeResponse,
} from '../types'
import type { StoryChapter } from '../utils/story'
import { friendlyError, type AppStatus } from '../utils/status'

type UseRepositoryStoryOptions = {
  onRepoRemembered?: (url: string) => void
  onPastReposHide?: () => void
}

/** Target frames for a full growth replay — keeps large repos watchable. */
const GROWTH_FRAMES = 72
const PLAY_TICK_MS = 220

export function useRepositoryStory(options: UseRepositoryStoryOptions = {}) {
  const { onRepoRemembered, onPastReposHide } = options

  const [url, setUrl] = useState('')
  const [status, setStatus] = useState<AppStatus>(null)
  const [loading, setLoading] = useState(false)
  const [repositoryId, setRepositoryId] = useState<string | null>(null)
  const [mode, setMode] = useState<RepositoryMode | null>(null)
  const [canonicalUrl, setCanonicalUrl] = useState<string | null>(null)
  const [fullGraph, setFullGraph] = useState<GraphResponse | null>(null)
  const [tree, setTree] = useState<TreeResponse | null>(null)
  const [commits, setCommits] = useState<TimelineCommit[]>([])
  const [scrubIndex, setScrubIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [chapter, setChapter] = useState<StoryChapter>('overview')
  const [neighborhood, setNeighborhood] = useState<FileNeighborhood | null>(
    null,
  )
  const [explanation, setExplanation] = useState<ExplainFileResponse | null>(
    null,
  )
  const [explaining, setExplaining] = useState(false)

  const storyReady = fullGraph !== null || tree !== null

  const pulsedPaths = useMemo(() => {
    const commit = commits[scrubIndex]
    if (!commit) {
      return new Set<string>()
    }
    return new Set<string>(commit.filesChanged)
  }, [commits, scrubIndex])

  const growthStep = useMemo(() => {
    if (commits.length <= 1) {
      return 1
    }
    return Math.max(1, Math.ceil(commits.length / GROWTH_FRAMES))
  }, [commits.length])

  const resetSessionFields = useCallback(() => {
    setFullGraph(null)
    setTree(null)
    setCommits([])
    setScrubIndex(0)
    setPlaying(false)
    setChapter('overview')
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
        const [graphResponse, timelineResponse, treeResult] = await Promise.all([
          fetchGraph(analyzed.repositoryId),
          fetchTimeline(analyzed.repositoryId),
          fetchTree(analyzed.repositoryId).catch(() => null),
        ])
        setFullGraph(graphResponse)
        setTree(treeResult)
        setCommits(timelineResponse.commits)
        const lastIndex = Math.max(0, timelineResponse.commits.length - 1)
        setScrubIndex(lastIndex)
        setCanonicalUrl(trimmed)
        onRepoRemembered?.(trimmed)
        if (timelineResponse.commits.length === 0) {
          setStatus({
            tone: 'error',
            title: 'No commit history available',
            detail:
              'This clone returned zero commits — the tree can’t grow without history.',
          })
        } else if (!treeResult) {
          setStatus({
            tone: 'info',
            title: 'Tree endpoint isn’t available yet',
            detail:
              'Restart Spring Boot on :8090 to enable the playground tree.',
          })
        } else if (treeResult.mode === 'no_structure_detected' || !treeResult.trunk) {
          setStatus({
            tone: 'info',
            title: 'Not enough import structure for a tree',
            detail:
              'Story chapters still work — the playground will show activity only.',
          })
        } else if (graphResponse.nodes.length === 0) {
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

  const changeScrubIndex = useCallback((index: number) => {
    setPlaying(false)
    setScrubIndex(index)
  }, [])

  const togglePlayback = useCallback(() => {
    setPlaying((wasPlaying) => {
      if (wasPlaying) {
        return false
      }
      setScrubIndex((current) =>
        commits.length === 0 || current >= commits.length - 1 ? 0 : current,
      )
      return true
    })
  }, [commits.length])

  const replayGrowth = useCallback(() => {
    if (commits.length === 0) {
      return
    }
    setChapter('playground')
    setScrubIndex(0)
    setPlaying(true)
  }, [commits.length])

  const changeChapter = useCallback((next: StoryChapter) => {
    setChapter(next)
    if (next !== 'playground') {
      setPlaying(false)
    }
  }, [])

  useEffect(() => {
    if (!playing || commits.length === 0) {
      return
    }
    const last = commits.length - 1
    const timer = window.setInterval(() => {
      setScrubIndex((current) => {
        if (current >= last) {
          window.setTimeout(() => setPlaying(false), 0)
          return last
        }
        return Math.min(last, current + growthStep)
      })
    }, PLAY_TICK_MS)
    return () => {
      window.clearInterval(timer)
    }
  }, [playing, commits.length, growthStep])

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
    tree,
    commits,
    scrubIndex,
    playing,
    chapter,
    setChapter: changeChapter,
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
    togglePlayback,
    replayGrowth,
  }
}
