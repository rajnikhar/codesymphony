import type { FormEvent } from 'react'
import type { AppStatus } from '../../utils/status'
import type { PastRepo } from '../../utils/repoHistory'
import { GuideSteps } from './GuideSteps'
import { LandingBrandBar } from './LandingBrandBar'
import { RepositoryInput } from './RepositoryInput'
import { StatusBanner } from './StatusBanner'
import { StoryEmpty, StoryLoading } from '../story/StoryStates'

type LandingViewProps = {
  health: string
  url: string
  loading: boolean
  status: AppStatus
  pastRepos: PastRepo[]
  showPastRepos: boolean
  onPingApi: () => void
  onUrlChange: (url: string) => void
  onSubmit: (event: FormEvent) => void
  onTogglePastRepos: () => void
  onSelectPastRepo: (url: string) => void
  onClearPastRepos: () => void
  onDismissStatus: () => void
}

export function LandingView({
  health,
  url,
  loading,
  status,
  pastRepos,
  showPastRepos,
  onPingApi,
  onUrlChange,
  onSubmit,
  onTogglePastRepos,
  onSelectPastRepo,
  onClearPastRepos,
  onDismissStatus,
}: LandingViewProps) {
  return (
    <>
      <LandingBrandBar health={health} onPingApi={onPingApi} />

      <header className="header landing-hero">
        <div>
          <h1>A guided story of how code fits together</h1>
          <p className="tagline">
            Light, paced chapters and plain-English explanations. The raw map
            stays optional.
          </p>
        </div>
      </header>

      {!loading && (
        <GuideSteps
          hasRepo={false}
          hasSelection={false}
          hasExplanation={false}
        />
      )}

      <main className="main landing-main">
        <RepositoryInput
          url={url}
          loading={loading}
          pastRepos={pastRepos}
          showPastRepos={showPastRepos}
          onUrlChange={onUrlChange}
          onSubmit={onSubmit}
          onTogglePastRepos={onTogglePastRepos}
          onSelectPastRepo={onSelectPastRepo}
          onClearPastRepos={onClearPastRepos}
        />
        <StatusBanner status={status} onDismiss={onDismissStatus} />
        {loading ? <StoryLoading url={url.trim()} /> : <StoryEmpty />}
      </main>
    </>
  )
}
