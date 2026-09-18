type BrandMarkProps = {
  compact?: boolean
}

/** Top-left wordmark — quiet studio mark, not a hero sticker. */
export function BrandMark({ compact = false }: BrandMarkProps) {
  return (
    <span className={compact ? 'brand-mark brand-mark-compact' : 'brand-mark'}>
      <span className="brand-mark-glyph" aria-hidden>
        <svg viewBox="0 0 24 24" width="12" height="12">
          <circle
            cx="12"
            cy="12"
            r="9.25"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M7.5 13.5c1.6-3.2 3.4-4.8 4.5-4.8s2.9 1.6 4.5 4.8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <span className="brand-mark-word">CodeSymphony</span>
    </span>
  )
}
