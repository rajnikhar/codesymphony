import { useCallback, useState } from 'react'
import {
  clearPastRepos,
  loadPastRepos,
  rememberRepo,
  type PastRepo,
} from '../utils/repoHistory'

export function usePastRepos() {
  const [pastRepos, setPastRepos] = useState<PastRepo[]>(() => loadPastRepos())
  const [showPastRepos, setShowPastRepos] = useState(false)

  const togglePastRepos = useCallback(() => {
    setShowPastRepos((open) => !open)
  }, [])

  const hidePastRepos = useCallback(() => {
    setShowPastRepos(false)
  }, [])

  const remember = useCallback((url: string) => {
    setPastRepos(rememberRepo(url))
  }, [])

  const clear = useCallback(() => {
    clearPastRepos()
    setPastRepos([])
  }, [])

  return {
    pastRepos,
    showPastRepos,
    togglePastRepos,
    hidePastRepos,
    remember,
    clear,
  }
}
