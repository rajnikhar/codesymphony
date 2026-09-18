import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import type { ExplainFileResponse, FileNeighborhood } from '../../types'

import { prefersReducedMotion } from '../../utils/motion'

type FileStoryCinemaProps = {
  neighborhood: FileNeighborhood
  explanation: ExplainFileResponse | null
  explaining: boolean
  onSelectFile: (path: string) => void
  onAskExplain: () => void
  onClose: () => void
}

function shortName(path: string): string {
  return path.split('/').pop() ?? path
}

/**
 * Staged file-story reveal: Arrival → Relations → Meaning (explanation climax).
 */
export function FileStoryCinema({
  neighborhood,
  explanation,
  explaining,
  onSelectFile,
  onAskExplain,
  onClose,
}: FileStoryCinemaProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const explainRef = useRef<HTMLElement>(null)
  const fileName = shortName(neighborhood.path)

  // Act I–II: title + relation graph
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) {
      return
    }

    if (prefersReducedMotion()) {
      gsap.set(root.querySelectorAll('[data-beat]'), { clearProps: 'all', opacity: 1, y: 0 })
      return
    }

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'sine.out' } })

      tl.fromTo(
        root.querySelectorAll('[data-beat="title"]'),
        { opacity: 0, y: 40, x: 10, filter: 'blur(10px)' },
        {
          opacity: 1,
          y: 0,
          x: 0,
          filter: 'blur(0px)',
          duration: 1,
          stagger: 0.1,
        },
      )
        .fromTo(
          root.querySelector('[data-beat="act-label"]'),
          { opacity: 0 },
          { opacity: 1, duration: 0.5 },
          '-=0.45',
        )
        .fromTo(
          root.querySelectorAll('[data-beat="upstream"]'),
          { opacity: 0, x: -36 },
          { opacity: 1, x: 0, duration: 0.75, stagger: 0.08 },
          '-=0.2',
        )
        .fromTo(
          root.querySelectorAll('[data-beat="orb"]'),
          { opacity: 0, scale: 0.82 },
          { opacity: 1, scale: 1, duration: 0.8 },
          '-=0.35',
        )
        .fromTo(
          root.querySelectorAll('[data-beat="downstream"]'),
          { opacity: 0, x: 36 },
          { opacity: 1, x: 0, duration: 0.75, stagger: 0.08 },
          '-=0.3',
        )
        .fromTo(
          root.querySelector('[data-beat="explain-shell"]'),
          { opacity: 0, y: 28 },
          { opacity: 1, y: 0, duration: 0.7 },
          '-=0.15',
        )
    }, root)

    return () => ctx.revert()
  }, [neighborhood.path])

  // Act III: explanation climax
  useLayoutEffect(() => {
    const shell = explainRef.current
    if (!shell || !explanation) {
      return
    }

    if (prefersReducedMotion()) {
      gsap.set(shell.querySelectorAll('[data-beat]'), {
        clearProps: 'all',
        opacity: 1,
        y: 0,
      })
      return
    }

    const ctx = gsap.context(() => {
      const lines = shell.querySelectorAll('[data-beat="explain-line"]')
      gsap.fromTo(
        lines,
        { opacity: 0, y: 22, filter: 'blur(5px)' },
        {
          opacity: 1,
          y: 0,
          filter: 'blur(0px)',
          duration: 0.85,
          stagger: 0.12,
          ease: 'sine.out',
          clearProps: 'filter',
        },
      )
    }, shell)

    return () => ctx.revert()
  }, [explanation])

  return (
    <div ref={rootRef} className="cinema" aria-label="File story cinema">
      <div className="cinema-top">
        <button type="button" className="story-back" onClick={onClose}>
          ← Back to chapters
        </button>
        <ol className="cinema-acts" aria-label="Story acts">
          <li className="cinema-act active">I · Arrival</li>
          <li className="cinema-act active">II · Relations</li>
          <li
            className={
              explanation ? 'cinema-act active' : 'cinema-act'
            }
          >
            III · Meaning
          </li>
        </ol>
      </div>

      <header className="story-hero focus-hero cinema-title">
        <p className="story-kicker" data-beat="title">
          File story
        </p>
        <h2 className="story-title" data-beat="title">
          {fileName}
        </h2>
        <p className="story-path" data-beat="title">
          {neighborhood.path}
        </p>
        <p className="story-lead" data-beat="title">
          {neighborhood.language} · touched in {neighborhood.commitCount}{' '}
          commits · churn {neighborhood.churn}
        </p>
      </header>

      <p className="cinema-act-label" data-beat="act-label">
        Who reaches this file — and what it reaches for
      </p>

      <div className="relation-scene cinema-relations">
        <div className="relation-column">
          <h3 data-beat="upstream">Used by</h3>
          {neighborhood.usedBy.length === 0 ? (
            <p className="muted-line" data-beat="upstream">
              Nothing in the map imports this yet.
            </p>
          ) : (
            neighborhood.usedBy.map((file) => (
              <button
                key={file.path}
                type="button"
                className="scene-chip upstream"
                data-beat="upstream"
                onClick={() => onSelectFile(file.path)}
              >
                {shortName(file.path)}
              </button>
            ))
          )}
        </div>

        <div className="relation-flow" aria-hidden>
          <span className="flow-beam" data-beat="orb" />
          <div className="flow-orb cinema-orb" data-beat="orb">
            {fileName}
          </div>
          <span className="flow-beam" data-beat="orb" />
        </div>

        <div className="relation-column">
          <h3 data-beat="downstream">Depends on</h3>
          {neighborhood.dependsOn.length === 0 ? (
            <p className="muted-line" data-beat="downstream">
              No project imports from here.
            </p>
          ) : (
            neighborhood.dependsOn.map((file) => (
              <button
                key={file.path}
                type="button"
                className="scene-chip downstream"
                data-beat="downstream"
                onClick={() => onSelectFile(file.path)}
              >
                {shortName(file.path)}
              </button>
            ))
          )}
        </div>
      </div>

      <section
        ref={explainRef}
        className="explain-stage cinema-explain"
        data-beat="explain-shell"
        aria-live="polite"
      >
        {explaining && !explanation ? (
          <div className="cinema-waiting">
            <span className="cinema-waiting-dot" />
            <p className="muted-line">Writing the meaning of this scene…</p>
          </div>
        ) : explanation ? (
          <>
            <p className="cinema-act-label" data-beat="explain-line">
              III · Meaning
            </p>
            <h3 data-beat="explain-line">{explanation.title}</h3>
            <p className="explain-summary" data-beat="explain-line">
              {explanation.summary}
            </p>
            <p className="explain-story" data-beat="explain-line">
              {explanation.story}
            </p>
            <ul className="explain-points">
              {explanation.points.map((point) => (
                <li key={point} data-beat="explain-line">
                  {point}
                </li>
              ))}
            </ul>
            <p className="next-hint" data-beat="explain-line">
              {explanation.questionPrompt}
            </p>
            <button
              type="button"
              className="ghost"
              data-beat="explain-line"
              onClick={onAskExplain}
              disabled={explaining}
            >
              Replay explanation
            </button>
          </>
        ) : (
          <button
            type="button"
            className="primary-wide"
            onClick={onAskExplain}
            disabled={explaining}
          >
            Reveal the meaning
          </button>
        )}
      </section>
    </div>
  )
}
