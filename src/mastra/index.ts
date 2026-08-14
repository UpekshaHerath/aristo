import { Mastra } from '@mastra/core/mastra';
import { SpanType } from '@mastra/core/observability';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { PostgresStore } from '@mastra/pg';
import { Observability, MastraStorageExporter, MastraPlatformExporter, SensitiveDataFilter } from '@mastra/observability';
import { weatherWorkflow } from './workflows/weather-workflow';
import { weatherAgent } from './agents/weather-agent';

const connectionString = process.env.DATABASE_URL;

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
      url: 'file:./mastra.db',
    });

export const mastra = new Mastra({
  workflows: { weatherWorkflow },
  agents: { weatherAgent },
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
