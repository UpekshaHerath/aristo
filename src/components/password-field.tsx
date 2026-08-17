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
  error,
  className,
  onFocusChange,
  onRevealChange,
  onBlur,
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
  /**
   * What is wrong with this field. Takes the hint's place while set, so the
   * requirement and the complaint about it never stack up as two lines saying
   * nearly the same thing.
   */
  error?: string
  className?: string
  /*
   * Both optional, and only for reacting to the field - never for reading it.
   * The sign-in page uses them to cover the mascot's eyes while a password is
   * on screen, which is a fact about focus and visibility, not about the value.
   */
  onFocusChange?: (focused: boolean) => void
  onRevealChange?: (revealed: boolean) => void
  /** Fired when focus leaves the field itself - the moment to start validating. */
  onBlur?: () => void
}) {
  const id = useId()
  const messageId = `${id}-message`
  const [revealed, setRevealed] = useState(false)
  const [capsLock, setCapsLock] = useState(false)

  /*
   * One line under the field, never a stack of them.
   *
   * Order is by what blocks the student. An error is the reason the form will
   * not go through, so it wins; Caps Lock is a warning about what they are
   * typing, which beats the hint restating a requirement they can already read.
   */
  const message = error ?? (capsLock ? 'Caps Lock is on.' : hint)

  // Read the modifier from the event rather than tracking keydown/keyup: this
  // stays correct when Caps Lock was already on before the field was focused.
  const trackCapsLock = (event: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLock(event.getModifierState?.('CapsLock') ?? false)
  }

  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={id}>{label}</Label>

      {/*
       * Focus is reported for the group, not the input.
       *
       * Focus events bubble in React, so pressing the reveal toggle - which
       * takes focus off the input - still counts as being in the field. Reporting
       * the input alone made the toggle read as leaving the field entirely, and
       * the mascot dropped its hands instead of peeking over them.
       *
       * `relatedTarget` is where focus is going; inside this group it is a move
       * between the input and its own button, not an exit.
       */}
      <div
        className="relative"
        onFocus={() => onFocusChange?.(true)}
        onBlur={(event) => {
          if (event.currentTarget.contains(event.relatedTarget)) return
          onFocusChange?.(false)
        }}
      >
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
          onBlur={() => {
            setCapsLock(false)
            onBlur?.()
          }}
          aria-invalid={error ? true : undefined}
          // Points at whichever line is currently under the field, so a screen
          // reader announces the complaint along with the field rather than
          // leaving it as loose text further down the form.
          aria-describedby={message ? messageId : undefined}
          // Room for the toggle, so a long password never runs under the icon.
          className="pr-10"
        />

        <button
          type="button"
          // Without this the button submits the form on Enter in some browsers,
          // which would sign the student in when they meant to peek.
          //
          // Keeps the caret in the field: peeking mid-password should not cost
          // you your place. It also keeps focus tracking honest - Safari and
          // Firefox do not focus a button on click, so without this the group
          // would report a blur to nowhere and the mascot would drop its hands.
          onMouseDown={(event) => event.preventDefault()}
          // Next value computed here rather than in a state updater: React may
          // run an updater twice, and a parent callback fired from inside one
          // would fire twice with it.
          onClick={() => {
            const next = !revealed
            setRevealed(next)
            onRevealChange?.(next)
          }}
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

      {message ? (
        <p
          id={messageId}
          // Errors are announced, hints are not - a hint read out on focus is
          // noise, an unexplained rejected form is not.
          role={error ? 'alert' : capsLock ? 'status' : undefined}
          className={cn(
            'text-xs',
            error
              ? 'text-destructive'
              : capsLock
                ? 'text-highlight'
                : 'text-muted-foreground'
          )}
        >
          {message}
        </p>
      ) : null}
    </div>
  )
}
