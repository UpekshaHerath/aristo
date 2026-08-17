'use client'

import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { groupedSyllabuses } from '@/lib/syllabuses'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

/** True when the two sets hold the same codes, regardless of order. */
function sameCodes(a: Set<string>, b: Set<string>) {
  return a.size === b.size && [...a].every((code) => b.has(code))
}

export function SyllabusPicker({ initialCodes }: { initialCodes: string[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialCodes))
  const [saving, setSaving] = useState(false)
  // Success and failure were previously both plain grey text, so a save that
  // failed looked exactly like one that worked.
  const [status, setStatus] = useState<
    { kind: 'ok' | 'error'; message: string } | null
  >(null)

  // What is currently persisted. Updated on a successful save so the dirty
  // check keeps working across several saves without a page reload.
  const [saved, setSaved] = useState<Set<string>>(new Set(initialCodes))
  const dirty = !sameCodes(selected, saved)

  /*
   * Selecting subjects is easy to do and easy to walk away from — the picker is
   * one tap from the chat. Without this the choice is silently discarded.
   * Covers tab close and reload; in-app navigation is handled by the notice
   * beside the Save button, since Next's client router doesn't fire this.
   */
  useEffect(() => {
    if (!dirty) return

    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const toggle = (code: string) => {
    setStatus(null)
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  const save = async () => {
    setSaving(true)
    setStatus(null)

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setSaving(false)
      setStatus({ kind: 'error', message: 'Your session expired. Sign in again.' })
      return
    }

    // Upsert rather than update: the signup trigger normally creates the row,
    // but accounts made before the trigger existed won't have one.
    const { error } = await supabase.from('student_profiles').upsert(
      {
        user_id: user.id,
        syllabus_codes: [...selected],
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

    setSaving(false)
    if (!error) setSaved(new Set(selected))
    setStatus(
      error
        ? { kind: 'error', message: error.message }
        : {
            kind: 'ok',
            message:
              selected.size === 0
                ? 'Saved — searching all syllabuses.'
                : `Saved — ${selected.size} ${selected.size === 1 ? 'subject' : 'subjects'}.`,
          }
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {groupedSyllabuses().map(([qualification, options]) => (
        <section key={qualification} className="flex flex-col gap-2.5">
          <h2 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
            {qualification}
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {options.map((option) => {
              const active = selected.has(option.code)
              return (
                <li key={option.code}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={active}
                    onClick={() => toggle(option.code)}
                    className={cn(
                      'flex min-h-11 w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm',
                      'transition-[color,background-color,border-color,transform] duration-(--duration-fast) ease-(--ease-out-soft) active:scale-[0.98]',
                      'focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2',
                      active
                        ? 'border-primary/50 bg-primary/10'
                        : 'bg-card hover:bg-accent'
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'flex size-4 shrink-0 items-center justify-center rounded border',
                        active
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-muted-foreground/40'
                      )}
                    >
                      {active ? <Check className="size-3" /> : null}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{option.subject}</span>
                    <span className="font-mono text-muted-foreground text-xs">
                      {option.code}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      <div className="sticky bottom-0 flex items-center gap-3 border-t bg-background/85 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        {/* Nothing to save when nothing changed — an always-live Save button
            gives no signal about whether the choice has been committed. */}
        <Button onClick={save} disabled={saving || !dirty}>
          {saving && <Spinner className="size-4" />}
          {saving ? 'Saving…' : 'Save subjects'}
        </Button>

        {/* Live count, so the consequence of the selection is legible before
            saving rather than only after. */}
        <span className="text-muted-foreground text-sm">
          {selected.size === 0
            ? 'All syllabuses'
            : `${selected.size} selected`}
        </span>

        {dirty && !saving ? (
          <span className="animate-rise text-highlight text-sm">
            Unsaved changes
          </span>
        ) : null}

        {status ? (
          <p
            role="status"
            className={cn(
              'ml-auto animate-rise text-sm',
              status.kind === 'error' ? 'text-destructive' : 'text-primary'
            )}
          >
            {status.message}
          </p>
        ) : null}
      </div>
    </div>
  )
}
