import { lazy, Suspense, useMemo } from 'react'
import type { StoryChapter } from '../../utils/story'
import { prefersReducedMotion } from '../../utils/motion'

const WebGLDepthInner = lazy(() =>
  import('./WebGLDepth').then((module) => ({ default: module.WebGLDepth })),
)

type Props = {
  chapter: StoryChapter
  focus: boolean
  scrubProgress?: number
}

/** Lazy Three.js depth — skipped entirely when reduced motion is preferred. */
export function WebGLDepthLazy(props: Props) {
  const reduce = useMemo(() => prefersReducedMotion(), [])

  if (reduce) {
    return <div className="webgl-depth webgl-depth-static" aria-hidden />
  }

  return (
    <Suspense fallback={<div className="webgl-depth webgl-depth-static" aria-hidden />}>
      <WebGLDepthInner {...props} />
    </Suspense>
  )
}
