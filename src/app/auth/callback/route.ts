import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/** Exchanges the emailed one-time code for a session cookie. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/chat'

  // Only allow same-origin relative paths — an attacker-supplied absolute URL
  // here would turn the callback into an open redirect.
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/chat'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`)
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent('That sign-in link is invalid or has expired. Request a new one.')}`
  )
}
