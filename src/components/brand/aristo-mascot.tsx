'use client'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useId, useState } from 'react'
import { cn } from '@/lib/utils'

export type MascotMood = 'idle' | 'thinking' | 'pleased' | 'concerned'

/**
 * Where the character is looking, in eye-widths.
 *
 * `x` runs -1 (viewer's left) to 1, `y` runs -1 (up) to 1 (down). Small numbers
 * on purpose: the whole usable range is a few SVG units, and anything larger
 * turns a glance into a lurch.
 */
export type MascotGaze = { x: number; y: number }

/*
 * The character's palette.
 *
 * Fixed values, not theme tokens. A face is brand art like a logo: it keeps one
 * palette on every ground, so the modelling stays readable in both themes. A
 * token here is how you get a dark hole inside a gold frame in dark mode.
 *
 * Each material carries a light and a shade so the whole figure can be lit from
 * one direction - upper left - which is what does the actual 3D work. Flat fills
 * make a sticker; a consistent light source makes a form.
 */
const SKIN = {
  light: 'oklch(0.912 0.042 72)',
  base: 'oklch(0.848 0.058 62)',
  shade: 'oklch(0.742 0.068 52)',
  deep: 'oklch(0.652 0.072 46)',
}
const HAIR = {
  light: 'oklch(0.965 0.012 250)',
  base: 'oklch(0.878 0.014 252)',
  shade: 'oklch(0.706 0.018 254)',
}
const ROBE = {
  light: 'oklch(0.545 0.088 262)',
  base: 'oklch(0.418 0.082 265)',
  shade: 'oklch(0.318 0.062 268)',
}
const LEAF = { base: 'oklch(0.612 0.118 148)', shade: 'oklch(0.472 0.102 152)' }
const IRIS = {
  light: 'oklch(0.712 0.092 222)',
  base: 'oklch(0.525 0.104 236)',
  dark: 'oklch(0.352 0.076 242)',
}
const GOLD = 'oklch(0.822 0.132 82)'
/** Line accents. A warm near-black - true black on a warm face reads as dirt. */
const INK = 'oklch(0.352 0.048 54)'

const EYES = [40.2, 55.8]
const EYE_Y = 43.6
/**
 * Lid travel. Closed sits at 0; open lifts the lid's edge to just above the
 * apex of the eye opening, so it still hoods the eye rather than vanishing.
 */
const LID_LIFT = -6.4

const clamp = (value: number) => Math.max(-1, Math.min(1, value))

/**
 * Aristo, the character.
 *
 * An original scholar - a broad brow, a full beard, a laurel wreath - not a
 * caricature of any real person. That is a deliberate constraint: a recognisable
 * likeness of a historical figure carries publicity and trademark exposure that
 * a student product should not take on, and a physicist in particular would
 * misread the scope of a tutor that also covers History and Biology.
 *
 * Drawn as a lit form rather than a flat mark: one light from the upper left,
 * gradients on every material, contact shadows under the jaw and the wreath,
 * and eyes built as sclera / iris / pupil / catchlight with a lid that actually
 * travels. That is what carries the depth - there is no 3D renderer here, and a
 * real model would mean shipping a binary asset and a WebGL runtime for a
 * 64-pixel avatar.
 *
 * Expression lives in the eyes, brows and mouth. Everything else is fixed, so he
 * stays recognisably one person across states.
 *
 * Beyond mood, he can look somewhere (`gaze`) and cover his eyes (`covering`,
 * with `peeking` for the half-look through the fingers). Those exist for the
 * sign-in form: watching the email being typed and then pointedly not watching
 * the password is the one place where the character does something useful rather
 * than decorative - it says "this field is secret" without a line of copy.
 */
export function AristoMascot({
  mood = 'idle',
  gaze,
  covering = false,
  peeking = false,
  className,
}: {
  mood?: MascotMood
  gaze?: MascotGaze
  /** Hands over the eyes. For secrets being typed, not for shyness. */
  covering?: boolean
  /** Hands still up, but lowered enough to look over them. */
  peeking?: boolean
  className?: string
}) {
  const reduceMotion = useReducedMotion()
  const [blinking, setBlinking] = useState(false)

  // Gradient and clip ids are per-instance. Two mascots on one page - the chat
  // header and an empty state - would otherwise share one set of defs, and the
  // first to unmount would take the other's fills with it.
  const uid = useId().replace(/:/g, '')
  const ref = (name: string) => `url(#${uid}-${name})`

  const hidden = covering && !peeking

  // Irregular intervals - a metronomic blink reads as a machine, not a face.
  // Suspended while the eyes are already shut behind the hands, so the timer is
  // not fighting the cover state for control of the same feature.
  useEffect(() => {
    if (reduceMotion || hidden) return
    let timer: ReturnType<typeof setTimeout>
    let unblink: ReturnType<typeof setTimeout>

    const schedule = () => {
      timer = setTimeout(
        () => {
          setBlinking(true)
          unblink = setTimeout(() => setBlinking(false), 130)
          schedule()
        },
        2800 + Math.random() * 3200
      )
    }

    schedule()
    return () => {
      clearTimeout(timer)
      clearTimeout(unblink)
    }
  }, [reduceMotion, hidden])

  /*
   * Gaze, resolved.
   *
   * With the eyes covered he turns away rather than holding the last direction:
   * a head still pointed at the password field with the hands up reads as
   * peeking through them, which is the opposite of the intended message.
   */
  const gx = hidden ? -0.85 : clamp(gaze?.x ?? 0)
  const gy = hidden
    ? 0.1
    : clamp(
        // Peeking means the secret is on screen and he is reading it with you,
        // so the default is down at the field rather than out at the viewer.
        gaze?.y ?? (peeking ? 0.7 : mood === 'thinking' ? -0.6 : 0)
      )

  // Two layers of the same movement. The head carries most of it and the pupils
  // carry a little more on top, which is what separates "turning to look" from
  // "the whole drawing slid sideways".
  const headMotion = { x: gx * 2.2, y: gy * 1.4, rotate: gx * 3.5 }
  const pupilMotion = { x: gx * 1.9, y: gy * 1.3 }
  const glance = reduceMotion
    ? { duration: 0 }
    : ({ type: 'spring', stiffness: 210, damping: 20, mass: 0.5 } as const)

  // 1 fully open, 0 shut. Pleased is a squint, not a blink - the crease of a
  // smile pushes the lower lid up, and eyes left wide open under a grin read
  // as alarm.
  const openness = hidden || blinking ? 0 : mood === 'pleased' ? 0.2 : 1

  return (
    <motion.svg
      viewBox="0 0 96 96"
      fill="none"
      role="img"
      aria-label="Aristo"
      className={cn('size-24', className)}
      // A slow vertical drift reads as breathing rather than animation. Held
      // still entirely when the reader has asked for reduced motion.
      animate={reduceMotion ? undefined : { y: [0, -3, 0] }}
      transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
    >
      <defs>
        {/* Every material is lit from the upper left. x1/y1 -> x2/y2 all run the
            same way for that reason; a gradient pointing the other way puts a
            second light in the scene and flattens the whole thing. */}
        <linearGradient id={`${uid}-skin`} x1="30" y1="20" x2="66" y2="66" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={SKIN.light} />
          <stop offset="0.55" stopColor={SKIN.base} />
          <stop offset="1" stopColor={SKIN.shade} />
        </linearGradient>
        <linearGradient id={`${uid}-hair`} x1="30" y1="12" x2="64" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={HAIR.light} />
          <stop offset="0.6" stopColor={HAIR.base} />
          <stop offset="1" stopColor={HAIR.shade} />
        </linearGradient>
        <linearGradient id={`${uid}-beard`} x1="34" y1="46" x2="60" y2="80" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={HAIR.light} />
          <stop offset="0.5" stopColor={HAIR.base} />
          <stop offset="1" stopColor={HAIR.shade} />
        </linearGradient>
        <linearGradient id={`${uid}-robe`} x1="20" y1="68" x2="76" y2="96" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={ROBE.light} />
          <stop offset="0.5" stopColor={ROBE.base} />
          <stop offset="1" stopColor={ROBE.shade} />
        </linearGradient>
        <radialGradient id={`${uid}-iris`} cx="0.38" cy="0.32" r="0.75">
          <stop offset="0" stopColor={IRIS.light} />
          <stop offset="0.62" stopColor={IRIS.base} />
          <stop offset="1" stopColor={IRIS.dark} />
        </radialGradient>
        <radialGradient id={`${uid}-sclera`} cx="0.5" cy="0.35" r="0.72">
          <stop offset="0" stopColor="oklch(0.995 0.003 90)" />
          <stop offset="1" stopColor="oklch(0.918 0.012 250)" />
        </radialGradient>
        {/* Bounced light from the ground plane, warming the underside of the
            face. Without it the jaw goes muddy where the beard shadow lands. */}
        <radialGradient id={`${uid}-bounce`} cx="0.5" cy="0.9" r="0.6">
          <stop offset="0" stopColor={SKIN.light} stopOpacity="0.75" />
          <stop offset="1" stopColor={SKIN.light} stopOpacity="0" />
        </radialGradient>
        <filter id={`${uid}-soft`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.7" />
        </filter>

        {/* One clip per eye. Sclera, iris and the travelling lid all live inside
            it, so the lid is bounded by the eye opening rather than a rectangle
            sliding across the cheek. */}
        {EYES.map((cx, i) => (
          <clipPath key={cx} id={`${uid}-eye${i}`}>
            <path
              d={`M${cx - 5.3} ${EYE_Y}q5.3-5.4 10.6 0q-5.3 4.9-10.6 0Z`}
            />
          </clipPath>
        ))}
        {/* The disc is also the frame: shoulders and robe run past the bottom
            edge and are cut off by it, which is what puts the figure *in* the
            badge instead of on top of one. */}
        <clipPath id={`${uid}-disc`}>
          <circle cx="48" cy="48" r="46" />
        </clipPath>
      </defs>

      {/* Ground disc, with a vignette that curves it. Kept on the theme token:
          it is the surface the character sits on, not part of the character. */}
      <circle cx="48" cy="48" r="46" className="fill-highlight-muted" />
      <circle cx="48" cy="48" r="46" fill={ref('bounce')} opacity="0.35" />
      <circle
        cx="48"
        cy="48"
        r="45"
        fill="none"
        stroke="oklch(0.3 0.04 60)"
        strokeOpacity="0.14"
        strokeWidth="2"
      />

      <g clipPath={ref('disc')}>
        {/* Shoulders and robe. The body is what stops the head reading as a
            balloon - a floating head has no weight regardless of shading. */}
        <path
          d="M6 96c2-16 14-24 26-27l16-4 16 4c12 3 24 11 26 27Z"
          fill={ref('robe')}
        />
        {/* Fold shadows, then the gold trim of the neckline over them. */}
        <path
          d="M32 70c6 5 10 12 12 26h-6c-2-12-4-19-9-24Z"
          fill={ROBE.shade}
          opacity="0.55"
        />
        <path
          d="M64 70c-6 5-10 12-12 26h6c2-12 4-19 9-24Z"
          fill={ROBE.shade}
          opacity="0.35"
        />
        <path
          d="M36 69l12 9 12-9"
          fill="none"
          stroke={GOLD}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.9"
        />

        {/* Contact shadow: the head onto the shoulders. Blurred, because a hard
            edge here reads as a collar. */}
        <ellipse
          cx="48"
          cy="70"
          rx="15"
          ry="4.5"
          fill={ROBE.shade}
          opacity="0.5"
          filter={ref('soft')}
        />

        {/* Neck, in shade - it sits under the jaw and never catches the key
            light. Lit at the same value as the face is the classic tell of a
            head pasted onto a body. */}
        <path d="M41 54h14v12q-7 5-14 0Z" fill={SKIN.shade} />
        <path d="M41 54h14v5q-7 4-14 0Z" fill={SKIN.deep} opacity="0.6" />
      </g>

      {/* Everything that turns with the head. Motion transforms SVG groups about
          their own bounding box, so the pivot lands in the middle of the face -
          the turn swings the jaw and the crown in opposite directions, which is
          what a head does. The neck and shoulders stay put outside this group. */}
      <motion.g animate={headMotion} transition={glance}>
        {/* Ears, behind the face so only the outer curve shows. */}
        {[30.2, 65.8].map((cx) => (
          <g key={cx}>
            <ellipse cx={cx} cy="45" rx="3.1" ry="4.4" fill={SKIN.base} />
            <ellipse cx={cx} cy="45.4" rx="1.4" ry="2.3" fill={SKIN.shade} opacity="0.7" />
          </g>
        ))}

        {/* The head. A tapered path rather than an ellipse: a wide brow narrowing
            through the cheekbones to a jaw is most of what makes a shape read as
            a face before any feature is drawn on it. */}
        <path
          d="M48 19c11 0 18 8 18 20 0 14-8 26-18 29-10-3-18-15-18-29 0-12 7-20 18-20Z"
          fill={ref('skin')}
        />
        {/* Bounced light along the jaw, and the key highlight on the forehead. */}
        <path
          d="M48 19c11 0 18 8 18 20 0 14-8 26-18 29-10-3-18-15-18-29 0-12 7-20 18-20Z"
          fill={ref('bounce')}
        />
        <ellipse
          cx="43"
          cy="29"
          rx="8.5"
          ry="5.5"
          fill={SKIN.light}
          opacity="0.5"
          filter={ref('soft')}
        />
        {/* Rim light down the shaded edge. Separates the head from the ground
            without an outline, which at this size would eat the modelling. */}
        <path
          d="M65.6 36c.6 12-6.6 25-16.6 31"
          fill="none"
          stroke={SKIN.light}
          strokeWidth="1.6"
          strokeOpacity="0.45"
          strokeLinecap="round"
        />
        {/* Cheeks. A little warmth stops the skin reading as plastic. */}
        {[37.5, 58.5].map((cx) => (
          <ellipse
            key={cx}
            cx={cx}
            cy="48"
            rx="4.6"
            ry="3.2"
            fill="oklch(0.72 0.11 32)"
            opacity="0.17"
            filter={ref('soft')}
          />
        ))}

        {/* Hair: a crown mass with a cast shadow onto the forehead beneath it,
            and two strand highlights so it has a surface rather than a colour. */}
        <path
          d="M29 39c-1-18 7-27 19-27s20 9 19 27c-3-11-9-16-19-16s-16 5-19 16Z"
          fill={ref('hair')}
        />
        <path
          d="M31 33c3-7 9-11 17-11s14 4 17 11c-4-5-10-8-17-8s-13 3-17 8Z"
          fill={HAIR.light}
          opacity="0.7"
        />
        <path
          d="M30 38c4-11 10-16 18-16s14 5 18 16c-3-4-6-6-9-7-6-2-12-2-18 0-3 1-6 3-9 7Z"
          fill={SKIN.deep}
          opacity="0.25"
          filter={ref('soft')}
        />

        {/*
         * Laurel wreath. The one saturated element on the figure, and the reason
         * the badge reads as a scholar at 40px, where the beard alone could be a
         * beard on anyone.
         *
         * Leaves are placed by hand along the temple-to-crown arc rather than
         * generated: an even distribution looks printed, and the gaps are what
         * make it a wreath of leaves rather than a green band.
         */}
        {[false, true].map((mirrored) => (
          <g
            key={String(mirrored)}
            transform={mirrored ? 'translate(96,0) scale(-1,1)' : undefined}
          >
            {[
              { x: 27.5, y: 44, r: -108 },
              { x: 26.2, y: 36, r: -94 },
              { x: 27.4, y: 28.5, r: -74 },
              { x: 31.5, y: 22, r: -56 },
              { x: 37.5, y: 17.5, r: -36 },
            ].map((leaf) => (
              <g
                key={`${leaf.x}-${leaf.y}`}
                transform={`translate(${leaf.x} ${leaf.y}) rotate(${leaf.r})`}
              >
                <path
                  d="M0 0c2.4-2.4 5.8-2 7.6 0-1.8 2-5.2 2.4-7.6 0Z"
                  fill={LEAF.base}
                />
                <path d="M0 0c2.4-2.4 5.8-2 7.6 0-2.6-.9-5.2-.6-7.6 0Z" fill={LEAF.shade} opacity="0.55" />
                <path d="M0.6 0h6.4" stroke={LEAF.shade} strokeWidth="0.5" opacity="0.7" />
              </g>
            ))}
            {/* Berries: the gold that ties the wreath to the neckline trim. */}
            {[
              { x: 26.8, y: 40.2 },
              { x: 29.3, y: 24.8 },
            ].map((berry) => (
              <circle key={berry.y} cx={berry.x} cy={berry.y} r="1.35" fill={GOLD} />
            ))}
          </g>
        ))}

        {/* Brows. Filled and tapered rather than stroked: a stroke of even width
            is a line, and a brow is a wedge. They lift with an upward glance,
            which is most of what makes it read as interest. */}
        <motion.g animate={{ y: gy * 0.9 }} transition={glance}>
          {[false, true].map((mirrored) => (
            <g
              key={String(mirrored)}
              transform={mirrored ? 'translate(96,0) scale(-1,1)' : undefined}
            >
              <path
                d={
                  mood === 'concerned'
                    ? 'M33.6 35.4c3.4-3.4 8.2-3.6 11.4-1l-.7 3.1c-3-2.4-7-2.4-10.7-.4Z'
                    : 'M33.4 36.6c3.6-3.6 8.4-4.2 11.6-2.2l-.5 2.9c-3.2-1.8-7.4-1.4-11.1 1.4Z'
                }
                fill={HAIR.shade}
              />
            </g>
          ))}
        </motion.g>

        {/* Eye sockets. A shadow under the brow is what sets the eyes back into
            the head instead of sitting them on the surface. */}
        {EYES.map((cx) => (
          <ellipse
            key={cx}
            cx={cx}
            cy={EYE_Y - 0.6}
            rx="6.2"
            ry="4"
            fill={SKIN.shade}
            opacity="0.3"
            filter={ref('soft')}
          />
        ))}

        {EYES.map((cx, i) => (
          <g key={cx}>
            <g clipPath={ref(`eye${i}`)}>
              <ellipse cx={cx} cy={EYE_Y} rx="5.4" ry="3.6" fill={ref('sclera')} />
              {/* Shadow the sclera casts from the upper lid - the detail that
                  stops a white eye looking like a hole punched in the face. */}
              <ellipse
                cx={cx}
                cy={EYE_Y - 3.4}
                rx="5.4"
                ry="2.6"
                fill={SKIN.deep}
                opacity="0.3"
              />

              <motion.g animate={pupilMotion} transition={glance}>
                <circle cx={cx} cy={EYE_Y} r="2.75" fill={ref('iris')} />
                {/* Limbal ring. Real irises have one, and without it the colour
                    bleeds into the sclera and the eye loses focus. */}
                <circle
                  cx={cx}
                  cy={EYE_Y}
                  r="2.75"
                  fill="none"
                  stroke={IRIS.dark}
                  strokeWidth="0.6"
                  strokeOpacity="0.8"
                />
                <circle cx={cx} cy={EYE_Y} r="1.25" fill="oklch(0.18 0.02 250)" />
                {/* Catchlight up-left with the key, plus a dim bounce down-right.
                    Two lights in the eye specifically: this is the one place a
                    second source helps, because it is a wet sphere. */}
                <circle cx={cx - 1} cy={EYE_Y - 1.1} r="0.95" fill="white" opacity="0.95" />
                <circle cx={cx + 1.1} cy={EYE_Y + 1} r="0.5" fill="white" opacity="0.4" />
              </motion.g>

              {/* The lid, drawn shut and lifted out of the way when open. */}
              <motion.g
                animate={{ y: LID_LIFT * openness }}
                transition={
                  reduceMotion ? { duration: 0 } : { duration: 0.11, ease: 'easeOut' }
                }
              >
                <path
                  d={`M${cx - 7} ${EYE_Y - 12}h14v13.4q-7 3.6-14 0Z`}
                  fill={SKIN.base}
                />
                <path
                  d={`M${cx - 7} ${EYE_Y + 1.4}q7 3.6 14 0`}
                  fill="none"
                  stroke={INK}
                  strokeWidth="1.1"
                  strokeOpacity="0.75"
                  strokeLinecap="round"
                />
              </motion.g>
            </g>

            {/* Lash line over the clip, so the top of the eye keeps its weight
                whatever the lid is doing underneath. */}
            <path
              d={`M${cx - 5.4} ${EYE_Y}q5.4-5.6 10.8 0`}
              fill="none"
              stroke={INK}
              strokeWidth="1.3"
              strokeOpacity="0.85"
              strokeLinecap="round"
            />
            <path
              d={`M${cx - 4.6} ${EYE_Y + 1.9}q4.6 2.4 9.2 0`}
              fill="none"
              stroke={SKIN.deep}
              strokeWidth="0.8"
              strokeOpacity="0.5"
              strokeLinecap="round"
            />
          </g>
        ))}

        {/* Nose. Three marks only: a shaded flank, a lit bridge, and nostrils.
            An outlined nose at this scale reads as a scar. */}
        <path
          d="M47.6 38.5c-.8 4-2.4 7.4-3.4 9.4-.8 1.8.4 3.4 3.8 3.6"
          fill="none"
          stroke={SKIN.deep}
          strokeWidth="1.5"
          strokeOpacity="0.42"
          strokeLinecap="round"
        />
        <path
          d="M48.8 39c.4 4 1.2 7.2 1.8 9"
          fill="none"
          stroke={SKIN.light}
          strokeWidth="1.4"
          strokeOpacity="0.6"
          strokeLinecap="round"
        />
        <ellipse cx="48" cy="50.2" rx="3.2" ry="2.1" fill={SKIN.light} opacity="0.35" filter={ref('soft')} />
        {[45.4, 50.6].map((cx) => (
          <ellipse key={cx} cx={cx} cy="50.6" rx="0.95" ry="0.65" fill={INK} opacity="0.55" />
        ))}

        {/*
         * Beard. Built as a mass with locks cut into its lower edge rather than
         * a single smooth shape - a smooth beard is a bib. The moustache is a
         * separate piece so the mouth can move independently underneath it.
         */}
        <path
          d="M30.5 43c0 8 1.5 15 4 21 2.6 6.4 7.6 11.4 13.5 14 5.9-2.6 10.9-7.6 13.5-14 2.5-6 4-13 4-21-1.5 7-4 11.5-7 14-3 2.4-6.6 3.6-10.5 3.6s-7.5-1.2-10.5-3.6c-3-2.5-5.5-7-7-14Z"
          fill={ref('beard')}
        />
        <path
          d="M38 68c2.6 4.4 6 7.6 10 9.6 4-2 7.4-5.2 10-9.6-2.4 5.6-5.6 9.4-10 11.6-4.4-2.2-7.6-6-10-11.6Z"
          fill={HAIR.shade}
          opacity="0.55"
        />
        {/* Strand highlights. Blurred strokes, not filled shapes: a hard-edged
            light shape on a beard reads as a blade laid across the chin. */}
        <path
          d="M41.5 55c1 6.5 3 12 5.5 16"
          fill="none"
          stroke={HAIR.light}
          strokeWidth="2.6"
          strokeOpacity="0.45"
          strokeLinecap="round"
          filter={ref('soft')}
        />
        <path
          d="M55 55c-.8 6-2.4 11-4.4 14.5"
          fill="none"
          stroke={HAIR.light}
          strokeWidth="1.8"
          strokeOpacity="0.28"
          strokeLinecap="round"
          filter={ref('soft')}
        />
        {/* Where the beard meets the cheek: contact shadow, not a hard border. */}
        <path
          d="M31 44c1.5 7 4 11.5 7 14 3 2.4 6.6 3.6 10 3.6s7-1.2 10-3.6c3-2.5 5.5-7 7-14"
          fill="none"
          stroke={SKIN.deep}
          strokeWidth="2"
          strokeOpacity="0.22"
          filter={ref('soft')}
        />

        {/* Mouth, in the gap between the moustache and the beard. */}
        <path
          d={
            mood === 'concerned'
              ? 'M43.2 58.6q4.8-3.2 9.6 0'
              : mood === 'pleased'
                ? 'M42.4 56.4q5.6 5.4 11.2 0'
                : 'M43.2 57.4q4.8 1.8 9.6 0'
          }
          fill="none"
          stroke="oklch(0.42 0.075 30)"
          strokeWidth="2"
          strokeLinecap="round"
        />

        <path
          d="M38.4 51.8c2.6-2.4 6-2.6 9.6-.6 3.6-2 7-1.8 9.6.6 1 1 .4 2.2-1 3.4-2.4 2-5.2 2.4-8.6 1.2-3.4 1.2-6.2.8-8.6-1.2-1.4-1.2-2-2.4-1-3.4Z"
          fill={ref('beard')}
        />
        <path
          d="M39.6 52.4c2.2-1.8 5-1.8 8.4.2 3.4-2 6.2-2 8.4-.2-2.4-1-5.2-.6-8.4 1-3.2-1.6-6-2-8.4-1Z"
          fill={HAIR.light}
          opacity="0.6"
        />
      </motion.g>

      {/*
       * Hands.
       *
       * Outside the head group on purpose: they belong to the body, so they do
       * not swing with the turn - the face turns away behind them, which is what
       * sells the gesture. They enter from the beard line rather than fading in,
       * because a hand that materialises over the eyes reads as a bug.
       */}
      {/* The clip lives on this static wrapper, not on the animated group: a
          clip-path is resolved in the coordinate system the element's own
          transform establishes, so clipping the moving group would drag the
          disc down with the hands and let the sleeves out the bottom. */}
      <g clipPath={ref('disc')}>
        <AnimatePresence>
          {covering && (
            <motion.g
              initial={reduceMotion ? false : { y: 24, opacity: 0 }}
              // Peeking drops the whole hand until the fingertips clear the
              // lower lash line - the palms end up over the beard. Anything less
              // leaves fingers across the pupils, which is not a peek, it is a
              // blindfold.
              animate={{ y: peeking ? 16.5 : 0, opacity: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { y: 24, opacity: 0 }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { type: 'spring', stiffness: 260, damping: 24, mass: 0.6 }
              }
            >
              {[false, true].map((mirrored) => (
                <g
                  key={String(mirrored)}
                  transform={mirrored ? 'translate(96,0) scale(-1,1)' : undefined}
                >
                  {/*
                   * One arm, built at the left eye and mirrored for the right.
                   *
                   * Fingers up over the brow with the palm on the eye, tilted a
                   * few degrees off vertical. The tilt is not decoration: two
                   * upright rounded rectangles side by side stop being hands and
                   * become a pair of goggles, and the scalloped fingertips are
                   * what the eye reads as a hand before anything else.
                   */}
                  <g transform="translate(40.2 43.6) rotate(-9)">
                    {/* Sleeve, cuff, then the forearm out of it. Hands with no
                        arms float; an arm with no sleeve is a plank of skin laid
                        over the robe. The sleeve runs past the bottom of the
                        badge and is cut off by the disc clip on the wrapper. */}
                    <path d="M-10.4 15-14.6 56h27.6l-3.4-41Z" fill={ROBE.base} />
                    <path
                      d="M-10.4 15-12.6 36l5.4 1L-5 15Z"
                      fill={ROBE.shade}
                      opacity="0.55"
                    />
                    {/* Cuff. Also the only thing separating a navy sleeve from
                        the navy robe behind it. */}
                    <path d="M-10.4 15-11 19.4h21.6l-.6-4.4Z" fill={ROBE.light} />
                    <path
                      d="M-10.7 17.2h21.4"
                      stroke={GOLD}
                      strokeWidth="1.1"
                      strokeOpacity="0.9"
                    />
                    <path d="M-7 2-9.6 16.5h19.2L7 2Z" fill={SKIN.shade} />
                    <path
                      d="M-7 2-8.8 15l3.4.5L-3.8 2Z"
                      fill={SKIN.light}
                      opacity="0.3"
                    />

                    {/* The shadow the hand casts on the face - the depth cue that
                        puts it in front rather than on the same plane. */}
                    <rect
                      x="-6.6"
                      y="-13"
                      width="16"
                      height="22"
                      rx="5"
                      fill={SKIN.deep}
                      opacity="0.35"
                      filter={ref('soft')}
                    />

                    <rect
                      x="-7.6"
                      y="-6.4"
                      width="15.2"
                      height="13"
                      rx="4.6"
                      fill={SKIN.base}
                      stroke={SKIN.deep}
                      strokeWidth="0.8"
                      strokeOpacity="0.45"
                    />
                    {/* Four fingers, over the palm so the seams between them
                        show. Tips rounded by the radius, which is the whole
                        read at 40px. */}
                    {[0, 1, 2, 3].map((i) => (
                      <rect
                        key={i}
                        x={-6.9 + i * 3.5}
                        y={-14.2 + i * 0.5}
                        width="3.1"
                        height={12 - i * 0.5}
                        rx="1.55"
                        fill={SKIN.base}
                        stroke={SKIN.deep}
                        strokeWidth="0.7"
                        strokeOpacity="0.4"
                      />
                    ))}
                    {/* Thumb, tucked along the inner edge and angled across the
                        palm the way a thumb actually lies. */}
                    <rect
                      x="4.6"
                      y="-2.2"
                      width="3"
                      height="8.4"
                      rx="1.5"
                      fill={SKIN.base}
                      stroke={SKIN.deep}
                      strokeWidth="0.7"
                      strokeOpacity="0.4"
                      transform="rotate(28 6.1 2)"
                    />
                    {/* Key light on the knuckles, shade under the palm. */}
                    <path
                      d="M-6.4-3.8c1.4-2.6 4-3.6 7-3.6 2.2 0 4 .5 5.4 1.6-1.6-.6-3.4-.9-5.4-.9-2.8 0-5.2.9-7 2.9Z"
                      fill={SKIN.light}
                      opacity="0.75"
                    />
                    <path
                      d="M-7.2 3.4c1.8 2.4 4.6 3.4 7.6 3.4s5.8-1 7.6-3.4c-.6 2.6-3.6 4.2-7.6 4.2s-7-1.6-7.6-4.2Z"
                      fill={SKIN.deep}
                      opacity="0.4"
                    />
                  </g>
                </g>
              ))}
            </motion.g>
          )}
        </AnimatePresence>
      </g>

      {/* Thinking dots, above the brow. These sit on the disc rather than the
          face, so they take the theme token and stay visible on either ground. */}
      {mood === 'thinking' && (
        <g className="text-highlight">
          {[0, 1, 2].map((i) => (
            <motion.circle
              key={i}
              cx={74 + i * 6.5}
              cy={22 - i * 5}
              r={1.6 + i * 0.5}
              fill="currentColor"
              animate={reduceMotion ? undefined : { opacity: [0.25, 1, 0.25] }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: i * 0.22,
                ease: 'easeInOut',
              }}
              // Without motion the dots must still be visible, not mid-fade.
              style={reduceMotion ? { opacity: 0.7 } : undefined}
            />
          ))}
        </g>
      )}
    </motion.svg>
  )
}
