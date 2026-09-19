import type { RefObject } from 'react'
import type {
  ExplainFileResponse,
  FileNeighborhood,
  GraphResponse,
  RepositoryMode,
  TimelineCommit,
  TreeResponse,
} from '../../types'
import type { AppStatus } from '../../utils/status'
import type { StoryChapter } from '../../utils/story'
import { RepoStory } from '../story/RepoStory'
import { StoryEmpty } from '../story/StoryStates'
import { StatusBanner } from './StatusBanner'
import { TopRail } from './TopRail'

type LiveWorkspaceProps = {
  stageRef: RefObject<HTMLDivElement | null>
  status: AppStatus
  mode: RepositoryMode | null
  canonicalUrl: string | null
  fullGraph: GraphResponse | null
  tree: TreeResponse | null
  commits: TimelineCommit[]
  chapter: StoryChapter
  scrubIndex: number
  playing: boolean
  neighborhood: FileNeighborhood | null
  explanation: ExplainFileResponse | null
  explaining: boolean
  loading: boolean
  onDismissStatus: () => void
  onGoHome: () => void
  onPingApi: () => void
  onChapterChange: (chapter: StoryChapter) => void
  onSelectFile: (path: string) => void
  onAskExplain: () => void
  onCloseFocus: () => void
  onScrubIndexChange: (index: number) => void
  onTogglePlayback: () => void
  onReplayGrowth: () => void
  onRetry: () => void
}

export function LiveWorkspace({
  stageRef,
  status,
  mode,
  canonicalUrl,
  fullGraph,
  tree,
  commits,
  chapter,
  scrubIndex,
  playing,
  neighborhood,
  explanation,
  explaining,
  loading,
  onDismissStatus,
  onGoHome,
  onPingApi,
  onChapterChange,
  onSelectFile,
  onAskExplain,
  onCloseFocus,
  onScrubIndexChange,
  onTogglePlayback,
  onReplayGrowth,
  onRetry,
}: LiveWorkspaceProps) {
  const hasStory = Boolean(fullGraph && fullGraph.nodes.length > 0)

  return (
    <div className="live-shell">
      <TopRail
        canonicalUrl={canonicalUrl}
        mode={mode}
        onGoHome={onGoHome}
        onPingApi={onPingApi}
      />

      <div className="rail-status">
        <StatusBanner status={status} onDismiss={onDismissStatus} />
      </div>

      {hasStory ? (
        <div className="story-primary" ref={stageRef}>
          <RepoStory
            nodes={fullGraph!.nodes}
            edges={fullGraph!.edges}
            commits={commits}
            mode={mode}
            canonicalUrl={canonicalUrl}
            chapter={chapter}
            onChapterChange={onChapterChange}
            scrubIndex={scrubIndex}
            playing={playing}
            loading={loading}
            tree={tree}
            neighborhood={neighborhood}
            explanation={explanation}
            explaining={explaining}
            onSelectFile={onSelectFile}
            onAskExplain={onAskExplain}
            onCloseFocus={onCloseFocus}
            onScrubIndexChange={onScrubIndexChange}
            onTogglePlayback={onTogglePlayback}
            onReplayGrowth={onReplayGrowth}
            onRetry={onRetry}
          />
        </div>
      ) : (
        <div className="story-primary story-primary-empty" ref={stageRef}>
          <StoryEmpty variant="blank-graph" />
        </div>
      )}
    </div>
  )
}
