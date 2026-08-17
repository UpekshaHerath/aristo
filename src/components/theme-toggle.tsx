'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Monitor, Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'

const OPTIONS = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'system', label: 'System', Icon: Monitor },
  { value: 'dark', label: 'Dark', Icon: Moon },
] as const

/**
 * Three-state control rather than a two-way switch: "system" is the default and
 * a binary toggle gives no way back to it once touched.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Theme is unknowable until hydration; rendering a guess causes a visible flip.
  useEffect(() => setMounted(true), [])

  return (
    <div
      role="group"
      aria-label="Colour theme"
      className="inline-flex items-center gap-0.5 rounded-full border bg-card p-0.5"
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = mounted && theme === value
        return (
          <button
            key={value}
            type="button"
            aria-label={label}
            aria-pressed={active}
            onClick={() => setTheme(value)}
            className={cn(
              'flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors',
              'focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-1',
              // A colour shift on a 14px icon is easy to miss, so the target
              // itself lights up - which also shows how big the target is.
              'hover:bg-accent/60 hover:text-foreground',
              active && 'bg-accent text-foreground'
            )}
          >
            <Icon className="size-3.5" />
          </button>
        )
      })}
    </div>
  )
}
