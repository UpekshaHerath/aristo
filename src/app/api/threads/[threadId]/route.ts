import { NextResponse } from 'next/server'
import { mastra } from '@/mastra'
import { getUser, resourceIdFor } from '@/lib/auth'
import { AGENT_ID } from '@/lib/agent'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ threadId: string }> }

/**
 * Resolves a thread only if the signed-in student owns it.
 *
 * Returns 404 rather than 403 on a thread owned by someone else — a 403 would
 * confirm the id exists, which is a small enumeration leak.
 */
async function resolveOwnedThread(threadId: string) {
  const user = await getUser()
  if (!user) {
    return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) }
  }

  const memory = await mastra.getAgentById(AGENT_ID).getMemory()
  if (!memory) {
    return { error: NextResponse.json({ error: 'Memory is not configured' }, { status: 500 }) }
  }

  const thread = await memory.getThreadById({ threadId })

  // getThreadById is unscoped on the base memory type, so the ownership test is
  // this comparison — not the lookup.
  if (!thread || thread.resourceId !== resourceIdFor(user)) {
    return { error: NextResponse.json({ error: 'Thread not found' }, { status: 404 }) }
  }

  return { memory, thread }
}

/** Rename a thread. */
export async function PATCH(request: Request, { params }: Params) {
  const { threadId } = await params
  const resolved = await resolveOwnedThread(threadId)
  if ('error' in resolved) return resolved.error

  let title: string
  try {
    const body = await request.json()
    if (typeof body?.title !== 'string' || !body.title.trim()) {
      return NextResponse.json({ error: 'A title is required' }, { status: 400 })
    }
    title = body.title.trim().slice(0, 200)
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const updated = await resolved.memory.updateThread({ id: threadId, title })

  return NextResponse.json({
    thread: { id: updated.id, title: updated.title, updatedAt: updated.updatedAt },
  })
}

/** Delete a thread and its messages. */
export async function DELETE(_request: Request, { params }: Params) {
  const { threadId } = await params
  const resolved = await resolveOwnedThread(threadId)
  if ('error' in resolved) return resolved.error

  // deleteThread takes no resourceId, so the ownership check above is the only
  // thing standing between a guessed id and someone else's data.
  await resolved.memory.deleteThread(threadId)

  return new NextResponse(null, { status: 204 })
}
