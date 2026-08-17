'use client'

import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export type ThreadSummary = {
  id: string
  title: string
  updatedAt: string
}

/** Groups threads the way a student thinks about them, not by raw timestamp. */
function bucketFor(updatedAt: string): string {
  const updated = new Date(updatedAt)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dayMs = 86_400_000

  if (updated >= startOfToday) return 'Today'
  if (updated >= new Date(startOfToday.getTime() - dayMs)) return 'Yesterday'
  if (updated >= new Date(startOfToday.getTime() - 7 * dayMs)) return 'This week'
  if (updated >= new Date(startOfToday.getTime() - 30 * dayMs)) return 'This month'
  return 'Earlier'
}

/*
 * The sidebar while the thread list is still in flight.
 *
 * Rows at the real height and heading widths, because the alternative - "Your
 * chats will appear here." - is a claim about the account, and showing it to a
 * student with forty threads for the length of a fetch is simply wrong.
 */
function ThreadListSkeleton() {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-4">
      <span className="sr-only">Loading chats</span>
      {[
        // Widths only, in row order. Uneven on purpose: equal bars read as a
        // table, and the list they stand in for is titles of varying length.
        ['4.5rem', ['72%', '88%', '61%']],
        ['5.5rem', ['80%', '54%']],
      ].map(([heading, rows], group) => (
        <section key={group} aria-hidden className="flex flex-col gap-1">
          <Skeleton className="mx-3 h-3 rounded-sm" style={{ width: heading as string }} />
          <div className="flex flex-col gap-0.5">
            {(rows as string[]).map((width, row) => (
              <div key={row} className="flex min-h-11 items-center px-3">
                <Skeleton className="h-4" style={{ width }} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

export function ThreadList({
  threads,
  activeThreadId,
  loading = false,
  onSelect,
  onRename,
  onDelete,
}: {
  threads: ThreadSummary[]
  activeThreadId: string | null
  /** The first fetch has not landed yet - not "this account has no chats". */
  loading?: boolean
  onSelect: (id: string) => void
  onRename: (thread: ThreadSummary) => void
  onDelete: (thread: ThreadSummary) => void
}) {
  if (loading && threads.length === 0) return <ThreadListSkeleton />

  if (threads.length === 0) {
    return (
      <p className="px-3 py-2 text-muted-foreground text-sm">
        Your chats will appear here.
      </p>
    )
  }

  const groups: { bucket: string; items: ThreadSummary[] }[] = []
  for (const thread of threads) {
    const bucket = bucketFor(thread.updatedAt)
    const last = groups.at(-1)
    if (last?.bucket === bucket) last.items.push(thread)
    else groups.push({ bucket, items: [thread] })
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <section key={group.bucket} className="flex flex-col gap-1">
          <h2 className="px-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">
            {group.bucket}
          </h2>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((thread) => {
              const active = thread.id === activeThreadId
              return (
                <li key={thread.id} className="group/item relative">
                  <button
                    type="button"
                    onClick={() => onSelect(thread.id)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      // Generous target height - this is a one-thumb list.
                      'flex min-h-11 w-full items-center rounded-lg py-2 pr-10 pl-3 text-left text-sm transition-colors',
                      'focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-1',
                      // A colour shift alone is easy to miss against the sidebar
                      // tint, so the active thread also gets a primary marker.
                      'before:absolute before:top-1/2 before:left-0 before:h-5 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:transition-colors',
                      active
                        ? 'bg-accent font-medium text-accent-foreground before:bg-primary'
                        : 'text-foreground/80 before:bg-transparent hover:bg-accent/60'
                    )}
                  >
                    <span className="truncate">{thread.title}</span>
                  </button>

                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Actions for ${thread.title}`}
                          className={cn(
                            '-translate-y-1/2 absolute top-1/2 right-1 size-8 transition-opacity',
                            // Hidden until wanted, so the list reads as titles
                            // rather than a column of dots. Touch devices have
                            // no hover, so it stays visible there - and it must
                            // never hide while its own menu is open.
                            'opacity-0 group-hover/item:opacity-100 focus-visible:opacity-100 data-[popup-open]:opacity-100',
                            '[@media(hover:none)]:opacity-100'
                          )}
                        />
                      }
                    >
                      <MoreHorizontal className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onRename(thread)}>
                        <Pencil className="size-3.5" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => onDelete(thread)}
                      >
                        <Trash2 className="size-3.5" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
