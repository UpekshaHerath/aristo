import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseEnv } from './env'

/**
 * Supabase client for Server Components, Route Handlers and Server Actions.
 * Must be created per request - never hoist this into a module-level singleton,
 * because the cookie store belongs to one request only.
 */
export async function createClient() {
  const cookieStore = await cookies()
  const { url, anonKey } = supabaseEnv()

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // The proxy refreshes the session, so this is safe to ignore.
        }
      },
    },
  })
}
