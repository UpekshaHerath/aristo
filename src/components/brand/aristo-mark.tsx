import { cn } from '@/lib/utils'

/*
 * Brand colours as literals, not theme tokens.
 *
 * A logo is the one thing in the interface that must NOT adapt. The previous
 * mark was drawn in `--highlight` on `--highlight-muted`, so it changed colour
 * between light and dark and again on the sign-in wash - three versions of one
 * identity, which is how a mark stops being recognisable. These are the hues
 * the ochre token is built from, pinned.
 */
const TILE_FROM = '#25384a'
const TILE_TO = '#111a24'
const LETTER_ON_TILE = '#f6f3ea'
const SWIPE_FROM = '#f2bb4f'
const SWIPE_TO = '#dd9331'

/**
 * The Aristo mark: an "A" with a highlighter run through it.
 *
 * The audience is fourteen to eighteen, revising for Cambridge papers, usually
 * on a phone. The single object every one of them associates with revision is a
 * highlighter - so the mark is that gesture rather than another chat bubble or
 * spark, and it says "the part that matters" without a word of copy. It also
 * cashes the brand's own rule that ochre is the highlighter colour, reserved
 * for brand moments.
 *
 * The swipe does the work of the crossbar. Between the legs it fills the bar;
 * past them it overshoots on both sides, the way a real highlighter runs past
 * the end of the line - which is what stops the mark reading as a plain letter.
 * It sits behind the letterform rather than over it: translucent ink over cream
 * turned both to mud at small sizes.
 *
 * Sizes are handled by different means. At 16px only the silhouette lands -
 * apex, two legs, a bar across, still an "A". At 96px the overshoot and the
 * slight tilt of the swipe arrive.
 */
export function AristoMark({
  className,
  tile = true,
  decorative = false,
}: {
  /** Draws the ink tile behind the glyph. Off for a bare, inheriting glyph. */
  tile?: boolean
  /** Hides the mark from screen readers - for when a visible "Aristo" follows. */
  decorative?: boolean
  className?: string
}) {
  // On the tile the letter is cream, because the tile is the dark ground. Bare,
  // it inherits, so the mark drops onto any surface without a second asset.
  // The swipe never inherits: it is the brand colour, and that is the point.
  const letter = tile ? LETTER_ON_TILE : 'currentColor'

  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      role={decorative ? 'presentation' : 'img'}
      aria-label={decorative ? undefined : 'Aristo'}
      aria-hidden={decorative || undefined}
      className={cn('size-8', className)}
    >
      <defs>
        {/*
         * Fixed ids, not generated ones. Every instance defines the same two
         * gradients, so duplicate ids resolve to something identical - and the
         * alternative, useId, would force this into a client component for no
         * gain.
         */}
        <linearGradient
          id="aristo-tile"
          x1="0"
          y1="0"
          x2="32"
          y2="32"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor={TILE_FROM} />
          <stop offset="1" stopColor={TILE_TO} />
        </linearGradient>
        <linearGradient
          id="aristo-swipe"
          x1="4"
          y1="0"
          x2="28"
          y2="0"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor={SWIPE_FROM} />
          <stop offset="1" stopColor={SWIPE_TO} />
        </linearGradient>
      </defs>

      {tile && <rect width="32" height="32" rx="9" fill="url(#aristo-tile)" />}

      {/* The swipe. Tilted a few degrees because a highlighter held in the hand
          never lands square, and that tilt is most of what makes it read as a
          stroke someone made rather than a rule someone drew. */}
      <g transform="rotate(-5 16 19)">
        <rect
          x="4.5"
          y="16.2"
          width="23"
          height="5.8"
          rx="1.2"
          fill="url(#aristo-swipe)"
        />
      </g>

      {/* The letter, over the swipe. */}
      <path
        d="M8.6 26 16 7l7.4 19"
        stroke={letter}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
      {/* Decorative here - the word beside it already says "Aristo", and a
          labelled mark would have a screen reader announce the name twice. */}
      <AristoMark decorative className="size-7 shrink-0" />
      <span className="font-display font-semibold text-lg tracking-tight">
        Aristo
      </span>
    </span>
  )
}
