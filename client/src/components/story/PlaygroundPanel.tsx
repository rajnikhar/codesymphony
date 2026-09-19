import { useEffect, useMemo, useState } from 'react'
import type {
  GraphEdge,
  GraphNode,
  TimelineCommit,
  TreeBranch,
  TreeResponse,
} from '../../types'
import {
  buildPlaygroundQuests,
  flattenTreeFiles,
  neighborsOf,
  shortFileName,
  type PlaygroundMode,
} from '../../utils/playgroundLearn'
import { buildRepoExplanation } from '../../utils/repoExplain'
import { TimelineScrubber } from '../timeline/TimelineScrubber'
import { GrowingTree } from './GrowingTree'
import { TreeCloneError, TreeNoStructure } from './TreeStates'

type PlaygroundPanelProps = {
  tree: TreeResponse | null
  nodes: GraphNode[]
  edges: GraphEdge[]
  commits: TimelineCommit[]
  mode: string | null
  canonicalUrl: string | null
  scrubIndex: number
  playing: boolean
  loading: boolean
  onScrubIndexChange: (index: number) => void
  onTogglePlayback: () => void
  onReplayGrowth: () => void
  onOpenFileStory: (path: string) => void
  onRetry: () => void
}

type InspectKind = 'file' | 'folder' | null

function findBranch(
  branches: TreeBranch[],
  directory: string,
): TreeBranch | null {
  for (const branch of branches) {
    if (branch.directory === directory) {
      return branch
    }
    const nested = findBranch(branch.subBranches, directory)
    if (nested) {
      return nested
    }
  }
  return null
}

function folderRoleGuess(directory: string): string {
  const lower = directory.toLowerCase()
  if (/(test|spec|__tests__)/.test(lower)) {
    return 'tests'
  }
  if (/(api|http|client|request)/.test(lower)) {
    return 'I/O / client'
  }
  if (/(util|helper|compat|common)/.test(lower)) {
    return 'shared utilities'
  }
  if (/(model|schema|type)/.test(lower)) {
    return 'data / models'
  }
  if (/(auth|security)/.test(lower)) {
    return 'auth'
  }
  return 'feature cluster'
}

export function PlaygroundPanel({
  tree,
  nodes,
  edges,
  commits,
  mode: repoMode,
  canonicalUrl,
  scrubIndex,
  playing,
  loading,
  onScrubIndexChange,
  onTogglePlayback,
  onReplayGrowth,
  onOpenFileStory,
  onRetry,
}: PlaygroundPanelProps) {
  const [mode, setMode] = useState<PlaygroundMode>('map')
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [selectedDirectory, setSelectedDirectory] = useState<string | null>(null)
  const [inspectKind, setInspectKind] = useState<InspectKind>(null)
  const [hoverPath, setHoverPath] = useState<string | null>(null)
  const [tourIndex, setTourIndex] = useState(0)
  const [pathIndex, setPathIndex] = useState(0)
  const [questIndex, setQuestIndex] = useState(0)
  const [questDone, setQuestDone] = useState<Record<string, boolean>>({})
  const [questFeedback, setQuestFeedback] = useState<string | null>(null)
  const [legendPulse, setLegendPulse] = useState<'indegree' | 'churn' | null>(
    null,
  )

  const explanation = useMemo(
    () =>
      buildRepoExplanation({
        nodes,
        edges,
        commits,
        tree,
        mode: repoMode,
        canonicalUrl,
      }),
    [nodes, edges, commits, tree, repoMode, canonicalUrl],
  )

  const files = useMemo(() => (tree ? flattenTreeFiles(tree) : []), [tree])
  const quests = useMemo(() => (tree ? buildPlaygroundQuests(tree) : []), [tree])
  const activeQuest = mode === 'map' ? (quests[questIndex] ?? null) : null

  const tourStop = explanation.tour[tourIndex] ?? null
  const flow = explanation.flow
  const pathStep = flow[pathIndex] ?? null

  const selectedFile = useMemo(
    () => files.find((file) => file.path === selectedPath) ?? null,
    [files, selectedPath],
  )

  const selectedBranch = useMemo(() => {
    if (!tree || !selectedDirectory) {
      return null
    }
    return findBranch(tree.branches, selectedDirectory)
  }, [tree, selectedDirectory])

  const selectedNeighbors = useMemo(() => {
    if (!selectedPath) {
      return { dependsOn: [] as string[], usedBy: [] as string[] }
    }
    return neighborsOf(selectedPath, edges)
  }, [selectedPath, edges])

  const highlightPaths = useMemo(() => {
    if (mode === 'tour' && tourStop) {
      return new Set([tourStop.path])
    }
    if (mode === 'path' && flow.length > 0) {
      return new Set(flow.slice(0, pathIndex + 1).map((step) => step.path))
    }
    if (selectedDirectory && selectedBranch) {
      return new Set(selectedBranch.files.map((file) => file.path))
    }
    return null
  }, [mode, tourStop, flow, pathIndex, selectedDirectory, selectedBranch])

  const pathChain = useMemo(() => {
    if (mode !== 'path' || flow.length === 0) {
      return [] as string[]
    }
    return flow.slice(0, Math.max(1, pathIndex + 1)).map((step) => step.path)
  }, [mode, flow, pathIndex])

  const focusPath = useMemo(() => {
    if (mode === 'tour' && tourStop) {
      return tourStop.path
    }
    if (mode === 'path' && pathStep) {
      return pathStep.path
    }
    return hoverPath ?? selectedPath
  }, [mode, tourStop, pathStep, hoverPath, selectedPath])

  const mapScrubIndex =
    mode === 'grow' && tree
      ? scrubIndex
      : tree
        ? Math.max(0, tree.totalCommits - 1)
        : 0

  const growthProgress =
    commits.length > 1
      ? Math.round((scrubIndex / (commits.length - 1)) * 100)
      : 100

  const purposeLine =
    explanation.sentences.find((s) => s.id === 'who')?.text ??
    explanation.sentences[0]?.text ??
    ''

  useEffect(() => {
    if (!legendPulse) {
      return
    }
    const timer = window.setTimeout(() => setLegendPulse(null), 1600)
    return () => window.clearTimeout(timer)
  }, [legendPulse])

  useEffect(() => {
    if (mode === 'tour' && tourStop) {
      setSelectedPath(tourStop.path)
      setSelectedDirectory(null)
      setInspectKind('file')
    }
  }, [mode, tourStop])

  useEffect(() => {
    if (mode === 'path' && pathStep) {
      setSelectedPath(pathStep.path)
      setSelectedDirectory(null)
      setInspectKind('file')
    }
  }, [mode, pathStep])

  const recentPaths = (() => {
    const paths = new Set<string>()
    for (let i = commits.length - 1; i >= 0 && paths.size < 12; i--) {
      for (const path of commits[i]?.filesChanged ?? []) {
        paths.add(path)
        if (paths.size >= 12) {
          break
        }
      }
    }
    return [...paths]
  })()

  function switchMode(next: PlaygroundMode) {
    setMode(next)
    setQuestFeedback(null)
    if (next === 'tour') {
      setTourIndex(0)
    }
    if (next === 'path') {
      setPathIndex(0)
    }
    if (next === 'map') {
      setSelectedDirectory(null)
    }
  }

  function handleSelect(path: string) {
    setSelectedPath(path)
    setSelectedDirectory(null)
    setInspectKind('file')
    setQuestFeedback(null)
    if (activeQuest && !questDone[activeQuest.id]) {
      if (activeQuest.acceptPaths.includes(path)) {
        setQuestDone((prev) => ({ ...prev, [activeQuest.id]: true }))
        setQuestFeedback(activeQuest.success)
      } else {
        setQuestFeedback('Not that one — try again, or peek at the hint.')
      }
    }
  }

  function handleSelectBranch(directory: string) {
    setSelectedDirectory(directory)
    setSelectedPath(null)
    setInspectKind('folder')
    if (mode === 'tour' || mode === 'path') {
      setMode('map')
    }
  }

  if (!tree) {
    return (
      <div className="playground-panel playground-panel-empty" data-animate="item">
        <p className="muted-line">
          Tree data isn’t available yet. Restart Spring Boot on :8090, then
          reload this repo.
        </p>
      </div>
    )
  }

  if (commits.length === 0) {
    return (
      <TreeCloneError
        message="Couldn't read commit history for that repository."
        onRetry={onRetry}
      />
    )
  }

  if (tree.mode === 'no_structure_detected' || !tree.trunk) {
    return <TreeNoStructure tree={tree} recentPaths={recentPaths} />
  }

  return (
    <div className="playground-panel" data-animate="item">
      <aside className="playground-brief-strip" aria-label="Repo brief">
        <p className="brief-strip-purpose">{purposeLine}</p>
        {explanation.readFirst.length > 0 && (
          <div className="brief-strip-row">
            <span className="brief-strip-label">Read first</span>
            <div className="brief-strip-chips">
              {explanation.readFirst.map((file) => (
                <button
                  key={file.path}
                  type="button"
                  className="scene-chip"
                  onClick={() => handleSelect(file.path)}
                  title={file.why}
                >
                  {file.name}
                </button>
              ))}
            </div>
          </div>
        )}
        {flow.length > 0 && (
          <div className="brief-strip-row">
            <span className="brief-strip-label">Typical path</span>
            <ol className="brief-strip-flow">
              {flow.map((step, index) => (
                <li key={step.path}>
                  {index > 0 && <span className="flow-arrow">→</span>}
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => {
                      switchMode('path')
                      setPathIndex(index)
                    }}
                  >
                    {step.name}
                  </button>
                </li>
              ))}
            </ol>
          </div>
        )}
      </aside>

      <div className="playground-toolbar">
        <div className="playground-modes" role="tablist" aria-label="Playground mode">
          {(
            [
              ['map', 'Map'],
              ['tour', 'Tour'],
              ['path', 'Follow path'],
              ['grow', 'Grow'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mode === id}
              className={mode === id ? 'playground-mode active' : 'playground-mode'}
              onClick={() => switchMode(id)}
              disabled={
                (id === 'tour' && explanation.tour.length === 0) ||
                (id === 'path' && flow.length === 0)
              }
            >
              {label}
            </button>
          ))}
        </div>

        <div className="playground-legend-teach">
          <button
            type="button"
            className="ghost legend-teach-btn"
            onClick={() => setLegendPulse('indegree')}
          >
            Size = importers
          </button>
          <button
            type="button"
            className="ghost legend-teach-btn"
            onClick={() => setLegendPulse('churn')}
          >
            Thickness = churn
          </button>
        </div>

        {mode === 'grow' && (
          <div className="tree-playback">
            <button type="button" className="ghost" onClick={onTogglePlayback}>
              {playing ? 'Pause' : 'Play growth'}
            </button>
            <button type="button" className="ghost" onClick={onReplayGrowth}>
              Replay from seed
            </button>
            <span className="playground-progress" aria-live="polite">
              {playing ? 'Growing' : 'Paused'} · {growthProgress}%
            </span>
          </div>
        )}
      </div>

      {mode === 'tour' && tourStop && (
        <div className="playground-guide" role="status">
          <p className="tour-progress">
            Tour stop {tourIndex + 1} of {explanation.tour.length}
          </p>
          <h4 className="tour-stop-title">{tourStop.title}</h4>
          <p className="tour-stop-blurb">{tourStop.blurb}</p>
          <div className="tour-actions">
            <button type="button" onClick={() => onOpenFileStory(tourStop.path)}>
              Open full story
            </button>
            <button
              type="button"
              className="ghost"
              disabled={tourIndex === 0}
              onClick={() => setTourIndex((i) => Math.max(0, i - 1))}
            >
              Back
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                if (tourIndex >= explanation.tour.length - 1) {
                  switchMode('map')
                } else {
                  setTourIndex((i) => i + 1)
                }
              }}
            >
              {tourIndex >= explanation.tour.length - 1 ? 'Finish' : 'Next stop'}
            </button>
          </div>
        </div>
      )}

      {mode === 'path' && pathStep && (
        <div className="playground-guide" role="status">
          <p className="tour-progress">
            Path step {pathIndex + 1} of {flow.length}
          </p>
          <h4 className="tour-stop-title">
            {pathIndex === 0
              ? 'Start here'
              : pathIndex === flow.length - 1
                ? 'Arrive at the hub'
                : 'Follow the import'}
          </h4>
          <p className="tour-stop-blurb">
            {pathIndex === 0
              ? `${pathStep.name} is where the typical path begins.`
              : pathIndex === flow.length - 1
                ? `${pathStep.name} is the structural center this path reaches.`
                : `${flow[pathIndex - 1]?.name ?? 'Previous'} imports toward ${pathStep.name} — one hop on the map.`}
          </p>
          <div className="tour-actions">
            <button type="button" onClick={() => onOpenFileStory(pathStep.path)}>
              Open this file
            </button>
            <button
              type="button"
              className="ghost"
              disabled={pathIndex === 0}
              onClick={() => setPathIndex((i) => Math.max(0, i - 1))}
            >
              Back
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                if (pathIndex >= flow.length - 1) {
                  switchMode('map')
                } else {
                  setPathIndex((i) => i + 1)
                }
              }}
            >
              {pathIndex >= flow.length - 1 ? 'Finish path' : 'Next hop'}
            </button>
          </div>
        </div>
      )}

      {mode === 'map' && activeQuest && (
        <div className="playground-quest" role="status">
          <div className="quest-head">
            <span className="quest-kicker">
              Quest {questIndex + 1} of {quests.length}
              {questDone[activeQuest.id] ? ' · done' : ''}
            </span>
            <div className="quest-nav">
              <button
                type="button"
                className="ghost"
                disabled={questIndex === 0}
                onClick={() => {
                  setQuestIndex((i) => Math.max(0, i - 1))
                  setQuestFeedback(null)
                }}
              >
                Prev
              </button>
              <button
                type="button"
                className="ghost"
                disabled={questIndex >= quests.length - 1}
                onClick={() => {
                  setQuestIndex((i) => Math.min(quests.length - 1, i + 1))
                  setQuestFeedback(null)
                }}
              >
                Next
              </button>
            </div>
          </div>
          <p className="quest-prompt">{activeQuest.prompt}</p>
          <p className="quest-hint">{activeQuest.hint}</p>
          {questFeedback && (
            <p
              className={
                questDone[activeQuest.id] ? 'quest-feedback ok' : 'quest-feedback'
              }
            >
              {questFeedback}
            </p>
          )}
        </div>
      )}

      <p className="playground-hint muted-line">
        Click a leaf to inspect a file · click a branch to open a folder chapter
      </p>

      <div className="playground-stage-inner">
        <GrowingTree
          tree={tree}
          scrubIndex={mapScrubIndex}
          edges={edges}
          selectedPath={selectedPath}
          focusPath={focusPath}
          highlightPaths={highlightPaths}
          pathChain={pathChain}
          selectedDirectory={selectedDirectory}
          legendPulse={legendPulse}
          showLabels={mode !== 'grow'}
          onSelectFile={handleSelect}
          onHoverFile={setHoverPath}
          onSelectBranch={handleSelectBranch}
        />

        <aside className="playground-inspect" aria-live="polite">
          {inspectKind === 'folder' && selectedBranch ? (
            <>
              <p className="inspect-kicker">Folder</p>
              <h3 className="inspect-title">{selectedBranch.directory}/</h3>
              <ul className="inspect-facts">
                <li>
                  About <strong>{selectedBranch.fileCount}</strong> files in this
                  cluster
                </li>
                <li>
                  Role guess: <strong>{folderRoleGuess(selectedBranch.directory)}</strong>
                </li>
                <li>
                  Churn weight <strong>{selectedBranch.churn}</strong>
                </li>
              </ul>
              <p className="inspect-label">Top files here</p>
              <div className="inspect-chips">
                {[...selectedBranch.files]
                  .sort((a, b) => b.inDegree - a.inDegree)
                  .slice(0, 5)
                  .map((file) => (
                    <button
                      key={file.path}
                      type="button"
                      className="scene-chip"
                      onClick={() => handleSelect(file.path)}
                    >
                      {shortFileName(file.path)}
                    </button>
                  ))}
              </div>
            </>
          ) : selectedFile ? (
            <>
              <p className="inspect-kicker">Inspect</p>
              <h3 className="inspect-title">{shortFileName(selectedFile.path)}</h3>
              <p className="inspect-path">{selectedFile.path}</p>
              <ul className="inspect-facts">
                <li>
                  <strong>{selectedFile.inDegree}</strong> files import this
                </li>
                <li>
                  Folder <code>{selectedFile.directory || 'root'}</code>
                </li>
                <li>First seen at commit {selectedFile.firstCommitIndex}</li>
              </ul>
              {selectedNeighbors.usedBy.length > 0 && (
                <div className="inspect-links">
                  <p className="inspect-label">Imported by</p>
                  <div className="inspect-chips">
                    {selectedNeighbors.usedBy.slice(0, 6).map((path) => (
                      <button
                        key={path}
                        type="button"
                        className="scene-chip"
                        onClick={() => handleSelect(path)}
                      >
                        {shortFileName(path)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {selectedNeighbors.dependsOn.length > 0 && (
                <div className="inspect-links">
                  <p className="inspect-label">This imports</p>
                  <div className="inspect-chips">
                    {selectedNeighbors.dependsOn.slice(0, 6).map((path) => (
                      <button
                        key={path}
                        type="button"
                        className="scene-chip"
                        onClick={() => handleSelect(path)}
                      >
                        {shortFileName(path)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <button
                type="button"
                className="inspect-open"
                onClick={() => onOpenFileStory(selectedFile.path)}
              >
                Open full story
              </button>
            </>
          ) : (
            <>
              <p className="inspect-kicker">Learn</p>
              <h3 className="inspect-title">Pick a mode</h3>
              <p className="muted-line">
                Tour walks the whole-repo stops on the tree. Follow path pulses
                entry → hub. Map is free explore + quests.
              </p>
            </>
          )}
        </aside>
      </div>

      {mode === 'grow' && (
        <div className="playground-timeline">
          <TimelineScrubber
            commits={commits}
            index={scrubIndex}
            onIndexChange={onScrubIndexChange}
            disabled={loading}
          />
        </div>
      )}
    </div>
  )
}
