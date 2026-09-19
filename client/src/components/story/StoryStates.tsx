type StoryEmptyProps = {
  variant?: 'landing' | 'blank-graph'
}

export function StoryEmpty({ variant = 'landing' }: StoryEmptyProps) {
  if (variant === 'blank-graph') {
    return (
      <div className="story-empty story-empty-live">
        <p className="story-kicker">Quiet stage</p>
        <p className="story-title">No files made it into the map</p>
        <p className="muted-line">
          This repo may be empty, binary-heavy, or outside JS/TS/Python/Java.
          Try another public repository, or scrub History if commits loaded.
        </p>
      </div>
    )
  }

  return (
    <div className="story-empty">
      <p className="story-kicker">Ready when you are</p>
      <p className="story-title">Your repository story starts here</p>
      <p className="muted-line">
        Paste a public GitHub URL above. We’ll open a full-bleed stage and walk
        Overview → Spine → Links → History.
      </p>
    </div>
  )
}

type StoryLoadingProps = {
  url?: string
}

export function StoryLoading({ url }: StoryLoadingProps) {
  const label = url
    ? url.replace(/^https?:\/\/(www\.)?github\.com\//, '')
    : 'your repository'

  return (
    <div className="story-loading tree-loading" role="status" aria-live="polite">
      <div className="tree-loading-spinner" aria-hidden />
      <p className="story-title">Cloning and reading history…</p>
      <p className="muted-line">{label}</p>
    </div>
  )
}
