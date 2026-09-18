import type { TimelineCommit } from '../../types'

type TimelineScrubberProps = {
  commits: TimelineCommit[]
  index: number
  onIndexChange: (index: number) => void
  disabled?: boolean
}

export function TimelineScrubber({
  commits,
  index,
  onIndexChange,
  disabled = false,
}: TimelineScrubberProps) {
  const current = commits[index]
  const max = Math.max(commits.length - 1, 0)

  return (
    <section className="timeline" aria-label="Commit timeline">
      <div className="timeline-header">
        <div>
          <label htmlFor="scrub">History soundtrack</label>
          <p className="timeline-help">
            Drag to move through commits. The History chapter lists files from
            each beat — open one for its story.
          </p>
        </div>
        <span className="timeline-meta">
          {commits.length === 0
            ? 'No commits yet'
            : `Commit ${index + 1} of ${commits.length}`}
        </span>
      </div>
      <input
        id="scrub"
        type="range"
        min={0}
        max={max}
        value={Math.min(index, max)}
        disabled={disabled || commits.length === 0}
        onChange={(event) => onIndexChange(Number(event.target.value))}
      />
      {current && (
        <div className="commit-card">
          <div>
            <span className="commit-label">Hash</span>
            <code>{current.commitHash.slice(0, 10)}</code>
          </div>
          <div>
            <span className="commit-label">When</span>
            <span>{new Date(current.timestamp).toLocaleString()}</span>
          </div>
          <div>
            <span className="commit-label">Diff</span>
            <span>
              +{current.linesAdded} / −{current.linesDeleted}
            </span>
          </div>
          <div>
            <span className="commit-label">Files touched</span>
            <span>{current.filesChanged.length}</span>
          </div>
        </div>
      )}
    </section>
  )
}
