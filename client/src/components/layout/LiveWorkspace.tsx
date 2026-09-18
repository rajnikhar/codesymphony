import type { RefObject } from 'react'
import type {
  ExplainFileResponse,
  FileNeighborhood,
  GraphResponse,
  RepositoryMode,
  TimelineCommit,
} from '../../types'
import type { AppStatus } from '../../utils/status'
import type { StoryChapter } from '../../utils/story'
import { TimelineScrubber } from '../timeline/TimelineScrubber'
import { RepoStory } from '../story/RepoStory'
import { StoryEmpty } from '../story/StoryStates'
import { AdvancedMapPanel } from './AdvancedMapPanel'
import { StatusBanner } from './StatusBanner'
import { TopRail } from './TopRail'

type LiveWorkspaceProps = {
  stageRef: RefObject<HTMLDivElement | null>
  status: AppStatus
  mode: RepositoryMode | null
  canonicalUrl: string | null
  fullGraph: GraphResponse
  commits: TimelineCommit[]
  chapter: StoryChapter
  scrubIndex: number
  neighborhood: FileNeighborhood | null
  explanation: ExplainFileResponse | null
  explaining: boolean
  showAdvancedMap: boolean
  pulsedPaths: Set<string>
  loading: boolean
  onDismissStatus: () => void
  onGoHome: () => void
  onPingApi: () => void
  onChapterChange: (chapter: StoryChapter) => void
  onSelectFile: (path: string) => void
  onAskExplain: () => void
  onCloseFocus: () => void
  onScrubIndexChange: (index: number) => void
  onToggleAdvancedMap: () => void
}

export function LiveWorkspace({
  stageRef,
  status,
  mode,
  canonicalUrl,
  fullGraph,
  commits,
  chapter,
  scrubIndex,
  neighborhood,
  explanation,
  explaining,
  showAdvancedMap,
  pulsedPaths,
  loading,
  onDismissStatus,
  onGoHome,
  onPingApi,
  onChapterChange,
  onSelectFile,
  onAskExplain,
  onCloseFocus,
  onScrubIndexChange,
  onToggleAdvancedMap,
}: LiveWorkspaceProps) {
  const mapNodes = neighborhood
    ? neighborhood.focusGraph.nodes
    : fullGraph.nodes
  const mapEdges = neighborhood
    ? neighborhood.focusGraph.edges
    : fullGraph.edges

  return (
    <>
      <TopRail
        canonicalUrl={canonicalUrl}
        mode={mode}
        onGoHome={onGoHome}
        onPingApi={onPingApi}
      />

      <div className="rail-status">
        <StatusBanner status={status} onDismiss={onDismissStatus} />
      </div>

      <div className="stage-bleed" ref={stageRef}>
        {fullGraph.nodes.length === 0 ? (
          <div className="stage-inner">
            <StoryEmpty variant="blank-graph" />
          </div>
        ) : (
          <RepoStory
            nodes={fullGraph.nodes}
            edges={fullGraph.edges}
            commits={commits}
            mode={mode}
            canonicalUrl={canonicalUrl}
            chapter={chapter}
            onChapterChange={onChapterChange}
            scrubIndex={scrubIndex}
            neighborhood={neighborhood}
            explanation={explanation}
            explaining={explaining}
            onSelectFile={onSelectFile}
            onAskExplain={onAskExplain}
            onCloseFocus={onCloseFocus}
          />
        )}
      </div>

      <div className="below-stage">
        <TimelineScrubber
          commits={commits}
          index={scrubIndex}
          onIndexChange={onScrubIndexChange}
          disabled={loading}
        />

        <div className="advanced-toggle">
          <button type="button" className="ghost" onClick={onToggleAdvancedMap}>
            {showAdvancedMap ? 'Hide advanced map' : 'Show advanced map'}
          </button>
          <span className="muted-line advanced-hint">
            Optional raw dependency layout.
          </span>
        </div>

        {showAdvancedMap && (
          <AdvancedMapPanel
            nodes={mapNodes}
            edges={mapEdges}
            pulsedPaths={pulsedPaths}
            selectedPath={neighborhood?.path ?? null}
            onFileClick={onSelectFile}
          />
        )}
      </div>
    </>
  )
}
