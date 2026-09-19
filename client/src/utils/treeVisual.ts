/** Pure leaf color from scrub position — no memoized/stale state. */

export const LEAF_GOLD = '#e8c547'
export const LEAF_GREEN = '#3d9a6a'
export const LEAF_BROWN = '#6b5344'

export function getLeafColor(
  commitIndicesTouched: number[],
  currentScrubPosition: number,
  totalCommits: number,
): string {
  if (totalCommits <= 0) {
    return LEAF_BROWN
  }
  const touched = commitIndicesTouched
  if (touched.includes(currentScrubPosition)) {
    return LEAF_GOLD
  }
  let mostRecentTouch = -1
  for (const index of touched) {
    if (index <= currentScrubPosition && index > mostRecentTouch) {
      mostRecentTouch = index
    }
  }
  if (mostRecentTouch < 0) {
    return LEAF_BROWN
  }
  const recentWindow = Math.max(1, Math.floor(totalCommits * 0.1))
  if (mostRecentTouch >= currentScrubPosition - recentWindow) {
    return LEAF_GREEN
  }
  return LEAF_BROWN
}

/** Deterministic 32-bit hash (FNV-1a) for seeded tree geometry. */
export function hashString(input: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/** Deterministic unit float in [0, 1) from seed + salt. */
export function seededUnit(seed: number, salt: number): number {
  let x = (seed ^ Math.imul(salt, 0x9e3779b9)) >>> 0
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d)
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b)
  x ^= x >>> 16
  return (x >>> 0) / 4294967296
}
