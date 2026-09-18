import type { FormEvent } from 'react'
import type { PastRepo } from '../../utils/repoHistory'

type RepositoryInputProps = {
  url: string
  loading: boolean
  pastRepos: PastRepo[]
  showPastRepos: boolean
  onUrlChange: (url: string) => void
  onSubmit: (event: FormEvent) => void
  onTogglePastRepos: () => void
  onSelectPastRepo: (url: string) => void
  onClearPastRepos: () => void
}

export function RepositoryInput({
  url,
  loading,
  pastRepos,
  showPastRepos,
  onUrlChange,
  onSubmit,
  onTogglePastRepos,
  onSelectPastRepo,
  onClearPastRepos,
}: RepositoryInputProps) {
  return (
    <form className="ingest" onSubmit={onSubmit}>
      <label htmlFor="repo-url">Public GitHub repository</label>
      <div className="row">
        <input
          id="repo-url"
          type="url"
          placeholder="https://github.com/org/repo"
          value={url}
          onChange={(event) => onUrlChange(event.target.value)}
          required
          disabled={loading}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          inputMode="url"
          list={undefined}
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Composing…' : 'Tell the story'}
        </button>
      </div>
      <div className="past-repos-row">
        <button
          type="button"
          className="ghost past-repos-toggle"
          onClick={onTogglePastRepos}
          disabled={loading}
        >
          {showPastRepos ? 'Hide past searches' : 'Past searches'}
        </button>
      </div>
      {showPastRepos && (
        <div className="past-repos-panel" role="listbox" aria-label="Past searches">
          {pastRepos.length === 0 ? (
            <p className="muted-line">No past searches yet.</p>
          ) : (
            <>
              <ul className="past-repos-list">
                {pastRepos.map((entry) => (
                  <li key={entry.url}>
                    <button
                      type="button"
                      className="past-repo-item"
                      onClick={() => onSelectPastRepo(entry.url)}
                      disabled={loading}
                    >
                      <span className="past-repo-label">{entry.label}</span>
                      <span className="past-repo-url">{entry.url}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="ghost past-repos-clear"
                onClick={onClearPastRepos}
              >
                Clear history
              </button>
            </>
          )}
        </div>
      )}
    </form>
  )
}
