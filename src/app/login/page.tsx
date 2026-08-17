'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { AristoMascot } from '@/components/brand/aristo-mascot'

type Mode = 'signin' | 'signup'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? '/chat'

  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(searchParams.get('error'))
  const [notice, setNotice] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPending(true)
    setError(null)
    setNotice(null)

    const supabase = createClient()

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      })
      setPending(false)
      if (error) {
        setError(error.message)
        return
      }
      setNotice('Check your email to confirm your account, then sign in.')
      return
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setPending(false)
    if (error) {
      setError(error.message)
      return
    }

    router.push(next)
    router.refresh()
  }

  const handleMagicLink = async () => {
    if (!email) {
      setError('Enter your email address first.')
      return
    }
    setPending(true)
    setError(null)
    setNotice(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    })
    setPending(false)

    if (error) {
      setError(error.message)
      return
    }
    setNotice(`Sign-in link sent to ${email}.`)
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      {/* A single soft wash behind the card. Keeps the sign-in screen from
          reading as a bare form on a flat ground, without adding a decorative
          element that has to be maintained. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-72 bg-[radial-gradient(60%_100%_at_50%_0%,var(--color-highlight-muted),transparent_70%)] opacity-60"
      />

      <div className="relative w-full max-w-sm space-y-6">
        <div className="flex animate-rise flex-col items-center gap-2.5 text-center">
          <AristoMascot mood="pleased" className="size-16" />
          <h1 className="font-display text-3xl tracking-tight">Aristo</h1>
          <p className="text-balance text-muted-foreground text-sm">
            Syllabus-grounded revision help for Cambridge candidates.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@school.edu"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'signup' ? 'At least 8 characters' : ''}
            />
          </div>

          {error ? (
            <p
              role="alert"
              className="animate-rise rounded-md border border-destructive/30 bg-destructive/8 px-3 py-2 text-destructive text-sm"
            >
              {error}
            </p>
          ) : null}
          {notice ? (
            <p
              role="status"
              className="animate-rise rounded-md border border-primary/25 bg-primary/8 px-3 py-2 text-foreground/90 text-sm"
            >
              {notice}
            </p>
          ) : null}

          {/* Names what is happening rather than only greying out. A dead button
              during a slow network read as a broken form. */}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending && <Spinner className="size-4" />}
            {pending
              ? mode === 'signup'
                ? 'Creating account…'
                : 'Signing in…'
              : mode === 'signup'
                ? 'Create account'
                : 'Sign in'}
          </Button>
        </form>

        <div className="space-y-3">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={pending}
            onClick={handleMagicLink}
          >
            Email me a sign-in link
          </Button>

          <p className="text-center text-muted-foreground text-sm">
            {mode === 'signup' ? 'Already have an account?' : 'New to Aristo?'}{' '}
            <button
              type="button"
              className="underline underline-offset-4 hover:text-foreground"
              onClick={() => {
                setMode(mode === 'signup' ? 'signin' : 'signup')
                setError(null)
                setNotice(null)
              }}
            >
              {mode === 'signup' ? 'Sign in' : 'Create one'}
            </button>
          </p>
        </div>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
