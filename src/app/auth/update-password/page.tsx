'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { PasswordField } from '@/components/password-field'
import { MIN_PASSWORD_LENGTH } from '@/lib/password'
import {
  AristoMascot,
  type MascotMood,
} from '@/components/brand/aristo-mascot'

/**
 * Where a password-reset link lands.
 *
 * /auth/callback has already exchanged the emailed code for a session by the
 * time this renders, so the student is authenticated and `updateUser` is all
 * that remains. The session check below is what stops this page being a form
 * that silently fails for anyone who navigates to it directly.
 */
export default function UpdatePasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(true)
  const [authorised, setAuthorised] = useState(false)

  /*
   * The same eye-covering gesture the sign-in and sign-up forms use.
   *
   * Two password fields here rather than one, and the gesture is about whether a
   * secret is on screen at all - so the states are tracked per field and folded
   * together. Counting focus alone would drop his hands the instant the student
   * tabbed from "New password" to "Confirm", which is the one moment both
   * secrets are on screen at once.
   */
  const [focusedFields, setFocusedFields] = useState(0)
  const [revealedFields, setRevealedFields] = useState(0)

  /*
   * Which fields have been left or submitted at least once.
   *
   * Requirements are checked continuously but only *shown* once a field has
   * been touched. Validating from the first keystroke means telling a student
   * their password is too short while they are still on the second character,
   * which reads as the form arguing with them rather than helping.
   */
  const [touched, setTouched] = useState({ password: false, confirm: false })
  const touch = (field: 'password' | 'confirm') =>
    setTouched((current) => ({ ...current, [field]: true }))

  /*
   * Rejection the server would issue, stated up front instead.
   *
   * Supabase enforces the minimum too, but only once the form is submitted and
   * only as a sentence written for a developer. Checking here means the student
   * sees the rule under the field it belongs to, before they have committed to
   * anything.
   */
  const tooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH
  const mismatch = confirm.length > 0 && password !== confirm

  const passwordError =
    touched.password && tooShort
      ? `Use at least ${MIN_PASSWORD_LENGTH} characters - that one is ${password.length}.`
      : null
  // Reported under the confirmation, not the new password: that is the field
  // the student has to change to resolve it.
  const confirmError =
    touched.confirm && mismatch ? 'Those two passwords don’t match.' : null

  // A counter, not a boolean per field: focus moves between the two fields
  // without passing through neither, and a shared flag would flicker on the
  // handover.
  const trackFocus = (focused: boolean) =>
    setFocusedFields((count) => Math.max(0, count + (focused ? 1 : -1)))
  const trackReveal = (revealed: boolean) =>
    setRevealedFields((count) => Math.max(0, count + (revealed ? 1 : -1)))

  const mascotMood: MascotMood = pending
    ? 'thinking'
    : error || passwordError || confirmError
      ? 'concerned'
      : 'idle'

  useEffect(() => {
    const check = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setAuthorised(Boolean(user))
      setChecking(false)
    }
    check()
  }, [])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    /*
     * Submitting counts as touching both fields.
     *
     * Someone who fills the form without ever leaving a field - typing, then
     * going straight for the button - has touched neither, so every message
     * would still be suppressed and the button would appear to do nothing.
     */
    setTouched({ password: true, confirm: true })

    // Checked here as well as rendered under the fields: the messages above are
    // suppressed until touched, so this is what actually stops the request.
    // Supabase would otherwise accept the first value and the student would
    // never learn the two didn't match.
    if (password.length < MIN_PASSWORD_LENGTH || password !== confirm) {
      setError(null)
      return
    }

    setPending(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    setPending(false)

    if (error) {
      setError(error.message)
      return
    }

    router.push('/chat')
    router.refresh()
  }

  if (checking) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-4">
        <Spinner className="size-5 text-muted-foreground" />
      </main>
    )
  }

  if (!authorised) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm space-y-5 text-center">
          <AristoMascot mood="concerned" className="mx-auto size-16" />
          <h1 className="font-display text-2xl tracking-tight">
            That link has expired
          </h1>
          <p className="text-balance text-muted-foreground text-sm">
            Reset links can only be used once, and they don’t last long. Request
            a fresh one from the sign-in page.
          </p>
          <Button className="w-full" onClick={() => router.push('/login')}>
            Back to sign in
          </Button>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex animate-rise flex-col items-center gap-2.5 text-center">
          <AristoMascot
            mood={mascotMood}
            // Revealed counts as engaged even without focus: a password sitting
            // visible on screen is still the moment the gesture is about.
            covering={focusedFields > 0 || revealedFields > 0}
            peeking={revealedFields > 0}
            // Matches the sign-in page, where the gesture is the thing the
            // student is meant to notice.
            className="size-20"
          />
          <h1 className="font-display text-3xl tracking-tight">
            Choose a new password
          </h1>
          <p className="text-balance text-muted-foreground text-sm">
            You’ll be signed in straight afterwards.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <PasswordField
            label="New password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
            error={passwordError ?? undefined}
            onFocusChange={trackFocus}
            onRevealChange={trackReveal}
            onBlur={() => touch('password')}
          />

          <PasswordField
            label="Confirm new password"
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            error={confirmError ?? undefined}
            onFocusChange={trackFocus}
            onRevealChange={trackReveal}
            onBlur={() => touch('confirm')}
          />

          {error ? (
            <p
              role="alert"
              className="animate-rise rounded-md border border-destructive/30 bg-destructive/8 px-3 py-2 text-destructive text-sm"
            >
              {error}
            </p>
          ) : null}

          <Button
            type="submit"
            className="w-full"
            disabled={pending || !password || !confirm}
          >
            {pending && <Spinner className="size-4" />}
            {pending ? 'Saving…' : 'Save password'}
          </Button>
        </form>
      </div>
    </main>
  )
}
