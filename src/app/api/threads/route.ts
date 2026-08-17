import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { mastra } from '@/mastra'
import { getUser, resourceIdFor } from '@/lib/auth'
import { AGENT_ID } from '@/lib/agent'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** List the signed-in student's threads, newest first. */
export async function GET() {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const memory = await mastra.getAgentById(AGENT_ID).getMemory()
  if (!memory) {
    return NextResponse.json({ threads: [] })
  }

  const { threads } = await memory.listThreads({
    filter: { resourceId: resourceIdFor(user) },
    orderBy: { field: 'updatedAt', direction: 'DESC' },
    perPage: 100,
  })

  return NextResponse.json({
    threads: threads.map((thread) => ({
      id: thread.id,
      title: thread.title ?? 'New chat',
      updatedAt: thread.updatedAt,
    })),
  })
}

/** Create an empty thread owned by the signed-in student. */
export async function POST(request: Request) {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const memory = await mastra.getAgentById(AGENT_ID).getMemory()
  if (!memory) {
    return NextResponse.json(
      { error: 'Memory is not configured' },
      { status: 500 }
    )
  }

  let title = 'New chat'
  try {
    const body = await request.json()
    if (typeof body?.title === 'string' && body.title.trim()) {
      title = body.title.trim().slice(0, 200)
    }
  } catch {
    // No body is fine — the default title stands.
  }

  const thread = await memory.saveThread({
    thread: {
      id: randomUUID(),
      // resourceId is taken from the session, never from the request body.
      resourceId: resourceIdFor(user),
      title,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  })

  return NextResponse.json(
    { thread: { id: thread.id, title: thread.title, updatedAt: thread.updatedAt } },
    { status: 201 }
  )
}
