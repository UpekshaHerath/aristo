/** Shared constants for the syllabus knowledge base. */

export const SYLLABUS_INDEX = 'syllabus_chunks'

/**
 * gemini-embedding-001 is free on Google AI Studio's tier, which is why it's the
 * default while the corpus is still small. openai/text-embedding-3-small (1536
 * dimensions, 8191-token input limit) is the upgrade path when retrieval quality
 * starts to matter more than the bill.
 *
 * Changing the embedding model means recreating the index - the dimension is
 * fixed at creation, so a swap is: drop the index, edit these constants, re-ingest.
 *
 * Its 2048-token input limit is the binding constraint on chunk size. The 512
 * maxSize in scripts/ingest.ts sits well under it.
 */
export const EMBEDDING_MODEL = 'google/gemini-embedding-001'

/**
 * 768, not the model's native 3072. Two reasons it has to be truncated:
 * pgvector's HNSW index refuses anything over 2000 dimensions, and 3072-wide
 * vectors cost 4x the storage for a corpus this size. gemini-embedding-001 is
 * trained with Matryoshka representation learning, so a truncated prefix is a
 * valid embedding rather than a mutilated one.
 *
 * Truncation is NOT the default - it only happens because EMBEDDING_OPTIONS
 * below asks for it, and that must be passed at both ingest and query time or
 * the two sides produce different widths.
 */
export const EMBEDDING_DIMENSION = 768

/**
 * Provider options for the embedding calls, keyed by provider as the AI SDK
 * expects. Lives here so a model swap moves the dimension and the options that
 * produce it together.
 *
 * taskType is asymmetric on purpose: Gemini embeds a stored passage and a
 * search query into different spaces, and telling it which is which measurably
 * improves retrieval over using one setting for both.
 */
const embeddingOptions = (taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY') => ({
  google: { outputDimensionality: EMBEDDING_DIMENSION, taskType },
})

/** Used when embedding chunks for storage. */
export const EMBEDDING_OPTIONS_DOCUMENT = embeddingOptions('RETRIEVAL_DOCUMENT')

/** Used when embedding a student's question at query time. */
export const EMBEDDING_OPTIONS_QUERY = embeddingOptions('RETRIEVAL_QUERY')

export const VECTOR_STORE_NAME = 'syllabus'

/**
 * Passages returned per search.
 *
 * Deliberately below createVectorQueryTool's default of 10. Chunks are ingested
 * at up to 512 tokens, so ten of them is roughly 5k tokens of context - more
 * than half of Groq's 8000 tokens-per-minute free-tier allowance spent on a
 * single tool result, which is what made the first question of a session fail
 * with a 413.
 */
export const SYLLABUS_TOP_K = 3

/**
 * Ceiling on the input tokens of any one model call, enforced per step of the
 * agent loop.
 *
 * A grounded turn costs two calls: one to decide on the search (~1.2k, nearly
 * all of it the system prompt) and one carrying the retrieved passages (~3k).
 * Both count against the same minute, so the pair plus the answer has to fit
 * inside 8000.
 *
 * Set above that ~3k rather than at it on purpose. The limiter drops oldest
 * first, and the newest message on the second call is the tool result - trim
 * too aggressively and the passages the answer is supposed to be grounded in
 * are exactly what gets discarded. This only bites on genuinely long threads.
 */
export const MAX_INPUT_TOKENS = 5000

/** Cambridge qualification levels a chunk can belong to. */
export const QUALIFICATIONS = ['IGCSE', 'O Level', 'AS Level', 'A Level'] as const
export type Qualification = (typeof QUALIFICATIONS)[number]

/**
 * Where a chunk came from. Kept in metadata so retrieval can be restricted by
 * provenance - useful while only self-authored material is licensed for use.
 */
export const SOURCE_TYPES = ['syllabus', 'notes', 'worked-example', 'past-paper'] as const
export type SourceType = (typeof SOURCE_TYPES)[number]

/**
 * Metadata attached to every chunk. Filtering on these is what stops an IGCSE
 * student being served an A Level chunk - vocabulary overlaps heavily between
 * levels, so semantic similarity alone will cross that boundary.
 */
export type ChunkMetadata = {
  subject: string
  syllabusCode: string
  qualification: Qualification
  sourceType: SourceType
  topic?: string
  paper?: string
  year?: number
  sourceTitle: string
  /** Stable id of the source document, so re-ingesting can replace its chunks. */
  documentId: string
}

/** Metadata fields worth a btree index - every one of these is filtered on. */
export const METADATA_INDEXES = [
  'syllabusCode',
  'qualification',
  'subject',
  'sourceType',
  'documentId',
]
