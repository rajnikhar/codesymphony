import { useEffect } from 'react'
import { useRive } from '@rive-app/react-canvas'
import type { StoryChapter } from '../../utils/story'

type RivePlayerProps = {
  chapter: StoryChapter
  focus: boolean
  src: string
}

export function RivePlayer({ chapter, focus, src }: RivePlayerProps) {
  const chapterIndex =
    chapter === 'overview'
      ? 0
      : chapter === 'spine'
        ? 1
        : chapter === 'links'
          ? 2
          : 3

  const { RiveComponent, rive } = useRive({
    src,
    stateMachines: 'Signature',
    autoplay: true,
  })

  useEffect(() => {
    if (!rive) {
      return
    }
    const inputs = rive.stateMachineInputs('Signature')
    if (!inputs) {
      return
    }
    const chapterInput = inputs.find((input) => input.name === 'chapter')
    const focusInput = inputs.find((input) => input.name === 'focus')
    if (chapterInput && typeof chapterInput.value === 'number') {
      chapterInput.value = chapterIndex
    }
    if (focusInput && typeof focusInput.value === 'boolean') {
      focusInput.value = focus
    }
  }, [rive, chapterIndex, focus])

  return (
    <div className="signature-rive" aria-hidden>
      <RiveComponent />
    </div>
  )
}
