import type { RepositoryMode } from '../../types'
import { BrandMark } from './BrandMark'
import { HomeIcon } from './HomeIcon'

type TopRailProps = {
  canonicalUrl: string | null
  mode: RepositoryMode | null
  onGoHome: () => void
  onPingApi: () => void
}

function shortGithubPath(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?github\.com\//, '')
}

export function TopRail({
  canonicalUrl,
  mode,
  onGoHome,
  onPingApi,
}: TopRailProps) {
  return (
    <header className="top-rail">
      <div className="top-rail-brand">
        <button
          type="button"
          className="home-btn"
          onClick={onGoHome}
          aria-label="Home — back to landing"
          title="Home"
        >
          <HomeIcon />
        </button>
        <BrandMark compact />
        {canonicalUrl && (
          <p className="top-rail-repo">{shortGithubPath(canonicalUrl)}</p>
        )}
      </div>
      <div className="top-rail-actions">
        {mode && (
          <span
            className={`mode-chip mode-${mode.toLowerCase()}`}
            title={
              mode === 'HISTORY_ONLY'
                ? 'History-forward mode'
                : 'Import story ready'
            }
          >
            {mode === 'HISTORY_ONLY' ? 'History' : 'Full story'}
          </span>
        )}
        <button type="button" className="ghost" onClick={onPingApi}>
          Ping API
        </button>
      </div>
    </header>
  )
}
