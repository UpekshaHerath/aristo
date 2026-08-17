import { cn } from '@/lib/utils'

/**
 * The Aristo mark: an "A" whose crossbar runs past the right leg, so the letter
 * doubles as a ruled page edge.
 *
 * Drawn with strokes rather than filled paths. A filled counter (the triangular
 * hole in an "A") collapses into a smudge once the mark is rendered at favicon
 * size; an open stroked letterform stays legible down to 16px, which is the
 * size it will most often be seen at.
 *
 * Colour comes from `currentColor` on the letter and an explicit token on the
 * tile, so the mark inherits correctly in both themes without a second asset.
 */
export function AristoMark({
  className,
  tile = true,
}: {
  /** Draws the rounded ochre tile behind the letter. Off for a bare glyph. */
  tile?: boolean
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      role="img"
      aria-label="Aristo"
      className={cn('size-8', className)}
    >
      {tile && (
        <rect width="32" height="32" rx="9" className="fill-highlight-muted" />
      )}
      <g
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-highlight"
      >
        {/* Apex down to each leg. */}
        <path d="M9 24 16 8l7 16" />
        {/* Crossbar, overshooting right - the page rule. */}
        <path d="M11.6 18.4h9.6" />
      </g>
    </svg>
  )
}

/**
 * Mark plus wordmark. The word is set in the display serif deliberately: it is
 * the one place the textbook register is stated outright, against a UI that is
 * otherwise entirely sans.
 */
export function AristoWordmark({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <AristoMark className="size-7 shrink-0" />
      <span className="font-display text-lg tracking-tight">Aristo</span>
    </span>
  )
}
