import { lazy, Suspense, useEffect, useState } from 'react'
import type { StoryChapter } from '../../utils/story'
import { SignatureMotion } from './SignatureMotion'

const RIVE_SRC = '/signature.riv'

const RivePlayer = lazy(() =>
  import('./RivePlayer').then((module) => ({ default: module.RivePlayer })),
)

type RiveSignatureProps = {
  chapter: StoryChapter
  focus: boolean
}

/**
 * Prefers public/signature.riv when present; otherwise SignatureMotion canvas.
 */
export function RiveSignature({ chapter, focus }: RiveSignatureProps) {
  const [hasRiveFile, setHasRiveFile] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(RIVE_SRC, { method: 'HEAD' })
      .then((response) => {
        if (!cancelled) {
          setHasRiveFile(response.ok)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHasRiveFile(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!hasRiveFile) {
    return <SignatureMotion chapter={chapter} focus={focus} />
  }

  return (
    <Suspense fallback={<SignatureMotion chapter={chapter} focus={focus} />}>
      <RivePlayer chapter={chapter} focus={focus} src={RIVE_SRC} />
    </Suspense>
  )
}
