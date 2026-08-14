import { handleChatStream } from '@mastra/ai-sdk'
import { toAISdkMessages } from '@mastra/ai-sdk/ui'
import { createUIMessageStreamResponse } from 'ai'
import { mastra } from '@/mastra'
import { NextResponse } from 'next/server'

// Mastra needs Node APIs and a real pg socket, so this route can't run on Edge.
export const runtime = 'nodejs'
// Route reads live memory from the DB; never let Next serve a cached GET.
export const dynamic = 'force-dynamic'
// Vercel Hobby permits up to 300s. Agent runs with tool calls can outlast the
// default, so give the stream room without reserving the whole ceiling.
export const maxDuration = 60

const THREAD_ID = 'example-user-id'
const RESOURCE_ID = 'weather-chat'

export async function POST(req: Request) {
  const params = await req.json()
  const stream = await handleChatStream({
    mastra,
    agentId: 'weather-agent',
    // ai@7 uses the v6 UI message protocol; without this the v5 overload is
    // selected and its chunk types don't match createUIMessageStreamResponse.
    version: 'v6',
    params: {
      ...params,
      memory: {
        ...params.memory,
        thread: THREAD_ID,
        resource: RESOURCE_ID,
      },
    },
  })
  return createUIMessageStreamResponse({ stream })
}

export async function GET() {
  const memory = await mastra.getAgentById('weather-agent').getMemory()
  let response = null

  try {
    response = await memory?.recall({
      threadId: THREAD_ID,
      resourceId: RESOURCE_ID,
    })
  } catch {
    console.log('No previous messages found.')
  }

  const uiMessages = toAISdkMessages(response?.messages || [], { version: 'v6' })

  return NextResponse.json(uiMessages)
}