'use client'

import { ArrowUpRight } from 'lucide-react'
import { AristoMascot } from '@/components/brand/aristo-mascot'

/**
 * Starter prompts do double duty: they get a stuck student moving, and they
 * teach what Aristo is for. Each names a real syllabus code so the scope reads
 * as Cambridge-specific rather than "general homework help".
 */
const STARTERS = [
  {
    label: 'Explain a concept',
    prompt:
      'Explain electromagnetic induction for IGCSE Physics 0625, with a worked example.',
  },
  {
    label: 'Decode the mark scheme',
    prompt:
      "What's the difference between 'describe', 'explain' and 'evaluate' in Cambridge mark schemes?",
  },
  {
    label: 'Work through a method',
    prompt:
      'Walk me through integration by parts step by step for A Level Maths 9709.',
  },
  {
    label: 'Structure an answer',
    prompt:
      'How should I structure a 6-mark answer on the causes of WWI for IGCSE History 0470?',
  },
]

export function EmptyState({
  onPick,
  disabled,
}: {
  onPick: (prompt: string) => void
  disabled?: boolean
}) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-8 px-4 py-12 text-center">
      <div className="flex flex-col items-center gap-3">
        <AristoMascot mood="idle" className="size-20" />
        <h1 className="font-display text-3xl tracking-tight">
          What are you revising?
        </h1>
        <p className="max-w-md text-balance text-muted-foreground text-sm">
          Ask about any Cambridge subject - syllabus content, exam technique, or a
          question you&apos;re stuck on.
        </p>
      </div>

      <ul className="grid w-full gap-2 sm:grid-cols-2">
        {STARTERS.map((starter, i) => (
          <li
            key={starter.label}
            className="animate-rise"
            // Staggered so the grid resolves in sequence rather than snapping in
            // as one block. Small steps - 60ms reads as one gesture, not a queue.
            style={{ animationDelay: `${80 + i * 60}ms` }}
          >
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(starter.prompt)}
              className="group flex h-full w-full flex-col gap-1.5 rounded-xl border bg-card p-3.5 text-left transition-[color,background-color,border-color,transform,box-shadow] duration-(--duration-base) ease-(--ease-out-soft) hover:-translate-y-0.5 hover:border-primary/40 hover:bg-accent hover:shadow-sm active:translate-y-0 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 disabled:opacity-50 disabled:hover:translate-y-0"
            >
              <span className="flex items-center gap-1 font-medium text-highlight text-xs uppercase tracking-wide">
                {starter.label}
                <ArrowUpRight className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
              </span>
              <span className="text-muted-foreground text-sm leading-snug">
                {starter.prompt}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
