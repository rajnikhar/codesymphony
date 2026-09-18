import type { FormEvent } from 'react'
import { LandingView } from './components/layout/LandingView'
import { LiveWorkspace } from './components/layout/LiveWorkspace'
import { useApiHealth } from './hooks/useApiHealth'
import { usePastRepos } from './hooks/usePastRepos'
import { useRepositoryStory } from './hooks/useRepositoryStory'
import { useStageReveal } from './hooks/useGsapScene'
import './App.css'

function App() {
  const past = usePastRepos()
  const { health, checkHealth } = useApiHealth()
  const story = useRepositoryStory({
    onRepoRemembered: past.remember,
    onPastReposHide: past.hidePastRepos,
  })
  const stageRef = useStageReveal(story.storyReady)

  async function handlePingApi() {
    story.setStatus(await checkHealth())
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    await story.runIngest(story.url)
  }

  return (
    <div className={story.storyReady ? 'app app-live' : 'app'}>
      {!story.storyReady ? (
        <LandingView
          health={health}
          url={story.url}
          loading={story.loading}
          status={story.status}
          pastRepos={past.pastRepos}
          showPastRepos={past.showPastRepos}
          onPingApi={() => void handlePingApi()}
          onUrlChange={story.setUrl}
          onSubmit={(event) => void handleSubmit(event)}
          onTogglePastRepos={past.togglePastRepos}
          onSelectPastRepo={(url) => void story.runIngest(url)}
          onClearPastRepos={past.clear}
          onDismissStatus={() => story.setStatus(null)}
        />
      ) : (
        <LiveWorkspace
          stageRef={stageRef}
          status={story.status}
          mode={story.mode}
          canonicalUrl={story.canonicalUrl}
          fullGraph={story.fullGraph!}
          commits={story.commits}
          chapter={story.chapter}
          scrubIndex={story.scrubIndex}
          neighborhood={story.neighborhood}
          explanation={story.explanation}
          explaining={story.explaining}
          showAdvancedMap={story.showAdvancedMap}
          pulsedPaths={story.pulsedPaths}
          loading={story.loading}
          onDismissStatus={() => story.setStatus(null)}
          onGoHome={story.goHome}
          onPingApi={() => void handlePingApi()}
          onChapterChange={story.setChapter}
          onSelectFile={(path) => void story.openFileInsight(path)}
          onAskExplain={() => void story.askExplain()}
          onCloseFocus={story.closeFocus}
          onScrubIndexChange={story.changeScrubIndex}
          onToggleAdvancedMap={story.toggleAdvancedMap}
        />
      )}
    </div>
  )
}

export default App
