import { useLayoutEffect, useRef, type RefObject } from 'react'
import gsap from 'gsap'
import { prefersReducedMotion } from '../utils/motion'

/** Soft water-flow enter for a scene root. */
export function useSceneEnter(
  dependencyKey: string,
): RefObject<HTMLDivElement | null> {
  const rootRef = useRef<HTMLDivElement | null>(null)

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) {
      return
    }

    if (prefersReducedMotion()) {
      gsap.set(root, { clearProps: 'all', opacity: 1, y: 0, x: 0, filter: 'none' })
      return
    }

    const ctx = gsap.context(() => {
      const hero = root.querySelectorAll(
        '[data-animate="hero"] > *, [data-animate="item"]',
      )
      const targets = hero.length > 0 ? hero : [root]

      gsap.fromTo(
        targets,
        { opacity: 0, y: 36, x: 12, filter: 'blur(8px)' },
        {
          opacity: 1,
          y: 0,
          x: 0,
          filter: 'blur(0px)',
          duration: 1.05,
          stagger: 0.07,
          ease: 'sine.out',
          clearProps: 'filter',
        },
      )
    }, root)

    return () => ctx.revert()
  }, [dependencyKey])

  return rootRef
}

/** One-shot mount of the full-bleed stage shell. */
export function useStageReveal(
  active: boolean,
): RefObject<HTMLDivElement | null> {
  const shellRef = useRef<HTMLDivElement | null>(null)

  useLayoutEffect(() => {
    const shell = shellRef.current
    if (!shell || !active) {
      return
    }

    if (prefersReducedMotion()) {
      gsap.set(shell, { opacity: 1, y: 0 })
      return
    }

    const ctx = gsap.context(() => {
      gsap.fromTo(
        shell,
        { opacity: 0, y: 48 },
        { opacity: 1, y: 0, duration: 1.15, ease: 'sine.out' },
      )
    }, shell)

    return () => ctx.revert()
  }, [active])

  return shellRef
}
