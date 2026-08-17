import { Mastra } from '@mastra/core/mastra';
import { SpanType } from '@mastra/core/observability';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { PostgresStore } from '@mastra/pg';
import { Observability, MastraStorageExporter, MastraPlatformExporter, SensitiveDataFilter } from '@mastra/observability';
import { weatherWorkflow } from './workflows/weather-workflow';
import { weatherAgent } from './agents/weather-agent';
import { aristoAgent } from './agents/aristo-agent';
import { createSyllabusVectorStore } from './rag/vector-store';
import { VECTOR_STORE_NAME } from './rag/config';

const connectionString = process.env.DATABASE_URL;

// Retrieval needs Postgres + pgvector. Without DATABASE_URL the app still runs
// on the local file store; the agent simply has no knowledge base to search.
const syllabusVectorStore = createSyllabusVectorStore();

// Vercel's filesystem is ephemeral, so a file-backed store resets on every cold
// start. Postgres (Supabase) is the deployed store; the LibSQL file is only a
// local-dev convenience for when DATABASE_URL isn't set.
const storage = connectionString
  ? new PostgresStore({
      id: 'pg-storage',
      connectionString,
      // Supabase's transaction pooler already fans out connections; keeping the
      // per-instance pool small avoids exhausting it across serverless instances.
      max: 5,
    })
  : new LibSQLStore({
      id: 'mastra-storage',
      // A relative path resolves against each process's CWD, and `next dev` and
      // `mastra dev` (Studio) don't share one — that silently produces two
      // separate databases. Set MASTRA_DB_URL to an absolute file: URL so both
      // read the same file. Setting DATABASE_URL removes the problem entirely.
      url: process.env.MASTRA_DB_URL ?? 'file:./mastra.db',
    });

export const mastra = new Mastra({
  workflows: { weatherWorkflow },
  agents: { aristoAgent, weatherAgent },
  ...(syllabusVectorStore
    ? { vectors: { [VECTOR_STORE_NAME]: syllabusVectorStore } }
    : {}),
  storage,
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'mastra',
        // One span per streamed chunk is the bulk of trace volume and the fastest
        // way to fill Supabase's 500 MB free tier. The rest of the tree is kept.
        excludeSpanTypes: [SpanType.MODEL_CHUNK],
        exporters: [
          // 'insert-only' is the strategy Mastra recommends for Postgres-backed
          // traces: it skips per-span update writes.
          //
          // On boot this logs a burst of "This storage provider does not support
          // batch creating logs/metrics" warnings. Expected, not a fault:
          // PostgresStore implements spans but not the log and metric signals,
          // and the exporter disables an unsupported signal for the rest of the
          // process once its retries are exhausted. Traces still persist. Left
          // at the default maxRetries because lowering it to quieten this would
          // also weaken retries for spans, which are worth retrying.
          new MastraStorageExporter({ strategy: 'insert-only' }), // Persists observability events to Mastra Storage
          new MastraPlatformExporter(), // Sends observability events to Mastra Platform (if MASTRA_PLATFORM_ACCESS_TOKEN is set)
        ],
        spanOutputProcessors: [
          new SensitiveDataFilter(), // Redacts sensitive data like passwords, tokens, keys
        ],
      },
    },
  }),
});
