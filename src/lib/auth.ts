import { createClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'

/**
 * Returns the authenticated user, or null.
 *
 * Middleware already gates these routes, but every handler re-checks: middleware
 * is a matcher pattern and a matcher can be wrong. Authorization decisions
 * belong next to the data access, not one layer away from it.
 */
export async function getUser(): Promise<User | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

/**
 * The Mastra memory `resource` for a user. Every memory read and write is scoped
 * by this, which is what keeps one student's threads out of another's.
 */
export function resourceIdFor(user: User): string {
  return user.id
}
