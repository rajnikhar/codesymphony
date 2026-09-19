import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { StoryChapter } from '../../utils/story'
import { prefersReducedMotion } from '../../utils/motion'

const CHAPTER_Z: Record<StoryChapter, number> = {
  overview: 0,
  spine: 1,
  links: 2,
  history: 3,
  playground: 4,
}

type WebGLDepthProps = {
  chapter: StoryChapter
  focus: boolean
  /** 0–1 timeline scrub for history wave energy */
  scrubProgress?: number
}

/**
 * Soft WebGL atmosphere under the story stage (Gallery Mist).
 * Light fog / jade mesh / floating dust — never a blue-black void.
 */
export function WebGLDepth({
  chapter,
  focus,
  scrubProgress = 0,
}: WebGLDepthProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const chapterRef = useRef(chapter)
  const focusRef = useRef(focus)
  const scrubRef = useRef(scrubProgress)

  useEffect(() => {
    chapterRef.current = chapter
  }, [chapter])
  useEffect(() => {
    focusRef.current = focus
  }, [focus])
  useEffect(() => {
    scrubRef.current = scrubProgress
  }, [scrubProgress])

  useEffect(() => {
    const maybeRoot = hostRef.current
    if (!maybeRoot) {
      return
    }
    const root: HTMLDivElement = maybeRoot

    const reduced = prefersReducedMotion()

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setClearColor(0xf3f1ec, 0)
    root.appendChild(renderer.domElement)
    Object.assign(renderer.domElement.style, {
      width: '100%',
      height: '100%',
      display: 'block',
    })

    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0xf3f1ec, 0.045)

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80)
    camera.position.set(0, 3.2, 9.5)
    camera.lookAt(0, 0.4, 0)

    const hemi = new THREE.HemisphereLight(0xe7d4c4, 0xd3ddd4, 1.05)
    scene.add(hemi)
    const key = new THREE.DirectionalLight(0x0e6b5c, 0.55)
    key.position.set(4, 8, 2)
    scene.add(key)
    const fill = new THREE.DirectionalLight(0xfffdf9, 0.35)
    fill.position.set(-5, 3, 4)
    scene.add(fill)

    // Soft terrain plane
    const planeGeo = new THREE.PlaneGeometry(22, 14, 56, 36)
    const planeMat = new THREE.MeshStandardMaterial({
      color: 0xd8e4dc,
      emissive: 0x0e6b5c,
      emissiveIntensity: 0.04,
      roughness: 0.82,
      metalness: 0.05,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      flatShading: true,
    })
    const plane = new THREE.Mesh(planeGeo, planeMat)
    plane.rotation.x = -Math.PI / 2.35
    plane.position.y = -0.6
    scene.add(plane)

    const basePositions = Float32Array.from(planeGeo.attributes.position.array)

    // Floating dust
    const count = reduced ? 40 : 220
    const dustGeo = new THREE.BufferGeometry()
    const dustPos = new Float32Array(count * 3)
    const dustSeed = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      dustPos[i * 3] = (Math.random() - 0.5) * 16
      dustPos[i * 3 + 1] = Math.random() * 5 + 0.2
      dustPos[i * 3 + 2] = (Math.random() - 0.5) * 12
      dustSeed[i] = Math.random() * Math.PI * 2
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3))
    const dustMat = new THREE.PointsMaterial({
      color: 0x0e6b5c,
      size: 0.045,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      sizeAttenuation: true,
    })
    const dust = new THREE.Points(dustGeo, dustMat)
    scene.add(dust)

    // Soft ribbon arcs (thin tubes as curves)
    const ribbonGroup = new THREE.Group()
    scene.add(ribbonGroup)
    const ribbonMats: THREE.MeshBasicMaterial[] = []
    for (let i = 0; i < 3; i++) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-8, 0.8 + i * 0.35, -2 + i),
        new THREE.Vector3(-2, 1.6 + i * 0.2, 1 - i * 0.3),
        new THREE.Vector3(3, 1.1 + i * 0.25, -1 + i * 0.4),
        new THREE.Vector3(8, 1.8 + i * 0.15, 0.5),
      ])
      const tube = new THREE.TubeGeometry(curve, 64, 0.018, 6, false)
      const mat = new THREE.MeshBasicMaterial({
        color: i === 1 ? 0xe7d4c4 : 0x0e6b5c,
        transparent: true,
        opacity: 0.22,
      })
      ribbonMats.push(mat)
      ribbonGroup.add(new THREE.Mesh(tube, mat))
    }

    let width = 0
    let height = 0
    let raf = 0
    let focusMix = focusRef.current ? 1 : 0
    let chapterMix = CHAPTER_Z[chapterRef.current]
    const clock = new THREE.Clock()

    function resize() {
      width = root.clientWidth
      height = root.clientHeight
      if (width < 1 || height < 1) {
        return
      }
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false)
    }

    function displaceTerrain(t: number, energy: number) {
      const pos = planeGeo.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < pos.count; i++) {
        const x = basePositions[i * 3]
        const y = basePositions[i * 3 + 1]
        const wave =
          Math.sin(x * 0.55 + t * 0.7) * 0.22 +
          Math.cos(y * 0.7 + t * 0.45) * 0.16 +
          Math.sin((x + y) * 0.35 + t * 0.9) * 0.12 * energy
        pos.setZ(i, wave * (0.55 + energy * 0.7))
      }
      pos.needsUpdate = true
      planeGeo.computeVertexNormals()
    }

    function frame() {
      const t = clock.getElapsedTime()
      const chapterTarget = CHAPTER_Z[chapterRef.current]
      chapterMix += (chapterTarget - chapterMix) * (reduced ? 1 : 0.04)
      const focusTarget = focusRef.current ? 1 : 0
      focusMix += (focusTarget - focusMix) * (reduced ? 1 : 0.05)
      const scrub = scrubRef.current
      const energy =
        0.35 + chapterMix * 0.15 + scrub * 0.45 + focusMix * 0.25

      if (!reduced) {
        displaceTerrain(t, energy)
        ribbonGroup.rotation.y = t * 0.04 + chapterMix * 0.12
        ribbonGroup.position.y = Math.sin(t * 0.35) * 0.08
        for (let i = 0; i < ribbonMats.length; i++) {
          ribbonMats[i].opacity = 0.14 + focusMix * 0.12 + (i % 2) * 0.04
        }

        const positions = dustGeo.attributes.position as THREE.BufferAttribute
        for (let i = 0; i < count; i++) {
          const seed = dustSeed[i]
          const x = positions.getX(i)
          const z = positions.getZ(i)
          const y =
            0.4 +
            ((Math.sin(t * 0.4 + seed) + 1) * 0.5) * (2.8 + focusMix * 1.2) +
            scrub * 0.4
          positions.setY(i, y)
          positions.setX(i, x + Math.sin(t * 0.2 + seed) * 0.002)
          positions.setZ(i, z + Math.cos(t * 0.18 + seed) * 0.002)
        }
        positions.needsUpdate = true
        dustMat.opacity = 0.22 + focusMix * 0.2 + scrub * 0.08
      }

      // Camera “director” — chapter pans, focus dolly
      const camX = Math.sin(chapterMix * 0.55) * 1.4 + (1 - focusMix) * 0.2
      const camY = 2.6 + focusMix * 0.9 + chapterMix * 0.15
      const camZ = 9.2 - focusMix * 2.4 - chapterMix * 0.35
      camera.position.x += (camX - camera.position.x) * (reduced ? 1 : 0.04)
      camera.position.y += (camY - camera.position.y) * (reduced ? 1 : 0.04)
      camera.position.z += (camZ - camera.position.z) * (reduced ? 1 : 0.04)
      camera.lookAt(0, 0.3 + focusMix * 0.5, 0)

      planeMat.emissiveIntensity = 0.03 + focusMix * 0.08 + scrub * 0.04
      key.intensity = 0.45 + focusMix * 0.25

      renderer.render(scene, camera)
      raf = requestAnimationFrame(frame)
    }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(root)
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      planeGeo.dispose()
      planeMat.dispose()
      dustGeo.dispose()
      dustMat.dispose()
      ribbonGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose()
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose())
          } else {
            obj.material.dispose()
          }
        }
      })
      renderer.dispose()
      if (renderer.domElement.parentElement === root) {
        root.removeChild(renderer.domElement)
      }
    }
  }, [])

  return <div ref={hostRef} className="webgl-depth" aria-hidden />
}
