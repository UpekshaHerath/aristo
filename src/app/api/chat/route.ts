import { handleChatStream } from '@mastra/ai-sdk'
import { toAISdkMessages } from '@mastra/ai-sdk/ui'
import { createUIMessageStreamResponse } from 'ai'
import { RequestContext } from '@mastra/core/request-context'
import { mastra } from '@/mastra'
import { NextResponse } from 'next/server'
import { getUser, resourceIdFor } from '@/lib/auth'
import { getProfile, retrievalFilterFor } from '@/lib/profile'
import { AGENT_ID } from '@/lib/agent'

// Mastra needs Node APIs and a real pg socket, so this route can't run on Edge.
export const runtime = 'nodejs'
// Route reads live memory from the DB; never let Next serve a cached GET.
export const dynamic = 'force-dynamic'
// Vercel Hobby permits up to 300s. Agent runs with tool calls can outlast the
// default, so give the stream room without reserving the whole ceiling.
export const maxDuration = 60

/**
 * Confirms the signed-in student owns `threadId`.
 *
 * Without this, passing someone else's thread id in the request body would let
 * the agent read and append to their conversation.
 */
async function assertThreadOwnership(threadId: string, resourceId: string) {
  const memory = await mastra.getAgentById(AGENT_ID).getMemory()
  if (!memory) return false
  const thread = await memory.getThreadById({ threadId })
  // Compare explicitly rather than relying on a resourceId filter: the base
  // memory type doesn't accept one, and an unscoped lookup returns any thread.
  return thread?.resourceId === resourceId
}

export async function POST(req: Request) {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { threadId, ...params } = await req.json()

  if (typeof threadId !== 'string' || !threadId) {
    return NextResponse.json({ error: 'A threadId is required' }, { status: 400 })
  }

  const resourceId = resourceIdFor(user)
  if (!(await assertThreadOwnership(threadId, resourceId))) {
    return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
  }

  // Scope retrieval to the syllabuses this student is enrolled in. Set here,
  // server-side, rather than via enableFilter — createVectorQueryTool resolves
  // `requestContext.get('filter')` ahead of any filter the model supplies, so
  // the model cannot widen its own search scope by asking.
  const requestContext = new RequestContext()
  const profile = await getProfile(user)
  const filter = retrievalFilterFor(profile)
  if (filter) {
    requestContext.set('filter', filter)
  }

  const stream = await handleChatStream({
    mastra,
    agentId: AGENT_ID,
    // ai@7 uses the v6 UI message protocol; without this the v5 overload is
    // selected and its chunk types don't match createUIMessageStreamResponse.
    version: 'v6',
    params: {
      ...params,
      requestContext,
      memory: {
        ...params.memory,
        thread: threadId,
        resource: resourceId,
      },
    },
  })

  return createUIMessageStreamResponse({ stream })
}

/** Hydrates one thread's history for the client. */
export async function GET(req: Request) {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const threadId = new URL(req.url).searchParams.get('threadId')
  if (!threadId) {
    return NextResponse.json({ error: 'A threadId is required' }, { status: 400 })
  }

  const resourceId = resourceIdFor(user)
  const memory = await mastra.getAgentById(AGENT_ID).getMemory()

  if (!memory || !(await assertThreadOwnership(threadId, resourceId))) {
    return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
  }

  let response = null
  try {
    response = await memory.recall({ threadId, resourceId })
  } catch {
    // A thread with no messages yet recalls nothing; an empty history is correct.
  }

  return NextResponse.json(
    toAISdkMessages(response?.messages ?? [], { version: 'v6' })
  )
}
