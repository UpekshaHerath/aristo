/**
 * Reads the Supabase config, failing with a message that names what's missing.
 *
 * Without this the raw client error surfaces from the proxy, which takes down
 * every route — including /login — behind a message that doesn't say which
 * variable is absent or which file to put it in.
 */
export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  const missing = [
    !url && 'NEXT_PUBLIC_SUPABASE_URL',
    !anonKey && 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ].filter(Boolean)

  if (missing.length > 0) {
    throw new Error(
      `Missing Supabase config: ${missing.join(', ')}. ` +
        `Add these to .env from your Supabase dashboard (Project Settings > API), ` +
        `then restart the dev server. See .env.example.`
    )
  }

  return { url: url!, anonKey: anonKey! }
}
