import { PgVector } from '@mastra/pg'

/**
 * The syllabus vector store, or null when DATABASE_URL isn't set.
 *
 * Returns null rather than throwing so the app still runs on the local LibSQL
 * fallback — retrieval is simply unavailable, which is a better local dev
 * experience than a boot failure.
 */
export function createSyllabusVectorStore(): PgVector | null {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) return null

  return new PgVector({
    id: 'syllabus-vector',
    connectionString,
    // Matches the storage pool: Supabase's transaction pooler fans out
    // connections, so each serverless instance should hold few.
    max: 5,
  })
}
