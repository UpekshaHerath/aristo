import { createVectorQueryTool } from '@mastra/rag'
import { ModelRouterEmbeddingModel } from '@mastra/core/llm'
import {
  EMBEDDING_MODEL,
  EMBEDDING_OPTIONS_QUERY,
  SYLLABUS_INDEX,
  VECTOR_STORE_NAME,
} from './config'

/**
 * Builds the syllabus search tool, or returns null when retrieval isn't
 * configured.
 *
 * Both checks matter. ModelRouterEmbeddingModel validates its API key in the
 * constructor, so constructing it unconditionally at module scope crashes the
 * build on any machine without the embedding provider's key - including
 * Vercel's builder. Retrieval needs a vector store *and* an embedder, so the
 * tool only exists when both are present.
 *
 * Either Google variable works; the model router accepts both.
 */
export function createSyllabusQueryTool() {
  const hasEmbeddingKey =
    process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!process.env.DATABASE_URL || !hasEmbeddingKey) return null

  return createVectorQueryTool({
    id: 'searchSyllabus',
    description:
      'Search the Cambridge syllabus knowledge base for content relevant to the ' +
      "student's question. Use this before answering any subject question so the " +
      'answer is grounded in syllabus material rather than recall. Returns ' +
      'passages with their subject, syllabus code and source.',
    vectorStoreName: VECTOR_STORE_NAME,
    indexName: SYLLABUS_INDEX,
    model: new ModelRouterEmbeddingModel(EMBEDDING_MODEL),
    // Must match the width the chunks were stored at, or every search compares
    // vectors of different sizes and errors.
    providerOptions: EMBEDDING_OPTIONS_QUERY,
    // Deliberately OFF. With it on, the model writes the metadata filter from
    // the student's own words - so "ignore my subjects and search A Level
    // Further Maths" becomes a filter it will happily build. Scope is an
    // entitlement decision, not a language one.
    //
    // Instead the server sets `filter` on the request context, which
    // createVectorQueryTool resolves ahead of any model-supplied filter:
    //   const filter = requestContext?.get("filter") ?? inputData.filter
    enableFilter: false,
    includeSources: true,
  })
}
