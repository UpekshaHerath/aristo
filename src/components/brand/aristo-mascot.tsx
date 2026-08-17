'use client'

import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

export type MascotMood = 'idle' | 'thinking' | 'pleased' | 'concerned'

/**
 * The character's ink. Fixed rather than tokenised, so hair, beard and features
 * keep the same relationship to the cream face in both themes.
 */
const INK = 'oklch(0.472 0.088 62)'

/**
 * Aristo, the character.
 *
 * An original scholar silhouette - a broad brow and a squared beard - not a
 * caricature of any real person. That is a deliberate constraint: a recognisable
 * likeness of a historical figure carries publicity and trademark exposure that
 * a student product should not take on, and a physicist in particular would
 * misread the scope of a tutor that also covers History and Biology.
 *
 * Expression is carried entirely by the eyes and mouth, which are the only parts
 * that change between moods. Everything else is fixed, so the character stays
 * recognisably one person across states.
 *
 * Shown only at low-stakes moments - the empty state, while thinking, and on an
 * error. It is deliberately absent while a student is reading an answer, where
 * a moving figure would compete with the content for attention.
 */
export function AristoMascot({
  mood = 'idle',
  className,
}: {
  mood?: MascotMood
  className?: string
}) {
  const reduceMotion = useReducedMotion()
  const [blinking, setBlinking] = useState(false)

  // Irregular intervals - a metronomic blink reads as a machine, not a face.
  useEffect(() => {
    if (reduceMotion) return
    let timer: ReturnType<typeof setTimeout>

    const schedule = () => {
      timer = setTimeout(
        () => {
          setBlinking(true)
          setTimeout(() => setBlinking(false), 140)
          schedule()
        },
        2800 + Math.random() * 3200
      )
    }

    schedule()
    return () => clearTimeout(timer)
  }, [reduceMotion])

  const eyesClosed = blinking || mood === 'pleased'

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
      {/* Ground disc. Keeps the figure anchored at any size. */}
      <circle cx="48" cy="48" r="46" className="fill-highlight-muted" />

      {/*
       * The face is a fixed warm cream, NOT a theme token.
       *
       * Two failure modes this avoids. Filling it with the disc colour makes it
       * invisible, leaving a ring of hair and beard that reads as a hood. Filling
       * it with `--background` inverts it in dark mode, so the face becomes a
       * dark hole inside a gold frame and the character reads as a mask.
       *
       * A face is brand art, like a logo: it keeps one palette on every ground.
       */}
      <ellipse cx="48" cy="42.5" rx="18" ry="18.5" fill="oklch(0.968 0.022 80)" />

      {/*
       * Everything drawn on the face shares the face's fixed palette, for the
       * same reason. `--highlight` lightens to 0.786 in dark mode, which against
       * a 0.968 cream face leaves the eyes and brows almost invisible.
       */}
      {/* Hair: a crescent cap over the crown, thickest at the temples. */}
      <path
        fill={INK}
        d="M30 38c0-20 8-26 18-26s18 6 18 26c-4-12-10-16-18-16s-14 4-18 16Z"
      />

      {/*
       * Beard: narrower than the face and tapering to a point. A beard as wide
       * as the head merges with the hair into a single silhouette; a pointed one
       * leaves the cheeks bare, which is what makes it read as a face.
       */}
      <path
        fill={INK}
        d="M36 50c0 13 4 24 12 27 8-3 12-14 12-27-4 5-7 7-12 7s-8-2-12-7Z"
      />

      {/* Heavy brows. After the beard, the strongest "considered" signal. */}
      <g stroke={INK} strokeWidth="2.6" strokeLinecap="round">
        <path d={mood === 'concerned' ? 'M36 34l7 3' : 'M36 35.5h7'} />
        <path d={mood === 'concerned' ? 'M60 34l-7 3' : 'M60 35.5h-7'} />
      </g>

      {/* Eyes. Open eyes are discs; a blink or a pleased squint is an arc. */}
      <g fill={INK} stroke={INK}>
        {[40, 56].map((cx) =>
          eyesClosed ? (
            <path
              key={cx}
              d={`M${cx - 3.4} 44q3.4 3 6.8 0`}
              strokeWidth="2.2"
              strokeLinecap="round"
              fill="none"
            />
          ) : (
            <circle
              key={cx}
              cx={cx}
              // Looks up and away while thinking - the universal "working on it".
              cy={mood === 'thinking' ? 42.5 : 44}
              r="2.5"
              stroke="none"
            />
          )
        )}
      </g>

      {/* Mouth, in the gap between cheeks and the top edge of the beard. */}
      <path
        d={
          mood === 'concerned'
            ? 'M44 52q4-2.6 8 0'
            : mood === 'pleased'
              ? 'M43 50q5 4.4 10 0'
              : 'M44.5 51h7'
        }
        stroke={INK}
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />

      {/* Thinking dots, above the brow. These sit on the disc rather than the
          face, so they take the theme token and stay visible on either ground. */}
      {mood === 'thinking' && (
        <g className="text-highlight">
          {[0, 1, 2].map((i) => (
            <motion.circle
              key={i}
              cx={72 + i * 7}
              cy={20 - i * 5}
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
