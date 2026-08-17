/**
 * Ingests syllabus material into the pgvector knowledge base.
 *
 *   npm run ingest -- ./content/physics-0625.md
 *   npm run ingest -- ./content            # every .md/.txt in the directory
 *
 * Front matter on each file supplies the chunk metadata:
 *
 *   ---
 *   subject: Physics
 *   syllabusCode: "0625"
 *   qualification: IGCSE
 *   sourceType: notes
 *   topic: Electromagnetic induction
 *   sourceTitle: Unit 4 revision notes
 *   ---
 *
 * Only ingest material you have the right to use. Cambridge past papers and
 * mark schemes are licensed to registered centres, not published for reuse.
 */
import { readFile, readdir, stat } from 'node:fs/promises'
import { join, extname, basename, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { embedMany } from 'ai'
import { MDocument } from '@mastra/rag'
import { ModelRouterEmbeddingModel } from '@mastra/core/llm'
import { PgVector } from '@mastra/pg'
import {
  SYLLABUS_INDEX,
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSION,
  EMBEDDING_OPTIONS_DOCUMENT,
  METADATA_INDEXES,
  QUALIFICATIONS,
  SOURCE_TYPES,
  type ChunkMetadata,
} from '../src/mastra/rag/config'

type FrontMatter = Record<string, string>

/** Minimal front-matter parser - avoids a dependency for a fixed, simple shape. */
function splitFrontMatter(raw: string): { meta: FrontMatter; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!match) return { meta: {}, body: raw }

  const meta: FrontMatter = {}
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
    if (key) meta[key] = value
  }

  return { meta, body: raw.slice(match[0].length) }
}

function buildMetadata(meta: FrontMatter, filePath: string): ChunkMetadata {
  const missing = ['subject', 'syllabusCode', 'qualification'].filter(
    (key) => !meta[key]
  )
  if (missing.length > 0) {
    throw new Error(
      `${basename(filePath)}: missing required front matter: ${missing.join(', ')}`
    )
  }

  const qualification = meta.qualification as ChunkMetadata['qualification']
  if (!QUALIFICATIONS.includes(qualification)) {
    throw new Error(
      `${basename(filePath)}: qualification must be one of ${QUALIFICATIONS.join(', ')}`
    )
  }

  const sourceType = (meta.sourceType ?? 'notes') as ChunkMetadata['sourceType']
  if (!SOURCE_TYPES.includes(sourceType)) {
    throw new Error(
      `${basename(filePath)}: sourceType must be one of ${SOURCE_TYPES.join(', ')}`
    )
  }

  return {
    subject: meta.subject,
    syllabusCode: meta.syllabusCode,
    qualification,
    sourceType,
    topic: meta.topic,
    paper: meta.paper,
    year: meta.year ? Number(meta.year) : undefined,
    sourceTitle: meta.sourceTitle ?? basename(filePath),
    // Stable across runs, so re-ingesting a file replaces its chunks rather
    // than duplicating them.
    documentId: createHash('sha256').update(resolve(filePath)).digest('hex').slice(0, 32),
  }
}

async function collectFiles(target: string): Promise<string[]> {
  const info = await stat(target)
  if (info.isFile()) return [target]

  const entries = await readdir(target, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const full = join(target, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(full)))
    } else if (
      ['.md', '.txt'].includes(extname(entry.name)) &&
      // README files document the folder; they aren't syllabus content.
      entry.name.toLowerCase() !== 'readme.md'
    ) {
      files.push(full)
    }
  }
  return files
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const target = args.find((arg) => !arg.startsWith('--'))

  if (!target) {
    console.error('Usage: npm run ingest -- <file-or-directory> [--dry-run]')
    process.exit(1)
  }

  // Dry run validates front matter and chunking without a database or any
  // embedding spend - worth running over new content before the real ingest.
  if (dryRun) {
    const files = await collectFiles(target)
    let chunkTotal = 0
    for (const file of files) {
      const raw = await readFile(file, 'utf8')
      const { meta, body } = splitFrontMatter(raw)
      const metadata = buildMetadata(meta, file)
      const chunks = await MDocument.fromMarkdown(body).chunk({
        strategy: 'recursive',
        maxSize: 512,
        overlap: 50,
      })
      chunkTotal += chunks.length
      console.log(
        `  ${basename(file)} → ${chunks.length} chunks  [${metadata.qualification} ${metadata.subject} ${metadata.syllabusCode}] ${metadata.sourceType}`
      )
    }
    console.log(`\nDry run OK: ${chunkTotal} chunks from ${files.length} file(s). Nothing written.`)
    return
  }

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.error(
      'DATABASE_URL is not set. Ingest writes to Supabase Postgres - add it to .env first.'
    )
    process.exit(1)
  }

  const store = new PgVector({ id: 'ingest', connectionString })

  // Idempotent: creating an existing index is a no-op, so this is safe to run
  // on every ingest rather than as a separate setup step.
  await store.createIndex({
    indexName: SYLLABUS_INDEX,
    dimension: EMBEDDING_DIMENSION,
    metric: 'cosine',
    indexConfig: { type: 'hnsw' },
    metadataIndexes: METADATA_INDEXES,
  })

  const files = await collectFiles(target)
  if (files.length === 0) {
    console.error(`No .md or .txt files found under ${target}`)
    process.exit(1)
  }

  const embedder = new ModelRouterEmbeddingModel(EMBEDDING_MODEL)
  let totalChunks = 0

  for (const file of files) {
    const raw = await readFile(file, 'utf8')
    const { meta, body } = splitFrontMatter(raw)
    const metadata = buildMetadata(meta, file)

    if (!body.trim()) {
      console.warn(`  skipped ${basename(file)} - no content below front matter`)
      continue
    }

    const doc = MDocument.fromMarkdown(body)
    const chunks = await doc.chunk({
      strategy: 'recursive',
      maxSize: 512,
      overlap: 50,
    })

    if (chunks.length === 0) {
      console.warn(`  skipped ${basename(file)} - chunked to nothing`)
      continue
    }

    const { embeddings } = await embedMany({
      values: chunks.map((chunk) => chunk.text),
      model: embedder,
      // Without this the model returns its native 3072 dimensions and the
      // upsert fails against a 768-wide index.
      providerOptions: EMBEDDING_OPTIONS_DOCUMENT,
    })

    await store.upsert({
      indexName: SYLLABUS_INDEX,
      vectors: embeddings,
      metadata: chunks.map((chunk, i) => ({
        ...metadata,
        chunkIndex: i,
        text: chunk.text,
      })),
      ids: chunks.map((_, i) => `${metadata.documentId}-${i}`),
      // Clears this document's previous chunks in the same operation, so a file
      // that shrinks between runs doesn't leave orphans behind.
      deleteFilter: { documentId: metadata.documentId },
    })

    totalChunks += chunks.length
    console.log(
      `  ${basename(file)} → ${chunks.length} chunks  [${metadata.qualification} ${metadata.subject} ${metadata.syllabusCode}]`
    )
  }

  console.log(`\nIndexed ${totalChunks} chunks from ${files.length} file(s).`)
  await store.disconnect()
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
