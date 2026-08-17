import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getUser } from '@/lib/auth'
import { getProfile } from '@/lib/profile'
import { SyllabusPicker } from './syllabus-picker'
import { AristoWordmark } from '@/components/brand/aristo-mark'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Your subjects' }

export default async function SettingsPage() {
  const user = await getUser()
  if (!user) redirect('/login')

  const profile = await getProfile(user)

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8">
      <Link
        href="/chat"
        className="mb-6 inline-flex items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Back to chat
      </Link>

      <AristoWordmark className="mb-5" />

      <h1 className="font-display text-2xl tracking-tight">Your subjects</h1>
      <p className="pt-2 pb-6 text-muted-foreground text-sm">
        Aristo searches only the syllabuses you select, so answers stay at the
        right level. Select none to search everything.
      </p>

      <SyllabusPicker initialCodes={profile.syllabusCodes} />
    </main>
  )
}
