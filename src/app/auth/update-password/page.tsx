'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { PasswordField } from '@/components/password-field'
import { AristoMascot } from '@/components/brand/aristo-mascot'

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

    // Caught here rather than at the API: Supabase would happily accept the
    // first value and the student would never learn the two didn't match.
    if (password !== confirm) {
      setError('Those two passwords don’t match.')
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
          <AristoMascot mood="idle" className="size-16" />
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
            minLength={8}
            hint="At least 8 characters."
          />

          <PasswordField
            label="Confirm new password"
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
            minLength={8}
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
