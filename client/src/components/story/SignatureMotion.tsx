import { useEffect, useRef } from 'react'
import type { StoryChapter } from '../../utils/story'
import { prefersReducedMotion } from '../../utils/motion'

export type SignatureInputs = {
  chapter: StoryChapter
  focus: boolean
}

const CHAPTER_INDEX: Record<StoryChapter, number> = {
  overview: 0,
  spine: 1,
  links: 2,
  history: 3,
  playground: 4,
}

type Ribbon = {
  y: number
  amp: number
  speed: number
  phase: number
  width: number
  alpha: number
}

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  life: number
}

/**
 * State-machine signature motion for the story stage.
 * Inputs: chapter index + focus. Designed to be swapped for a Rive .riv
 * with matching inputs (see RiveSignature / ART_DIRECTION Week 3).
 */
export function SignatureMotion({ chapter, focus }: SignatureInputs) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chapterRef = useRef(chapter)
  const focusRef = useRef(focus)

  useEffect(() => {
    chapterRef.current = chapter
  }, [chapter])

  useEffect(() => {
    focusRef.current = focus
  }, [focus])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const reduced = prefersReducedMotion()

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    let raf = 0
    let width = 0
    let height = 0
    let dpr = 1
    let time = 0
    let wipe = 0
    let wipeActive = false
    let lastChapter = CHAPTER_INDEX[chapterRef.current]
    let focusMix = focusRef.current ? 1 : 0

    const ribbons: Ribbon[] = Array.from({ length: 5 }, (_, i) => ({
      y: 0.18 + i * 0.16,
      amp: 18 + i * 6,
      speed: 0.35 + i * 0.08,
      phase: i * 1.3,
      width: 1.2 + i * 0.35,
      alpha: 0.08 + i * 0.02,
    }))

    const particles: Particle[] = Array.from({ length: 28 }, () => ({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.00025,
      vy: (Math.random() - 0.5) * 0.0002,
      r: 0.8 + Math.random() * 1.8,
      life: Math.random(),
    }))

    function resize() {
      const parent = canvas!.parentElement
      if (!parent) {
        return
      }
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = parent.clientWidth
      height = parent.clientHeight
      canvas!.width = Math.floor(width * dpr)
      canvas!.height = Math.floor(height * dpr)
      canvas!.style.width = `${width}px`
      canvas!.style.height = `${height}px`
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    function drawRibbon(r: Ribbon, t: number, accent: string) {
      const y0 = r.y * height
      ctx!.beginPath()
      for (let x = 0; x <= width; x += 8) {
        const n =
          Math.sin(x * 0.008 + t * r.speed + r.phase) * r.amp +
          Math.sin(x * 0.021 + t * r.speed * 0.6) * (r.amp * 0.35)
        const y = y0 + n
        if (x === 0) {
          ctx!.moveTo(x, y)
        } else {
          ctx!.lineTo(x, y)
        }
      }
      ctx!.strokeStyle = accent
      ctx!.globalAlpha = r.alpha * (0.55 + focusMix * 0.45)
      ctx!.lineWidth = r.width
      ctx!.stroke()
      ctx!.globalAlpha = 1
    }

    function drawWipe(progress: number) {
      // Soft jade veil sweeping left → right
      const edge = progress * (width + 160) - 80
      const grad = ctx!.createLinearGradient(edge - 180, 0, edge + 40, 0)
      grad.addColorStop(0, 'rgba(14, 107, 92, 0)')
      grad.addColorStop(0.45, 'rgba(14, 107, 92, 0.12)')
      grad.addColorStop(0.7, 'rgba(231, 212, 196, 0.28)')
      grad.addColorStop(1, 'rgba(255, 253, 249, 0)')
      ctx!.fillStyle = grad
      ctx!.fillRect(0, 0, width, height)

      // Arc accent
      ctx!.beginPath()
      ctx!.arc(edge, height * 0.42, 70 + progress * 40, 0, Math.PI * 2)
      ctx!.strokeStyle = 'rgba(14, 107, 92, 0.22)'
      ctx!.lineWidth = 1.5
      ctx!.stroke()
    }

    function drawFocusBloom() {
      if (focusMix < 0.01) {
        return
      }
      const cx = width * 0.5
      const cy = height * 0.38
      const radius = 80 + focusMix * 160
      const bloom = ctx!.createRadialGradient(cx, cy, 10, cx, cy, radius)
      bloom.addColorStop(0, `rgba(14, 107, 92, ${0.18 * focusMix})`)
      bloom.addColorStop(0.45, `rgba(231, 212, 196, ${0.16 * focusMix})`)
      bloom.addColorStop(1, 'rgba(243, 241, 236, 0)')
      ctx!.fillStyle = bloom
      ctx!.fillRect(0, 0, width, height)

      ctx!.beginPath()
      ctx!.arc(cx, cy, 36 + focusMix * 18, 0, Math.PI * 2)
      ctx!.strokeStyle = `rgba(14, 107, 92, ${0.35 * focusMix})`
      ctx!.lineWidth = 1.25
      ctx!.stroke()
    }

    function frame(ts: number) {
      time = ts * 0.001
      const chapterNow = CHAPTER_INDEX[chapterRef.current]
      if (chapterNow !== lastChapter) {
        lastChapter = chapterNow
        wipe = 0
        wipeActive = !reduced
      }

      const focusTarget = focusRef.current ? 1 : 0
      focusMix += (focusTarget - focusMix) * (reduced ? 1 : 0.06)

      ctx!.clearRect(0, 0, width, height)

      // Soft atmospheric wash tied to chapter
      const wash = ctx!.createLinearGradient(0, 0, width, height)
      const chapterT = chapterNow / 3
      wash.addColorStop(0, `rgba(231, 212, 196, ${0.12 + chapterT * 0.06})`)
      wash.addColorStop(1, `rgba(211, 221, 212, ${0.1 + (1 - chapterT) * 0.08})`)
      ctx!.fillStyle = wash
      ctx!.fillRect(0, 0, width, height)

      if (!reduced) {
        for (const ribbon of ribbons) {
          drawRibbon(ribbon, time, 'rgba(14, 107, 92, 0.9)')
        }

        for (const p of particles) {
          p.x += p.vx
          p.y += p.vy
          if (p.x < 0 || p.x > 1) p.vx *= -1
          if (p.y < 0 || p.y > 1) p.vy *= -1
          p.life += 0.008
          ctx!.beginPath()
          ctx!.arc(p.x * width, p.y * height, p.r, 0, Math.PI * 2)
          ctx!.fillStyle = `rgba(14, 107, 92, ${0.08 + Math.sin(p.life) * 0.05})`
          ctx!.fill()
        }
      }

      drawFocusBloom()

      if (wipeActive) {
        wipe += reduced ? 1 : 0.018
        drawWipe(Math.min(wipe, 1))
        if (wipe >= 1) {
          wipeActive = false
        }
      }

      raf = requestAnimationFrame(frame)
    }

    resize()
    const ro = new ResizeObserver(resize)
    if (canvas.parentElement) {
      ro.observe(canvas.parentElement)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="signature-motion"
      aria-hidden
    />
  )
}
