import { useMemo, useState } from 'react'
import type {
  GraphEdge,
  GraphNode,
  TimelineCommit,
  TreeResponse,
} from '../../types'
import { buildRepoExplanation } from '../../utils/repoExplain'
import type { StoryChapter } from '../../utils/story'

type OverviewExplainProps = {
  nodes: GraphNode[]
  edges: GraphEdge[]
  commits: TimelineCommit[]
  tree: TreeResponse | null
  mode: string | null
  canonicalUrl: string | null
  onSelectFile: (path: string) => void
  onChapterChange: (chapter: StoryChapter) => void
}

export function OverviewExplain({
  nodes,
  edges,
  commits,
  tree,
  mode,
  canonicalUrl,
  onSelectFile,
  onChapterChange,
}: OverviewExplainProps) {
  const explanation = useMemo(
    () =>
      buildRepoExplanation({
        nodes,
        edges,
        commits,
        tree,
        mode,
        canonicalUrl,
      }),
    [nodes, edges, commits, tree, mode, canonicalUrl],
  )

  const [touring, setTouring] = useState(false)
  const [tourIndex, setTourIndex] = useState(0)

  const stop = explanation.tour[tourIndex] ?? null
  const tourCount = explanation.tour.length

  function startTour() {
    if (tourCount === 0) {
      return
    }
    setTouring(true)
    setTourIndex(0)
  }

  function endTour() {
    setTouring(false)
    setTourIndex(0)
  }

  function goTour(delta: number) {
    setTourIndex((current) => {
      const next = current + delta
      if (next < 0) {
        return 0
      }
      if (next >= tourCount) {
        setTouring(false)
        return 0
      }
      return next
    })
  }

  return (
    <div className="overview-explain" data-animate="item">
      <div className="overview-stats-row">
        <article className="stat-card">
          <span className="stat-value">{explanation.stats.files}</span>
          <span className="stat-label">Files in the map</span>
        </article>
        <article className="stat-card">
          <span className="stat-value">{explanation.stats.links}</span>
          <span className="stat-label">Import links</span>
        </article>
        <article className="stat-card">
          <span className="stat-value">{explanation.stats.commits}</span>
          <span className="stat-label">Commits tracked</span>
        </article>
      </div>

      <article className="repo-brief" aria-label="Repository brief">
        <p className="brief-kicker">Repo brief</p>
        <h3 className="brief-title">What you’re looking at</h3>
        <div className="brief-body">
          {explanation.sentences.map((sentence) => (
            <p key={sentence.id}>{sentence.text}</p>
          ))}
        </div>

        {explanation.readFirst.length > 0 && (
          <div className="read-first">
            <p className="brief-section-label">Read these first</p>
            <ul className="read-first-list">
              {explanation.readFirst.map((file) => (
                <li key={file.path}>
                  <button
                    type="button"
                    className="read-first-card"
                    onClick={() => onSelectFile(file.path)}
                  >
                    <span className="read-first-name">{file.name}</span>
                    <span className="read-first-why">{file.why}</span>
                    <span className="read-first-path">{file.path}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </article>

      <article className="repo-flow" aria-label="Typical path">
        <p className="brief-section-label">Typical path</p>
        <p className="flow-blurb">{explanation.flowBlurb}</p>
        {explanation.flow.length > 0 && (
          <ol className="flow-steps">
            {explanation.flow.map((step, index) => (
              <li key={step.path}>
                {index > 0 && (
                  <span className="flow-arrow" aria-hidden>
                    →
                  </span>
                )}
                <button
                  type="button"
                  className="flow-step"
                  onClick={() => onSelectFile(step.path)}
                >
                  {step.name}
                </button>
              </li>
            ))}
          </ol>
        )}
      </article>

      <article className="repo-tour" aria-label="Guided tour">
        <div className="tour-header">
          <div>
            <p className="brief-section-label">Guided tour</p>
            <p className="tour-lead">
              {tourCount > 0
                ? `${tourCount} stops from entry to hub to recent change — one sentence each.`
                : 'Not enough structure for a tour yet.'}
            </p>
          </div>
          {!touring && tourCount > 0 && (
            <button type="button" onClick={startTour}>
              Start tour
            </button>
          )}
          {touring && (
            <button type="button" className="ghost" onClick={endTour}>
              End tour
            </button>
          )}
        </div>

        {touring && stop && (
          <div className="tour-stop" role="status">
            <p className="tour-progress">
              Stop {tourIndex + 1} of {tourCount}
            </p>
            <h4 className="tour-stop-title">{stop.title}</h4>
            <p className="tour-stop-blurb">{stop.blurb}</p>
            <p className="tour-stop-path">
              <code>{stop.path}</code>
            </p>
            <div className="tour-actions">
              <button type="button" onClick={() => onSelectFile(stop.path)}>
                Open this file
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => onChapterChange(stop.chapterHint)}
              >
                See in {stop.chapterHint}
              </button>
              <button
                type="button"
                className="ghost"
                disabled={tourIndex === 0}
                onClick={() => goTour(-1)}
              >
                Back
              </button>
              <button type="button" className="ghost" onClick={() => goTour(1)}>
                {tourIndex >= tourCount - 1 ? 'Finish' : 'Next stop'}
              </button>
            </div>
          </div>
        )}

        {!touring && tourCount > 0 && (
          <ol className="tour-preview">
            {explanation.tour.map((item, index) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="tour-preview-item"
                  onClick={() => {
                    setTouring(true)
                    setTourIndex(index)
                  }}
                >
                  <span className="tour-preview-num">{index + 1}</span>
                  <span>
                    <strong>{item.title}</strong>
                    <span className="muted-line">{item.path}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </article>

      <div className="chapter-jump overview-jump">
        <button type="button" onClick={() => onChapterChange('spine')}>
          Meet the spine
        </button>
        <button
          type="button"
          className="ghost"
          onClick={() => onChapterChange('playground')}
        >
          Open playground
        </button>
      </div>
    </div>
  )
}
