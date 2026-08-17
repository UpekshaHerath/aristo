import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { ChatWorkspace } from './chat-workspace'

export const dynamic = 'force-dynamic'

export default async function ChatPage() {
  const user = await getUser()
  if (!user) {
    redirect('/login')
  }

  return <ChatWorkspace userEmail={user.email ?? ''} />
}
