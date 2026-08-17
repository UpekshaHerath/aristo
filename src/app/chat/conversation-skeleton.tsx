import { Skeleton } from '@/components/ui/skeleton'

/*
 * Placeholder for a thread whose history is still in flight.
 *
 * A centred spinner said "something is happening" but not "a conversation is
 * about to appear here", so the pane still jumped when the real messages
 * landed. These bars sit at the same widths and alignment as a real turn - a
 * short right-aligned question, a long left-aligned answer - so the load reads
 * as the conversation resolving rather than the layout being replaced.
 *
 * Two turns only. More would imply a thread length we do not know yet, and a
 * skeleton taller than the answer is its own kind of jump.
 */
export function ConversationSkeleton() {
  return (
    <div
      // The whole block is one status region: individual bars are decoration,
      // and announcing each of them would be noise.
      role="status"
      aria-busy="true"
      className="min-h-0 flex-1 overflow-hidden px-4 py-6"
    >
      <span className="sr-only">Loading conversation</span>
      <div
        aria-hidden
        className="mx-auto flex w-full max-w-3xl animate-rise flex-col gap-8"
      >
        {[0, 1].map((turn) => (
          <div key={turn} className="flex flex-col gap-6">
            {/* Student question - bubble-shaped, right-aligned, short. */}
            <div className="flex justify-end">
              <Skeleton className="h-10 w-[min(60%,20rem)] rounded-[1.35rem] rounded-br-[0.55rem]" />
            </div>

            {/* Aristo's answer - avatar plus a paragraph of lines, the last
                one short so it reads as a paragraph end rather than a block. */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <Skeleton className="size-8 rounded-full" />
                <Skeleton className="h-4 w-24" />
              </div>
              <div className="flex flex-col gap-2.5">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-[92%]" />
                <Skeleton className="h-4 w-[97%]" />
                <Skeleton className="h-4 w-[64%]" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
