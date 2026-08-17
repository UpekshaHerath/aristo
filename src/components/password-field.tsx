'use client'

import { useId, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

/**
 * A password input you can actually check before submitting.
 *
 * Two things a bare `type="password"` gets wrong on a phone, which is where
 * most of these students are: there is no way to confirm what you typed after
 * autocorrect has had a go at it, and a stuck Caps Lock produces a wrong-password
 * error with no hint as to why. Both are handled here.
 */
export function PasswordField({
  label = 'Password',
  value,
  onChange,
  autoComplete,
  placeholder,
  minLength,
  required = true,
  hint,
  className,
}: {
  label?: string
  value: string
  onChange: (value: string) => void
  autoComplete?: string
  placeholder?: string
  minLength?: number
  required?: boolean
  /** Shown under the field - requirements, not errors. */
  hint?: string
  className?: string
}) {
  const id = useId()
  const [revealed, setRevealed] = useState(false)
  const [capsLock, setCapsLock] = useState(false)

  // Read the modifier from the event rather than tracking keydown/keyup: this
  // stays correct when Caps Lock was already on before the field was focused.
  const trackCapsLock = (event: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLock(event.getModifierState?.('CapsLock') ?? false)
  }

  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={id}>{label}</Label>

      <div className="relative">
        <Input
          id={id}
          // Toggling the type is what reveals the value. The field keeps its
          // autocomplete token either way, so password managers still fill it.
          type={revealed ? 'text' : 'password'}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={trackCapsLock}
          onKeyUp={trackCapsLock}
          onBlur={() => setCapsLock(false)}
          // Room for the toggle, so a long password never runs under the icon.
          className="pr-10"
        />

        <button
          type="button"
          // Without this the button submits the form on Enter in some browsers,
          // which would sign the student in when they meant to peek.
          onClick={() => setRevealed((current) => !current)}
          aria-label={revealed ? 'Hide password' : 'Show password'}
          aria-pressed={revealed}
          aria-controls={id}
          className="-translate-y-1/2 absolute top-1/2 right-1 flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors duration-(--duration-fast) hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-1"
        >
          {revealed ? (
            <EyeOff className="size-4" />
          ) : (
            <Eye className="size-4" />
          )}
        </button>
      </div>

      {capsLock ? (
        <p role="status" className="text-highlight text-xs">
          Caps Lock is on.
        </p>
      ) : hint ? (
        <p className="text-muted-foreground text-xs">{hint}</p>
      ) : null}
    </div>
  )
}
