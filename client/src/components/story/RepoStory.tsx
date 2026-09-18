import { useMemo } from 'react'
import type {
  ExplainFileResponse,
  FileNeighborhood,
  GraphEdge,
  GraphNode,
  RepositoryMode,
  TimelineCommit,
} from '../../types'
import { useSceneEnter } from '../../hooks/useGsapScene'
import {
  buildRepoStory,
  chapterCopy,
  type StoryChapter,
} from '../../utils/story'
import { FileStoryCinema } from './FileStoryCinema'
import { RiveSignature } from './RiveSignature'
import { WebGLDepthLazy } from './WebGLDepthLazy'

type RepoStoryProps = {
  nodes: GraphNode[]
  edges: GraphEdge[]
  commits: TimelineCommit[]
  mode: RepositoryMode | null
  canonicalUrl: string | null
  chapter: StoryChapter
  onChapterChange: (chapter: StoryChapter) => void
  scrubIndex: number
  neighborhood: FileNeighborhood | null
  explanation: ExplainFileResponse | null
  explaining: boolean
  onSelectFile: (path: string) => void
  onAskExplain: () => void
  onCloseFocus: () => void
}

const CHAPTERS: { id: StoryChapter; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'spine', label: 'Spine' },
  { id: 'links', label: 'Links' },
  { id: 'history', label: 'History' },
]

function shortName(path: string): string {
  return path.split('/').pop() ?? path
}

function roleLabel(role: string): string {
  switch (role) {
    case 'hub':
      return 'Hub'
    case 'entry':
      return 'Entry'
    case 'leaf':
      return 'Leaf'
    default:
      return 'Active'
  }
}

export function RepoStory({
  nodes,
  edges,
  commits,
  mode,
  canonicalUrl,
  chapter,
  onChapterChange,
  scrubIndex,
  neighborhood,
  explanation,
  explaining,
  onSelectFile,
  onAskExplain,
  onCloseFocus,
}: RepoStoryProps) {
  const story = useMemo(
    () => buildRepoStory(nodes, edges, commits),
    [nodes, edges, commits],
  )
  const copy = chapterCopy(chapter, mode)
  const activeCommit = commits[scrubIndex] ?? story.hotCommit
  const repoLabel = canonicalUrl
    ? canonicalUrl.replace(/^https?:\/\/(www\.)?github\.com\//, '')
    : 'this repository'

  const sceneRef = useSceneEnter(`chapter:${chapter}`)
  const scrubProgress =
    commits.length > 1 ? scrubIndex / (commits.length - 1) : 0

  if (neighborhood) {
    return (
      <section className="story-stage focus-stage" aria-label="File story">
        <WebGLDepthLazy chapter={chapter} focus scrubProgress={scrubProgress} />
        <RiveSignature chapter={chapter} focus />
        <div className="stage-inner">
          <FileStoryCinema
            neighborhood={neighborhood}
            explanation={explanation}
            explaining={explaining}
            onSelectFile={onSelectFile}
            onAskExplain={onAskExplain}
            onClose={onCloseFocus}
          />
        </div>
      </section>
    )
  }

  return (
    <section className="story-stage" aria-label="Repository story">
      <WebGLDepthLazy
        chapter={chapter}
        focus={false}
        scrubProgress={scrubProgress}
      />
      <RiveSignature chapter={chapter} focus={false} />
      <div className="stage-inner">
        <nav className="chapter-nav" aria-label="Story chapters">
          {CHAPTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={chapter === item.id ? 'chapter active' : 'chapter'}
              onClick={() => onChapterChange(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div
          key={chapter}
          ref={sceneRef}
          className="chapter-pane"
        >
          <div className="story-hero" data-animate="hero">
            <p className="story-kicker">Chapter</p>
            <h2 className="story-title">{copy.title}</h2>
            <p className="story-lead">{copy.body}</p>
          </div>

          {chapter === 'overview' && (
            <div className="overview-grid">
              <article className="stat-card" data-animate="item">
                <span className="stat-value">{story.fileNodes.length}</span>
                <span className="stat-label">Files in the map</span>
              </article>
              <article className="stat-card" data-animate="item">
                <span className="stat-value">{story.edgeCount}</span>
                <span className="stat-label">Import links</span>
              </article>
              <article className="stat-card" data-animate="item">
                <span className="stat-value">{commits.length}</span>
                <span className="stat-label">Commits tracked</span>
              </article>
              <article className="overview-copy" data-animate="item">
                <p>
                  You’re looking at <strong>{repoLabel}</strong>
                  {mode === 'HISTORY_ONLY'
                    ? ' in history-focused mode (hottest files sampled for your machine’s safety).'
                    : ' with a full import story.'}
                </p>
                <p className="muted-line">
                  Move through Spine → Links → History, or open a file from the
                  spine.
                </p>
                <div className="chapter-jump">
                  <button type="button" onClick={() => onChapterChange('spine')}>
                    Meet the spine
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => onChapterChange('history')}
                  >
                    Watch history
                  </button>
                </div>
              </article>
            </div>
          )}

          {chapter === 'spine' && (
            <ul className="spine-list">
              {story.spine.length === 0 ? (
                <li className="muted-line">No source files to rank yet.</li>
              ) : (
                story.spine.map((file) => (
                  <li key={file.path} className="spine-item" data-animate="item">
                    <button type="button" onClick={() => onSelectFile(file.path)}>
                      <span className={`role-pill role-${file.role}`}>
                        {roleLabel(file.role)}
                      </span>
                      <span className="spine-name">{file.name}</span>
                      <span className="spine-meta">
                        {file.inDegree} in · {file.outDegree} out ·{' '}
                        {file.commitCount} commits
                      </span>
                      <span className="spine-path">{file.path}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}

          {chapter === 'links' && (
            <ul className="link-list">
              {story.links.length === 0 ? (
                <li className="muted-line">
                  No import edges in allowlisted languages — try History, or a
                  repo with JS/TS/Python/Java.
                </li>
              ) : (
                story.links.map((link) => (
                  <li
                    key={`${link.from}->${link.to}`}
                    className="link-item"
                    data-animate="item"
                  >
                    <button type="button" onClick={() => onSelectFile(link.from)}>
                      <span className="link-from">{link.fromName}</span>
                    </button>
                    <span className="link-arrow" aria-hidden>
                      imports
                    </span>
                    <button type="button" onClick={() => onSelectFile(link.to)}>
                      <span className="link-to">{link.toName}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}

          {chapter === 'history' && (
            <div className="history-scene" data-animate="item">
              {activeCommit ? (
                <>
                  <p className="history-hash">
                    <code>{activeCommit.commitHash.slice(0, 8)}</code>
                    <span>
                      +{activeCommit.linesAdded} / −{activeCommit.linesDeleted}
                    </span>
                  </p>
                  <p className="history-time">{activeCommit.timestamp}</p>
                  <p className="muted-line">
                    Files touched in this beat — open one for its story.
                  </p>
                  <div className="history-files">
                    {activeCommit.filesChanged.slice(0, 16).map((path) => (
                      <button
                        key={path}
                        type="button"
                        className="scene-chip pulse-chip"
                        onClick={() => onSelectFile(path)}
                      >
                        {shortName(path)}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <p className="muted-line">No commits loaded yet.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
