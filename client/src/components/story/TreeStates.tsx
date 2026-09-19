import type { TreeResponse } from '../../types'

type TreeNoStructureProps = {
  tree: TreeResponse
  recentPaths: string[]
}

export function TreeNoStructure({ tree, recentPaths }: TreeNoStructureProps) {
  return (
    <div className="tree-fallback" role="status">
      <div className="tree-sapling" aria-hidden>
        <span className="tree-sapling-stem" />
        <span className="tree-sapling-leaf" />
      </div>
      <p className="story-title">This repo doesn’t have enough resolvable imports to grow a tree yet</p>
      <p className="muted-line">
        Showing commit activity only ({tree.totalCommits} commits sampled).
      </p>
      <ul className="tree-activity-list">
        {recentPaths.length === 0 ? (
          <li className="muted-line">No recent file touches in the sample.</li>
        ) : (
          recentPaths.slice(0, 12).map((path) => <li key={path}>{path}</li>)
        )}
      </ul>
    </div>
  )
}

export function TreeCloneError({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="tree-error" role="alert">
      <div className="tree-error-icon" aria-hidden>
        ⚠
      </div>
      <p className="story-title">{message}</p>
      <button type="button" className="ghost" onClick={onRetry}>
        Try again
      </button>
    </div>
  )
}
