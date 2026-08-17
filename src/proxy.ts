import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

/** Next 16 renamed the `middleware` convention to `proxy`. */
export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Every path except static assets and image files. API routes ARE matched,
     * so an unauthenticated fetch to /api/chat is rejected before it reaches
     * the agent rather than relying on the handler alone.
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)',
  ],
}
