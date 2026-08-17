'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { DefaultChatTransport, type ToolUIPart } from 'ai'
import { useChat } from '@ai-sdk/react'
import {
  Check,
  Copy,
  PanelLeft,
  RotateCcw,
  SlidersHorizontal,
  SquarePen,
  X,
} from 'lucide-react'

import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from '@/components/ai-elements/prompt-input'
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation'
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
} from '@/components/ai-elements/message'
import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
} from '@/components/ai-elements/tool'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ThemeToggle } from '@/components/theme-toggle'
import { Spinner } from '@/components/ui/spinner'
import { normalizeLatexDelimiters } from '@/lib/latex'
import { deriveThreadTitle } from '@/lib/thread-title'
import { AristoWordmark } from '@/components/brand/aristo-mark'
import { AristoMascot } from '@/components/brand/aristo-mascot'
import { cjk } from '@streamdown/cjk'
import { code } from '@streamdown/code'
import { createMathPlugin } from '@streamdown/math'
import { mermaid } from '@streamdown/mermaid'
import { EmptyState } from './empty-state'
import { ThreadList, type ThreadSummary } from './thread-list'

/**
 * MessageResponse's own plugin set leaves `singleDollarTextMath` at its default
 * of false, so `$V$` reaches the student as literal dollar signs while `$$...$$`
 * renders. Nearly all of an exam answer's maths is inline, so that default makes
 * the majority of it unreadable. Passing `plugins` here overrides the component's
 * - it spreads props after its own `plugins`, so no vendored file needs editing.
 */
const streamdownPlugins = {
  cjk,
  code,
  mermaid,
  math: createMathPlugin({ singleDollarTextMath: true }),
}

/** Copies an answer, confirming with a tick so the click isn't silent. */
function CopyAnswer({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(timer)
  }, [copied])

  return (
    <MessageAction
      tooltip={copied ? 'Copied' : 'Copy answer'}
      onClick={async () => {
        // The async clipboard API rejects without a user gesture, in insecure
        // contexts, and when the permission is denied. Unhandled, that leaves a
        // button that does nothing at all and logs an uncaught rejection, so
        // fall back to a selection-based copy before giving up.
        try {
          await navigator.clipboard.writeText(text)
        } catch {
          const scratch = document.createElement('textarea')
          scratch.value = text
          // Off-screen rather than hidden: display:none can't hold a selection.
          scratch.style.cssText = 'position:fixed;left:-9999px;opacity:0'
          document.body.append(scratch)
          scratch.select()
          try {
            document.execCommand('copy')
          } catch {
            return
          } finally {
            scratch.remove()
          }
        }
        setCopied(true)
      }}
    >
      {copied ? (
        <Check className="size-3.5 text-primary" />
      ) : (
        <Copy className="size-3.5" />
      )}
    </MessageAction>
  )
}

/**
 * Surfaces a failed turn.
 *
 * Without this a Groq rate limit is completely invisible: the route still
 * returns 200, the error rides inside the stream, and the student sees their
 * question followed by nothing at all. Silence reads as a broken app.
 */
function ErrorNotice({
  error,
  onRetry,
  onDismiss,
}: {
  error: Error
  onRetry: () => void
  onDismiss: () => void
}) {
  // Rate limits are the common case on a free model tier and are worth naming,
  // since the fix is simply to wait rather than to rephrase the question.
  const rateLimited = /rate.?limit|429|quota/i.test(error.message)

  return (
    <div
      role="alert"
      className="mb-2 flex animate-rise items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2.5 text-sm"
    >
      <AristoMascot mood="concerned" className="-mt-0.5 size-7 shrink-0" />
      <p className="min-w-0 flex-1 text-foreground/90">
        {rateLimited
          ? 'Aristo is busy right now - the free model tier is rate limited. Wait a few seconds and try again.'
          : "That answer didn't come through."}
      </p>
      <Button size="sm" variant="outline" className="h-7" onClick={onRetry}>
        <RotateCcw className="size-3.5" />
        Retry
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="size-7"
        aria-label="Dismiss"
        onClick={onDismiss}
      >
        <X className="size-3.5" />
      </Button>
    </div>
  )
}

export function ChatWorkspace({ userEmail }: { userEmail: string }) {
  const [threads, setThreads] = useState<ThreadSummary[]>([])
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [input, setInput] = useState('')
  const [renaming, setRenaming] = useState<ThreadSummary | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleting, setDeleting] = useState<ThreadSummary | null>(null)
  /*
   * Which thread the messages currently in state belong to.
   *
   * Loading is derived from this rather than held as its own flag: setting a
   * flag synchronously at the top of the load effect triggers a cascading
   * render, and React's lint rule rightly rejects it. Comparing the loaded id
   * against the selected one is true from the very first render after a
   * selection, with no extra state transition.
   */
  const [loadedThreadId, setLoadedThreadId] = useState<string | null>(null)
  const loadingHistory = activeThreadId !== null && loadedThreadId !== activeThreadId

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    error,
    clearError,
    regenerate,
    stop,
  } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  })

  /*
   * Current messages and threads, mirrored into refs.
   *
   * createThread needs to read both, but taking them as dependencies would
   * change its identity on every streamed chunk - and the bootstrap effect below
   * keys off that identity. Refs keep the callback stable.
   */
  const messagesRef = useRef(messages)
  const threadsRef = useRef(threads)
  const loadedThreadIdRef = useRef(loadedThreadId)
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])
  useEffect(() => {
    threadsRef.current = threads
  }, [threads])
  useEffect(() => {
    loadedThreadIdRef.current = loadedThreadId
  }, [loadedThreadId])

  const refreshThreads = useCallback(async () => {
    const res = await fetch('/api/threads')
    if (!res.ok) return [] as ThreadSummary[]
    const data = await res.json()
    setThreads(data.threads)
    return data.threads as ThreadSummary[]
  }, [])

  const createThread = useCallback(async () => {
    // Already sitting on an empty thread - reuse it. Otherwise every press of
    // "New" adds another untouched "New chat" to the sidebar, which is how the
    // list fills with identical empty rows.
    //
    // The loading check matters: history is cleared before the fetch resolves,
    // so without it a thread that is merely still loading looks empty and "New"
    // would silently do nothing on a conversation that actually has messages.
    const settled = loadedThreadIdRef.current === activeThreadId
    if (activeThreadId && settled && messagesRef.current.length === 0) {
      setSheetOpen(false)
      return threadsRef.current.find((t) => t.id === activeThreadId) ?? null
    }

    const res = await fetch('/api/threads', { method: 'POST' })
    if (!res.ok) return null
    const { thread } = await res.json()
    setThreads((current) => [thread, ...current])
    setActiveThreadId(thread.id)
    setMessages([])
    // A thread we just created is known to be empty, so mark it loaded here.
    // Without this the load effect would fetch its (empty) history and the
    // student would watch a spinner on a chat that cannot have any messages.
    setLoadedThreadId(thread.id)
    setSheetOpen(false)
    return thread as ThreadSummary
  }, [setMessages, activeThreadId])

  // Guards the bootstrap effect against React 18 double-invoke in dev, which
  // would otherwise create two empty threads on every fresh load.
  const bootstrapped = useRef(false)

  useEffect(() => {
    if (bootstrapped.current) return
    bootstrapped.current = true

    const bootstrap = async () => {
      const existing = await refreshThreads()
      if (existing.length > 0) setActiveThreadId(existing[0].id)
      else await createThread()
    }
    bootstrap()
  }, [refreshThreads, createThread])

  /*
   * Loads the selected thread's history.
   *
   * `loadingHistory` exists to stop a specific flash. Opening a thread left the
   * old `messages` in place until the fetch resolved, and `messages.length === 0`
   * is what renders the empty state - so selecting a thread showed the starter
   * questions for the second or two the request took, then replaced them with
   * the real conversation. Switching between two threads showed the previous
   * thread's messages for that same beat.
   *
   * Clearing immediately and gating on this flag means the pane goes from the
   * old thread straight to a quiet placeholder to the right conversation.
   */
  useEffect(() => {
    if (!activeThreadId) return
    if (loadedThreadId === activeThreadId) return
    let cancelled = false

    const load = async () => {
      let history: unknown[] = []
      try {
        const res = await fetch(
          `/api/chat?threadId=${encodeURIComponent(activeThreadId)}`
        )
        if (res.ok) history = await res.json()
      } catch {
        // A failed load shows an empty thread rather than the previous one's
        // messages. Leaving stale content under a new title is worse.
      }

      if (cancelled) return
      // Both updates happen after an await, so neither runs synchronously
      // inside the effect body.
      setMessages(history as typeof messages)
      setLoadedThreadId(activeThreadId)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [activeThreadId, loadedThreadId, setMessages])

  const submitText = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || !activeThreadId) return
    setInput('')

    // Name the thread from its opening question, before the answer starts
    // arriving. Done here rather than after the response so the sidebar stops
    // showing a column of identical "New chat" rows the instant you ask.
    const isFirstMessage = messagesRef.current.length === 0
    if (isFirstMessage) {
      const title = deriveThreadTitle(trimmed)
      // Optimistic: the row is renamed immediately and the PATCH catches up.
      setThreads((current) =>
        current.map((thread) =>
          thread.id === activeThreadId ? { ...thread, title } : thread
        )
      )
      void fetch(`/api/threads/${activeThreadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })
    }

    await sendMessage({ text: trimmed }, { body: { threadId: activeThreadId } })
    refreshThreads()
  }

  const confirmRename = async () => {
    if (!renaming || !renameValue.trim()) return
    const res = await fetch(`/api/threads/${renaming.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: renameValue.trim() }),
    })
    setRenaming(null)
    if (res.ok) refreshThreads()
  }

  const confirmDelete = async () => {
    if (!deleting) return
    const target = deleting
    setDeleting(null)

    const res = await fetch(`/api/threads/${target.id}`, { method: 'DELETE' })
    if (!res.ok) return

    const remaining = await refreshThreads()
    if (target.id === activeThreadId) {
      if (remaining.length > 0) setActiveThreadId(remaining[0].id)
      else await createThread()
    }
  }

  const activeTitle =
    threads.find((t) => t.id === activeThreadId)?.title ?? 'Aristo'
  const busy = status !== 'ready'

  const navigation = (
    <ThreadList
      threads={threads}
      activeThreadId={activeThreadId}
      onSelect={(id) => {
        setActiveThreadId(id)
        setSheetOpen(false)
      }}
      onRename={(thread) => {
        setSheetOpen(false)
        setRenameValue(thread.title)
        setRenaming(thread)
      }}
      onDelete={(thread) => {
        setSheetOpen(false)
        setDeleting(thread)
      }}
    />
  )

  const accountFooter = (
    <div className="flex flex-col gap-3 border-t p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-muted-foreground text-xs">{userEmail}</span>
        <ThemeToggle />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" render={<Link href="/settings" />}>
          <SlidersHorizontal className="size-3.5" />
          Subjects
        </Button>
        <form action="/auth/signout" method="post" className="flex-1">
          <Button type="submit" variant="outline" size="sm" className="w-full">
            Sign out
          </Button>
        </form>
      </div>
    </div>
  )

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background">
      {/* Desktop rail */}
      <aside className="hidden w-72 shrink-0 flex-col border-r bg-sidebar md:flex">
        <div className="flex items-center justify-between gap-2 p-3">
          <AristoWordmark />
          <Button size="sm" variant="outline" onClick={createThread}>
            <SquarePen className="size-3.5" />
            New
          </Button>
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-3">
          {navigation}
        </nav>
        {accountFooter}
      </aside>

      {/* Mobile sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="md:hidden">
          <div className="flex items-center justify-between gap-2 px-3 py-2.5">
            <AristoWordmark />
            <Button size="sm" variant="outline" onClick={createThread}>
              <SquarePen className="size-3.5" />
              New chat
            </Button>
          </div>
          <nav className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
            {navigation}
          </nav>
          {accountFooter}
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-2 md:hidden">
          <Button
            size="icon"
            variant="ghost"
            aria-label="Open chats"
            onClick={() => setSheetOpen(true)}
          >
            <PanelLeft className="size-4" />
          </Button>
          <span className="min-w-0 flex-1 truncate text-center font-medium text-sm">
            {activeTitle}
          </span>
          <Button
            size="icon"
            variant="ghost"
            aria-label="New chat"
            onClick={createThread}
          >
            <SquarePen className="size-4" />
          </Button>
        </header>

        {loadingHistory ? (
          // Quiet placeholder, never the starter questions: showing those while
          // a real conversation loads tells the student the thread is empty and
          // then contradicts itself a second later.
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <span className="sr-only" role="status">
              Loading conversation
            </span>
            <Spinner aria-hidden className="size-5 text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <EmptyState onPick={submitText} disabled={busy || !activeThreadId} />
          </div>
        ) : (
          <Conversation className="min-h-0 flex-1">
            <ConversationContent className="mx-auto w-full max-w-3xl">
              {messages.map((message) => (
                // A clear gap between turns. Without it a student's question and
                // the answer below it run together into one wall of text.
                // `animate-rise` runs once per mounted element, so a streaming
                // answer doesn't restart it on every arriving chunk.
                <div
                  key={message.id}
                  className="flex animate-rise flex-col gap-3 py-3"
                >
                  {message.parts?.map((part, i) => {
                    if (part.type === 'text') {
                      const isAssistant = message.role !== 'user'
                      return (
                        <Message key={`${message.id}-${i}`} from={message.role}>
                          <MessageContent
                            className={
                              isAssistant
                                ? // Long-form explanation, so give it reading
                                  // typography rather than chat-bubble sizing.
                                  'text-[0.9375rem] leading-relaxed [&_h2]:mt-6 [&_h2]:font-semibold [&_h2]:text-lg [&_h3]:mt-5 [&_h3]:font-semibold [&_h3]:text-base [&_li]:leading-relaxed [&_p]:leading-relaxed'
                                : 'bubble-student overflow-visible px-4 py-2.5 text-[0.9375rem] leading-relaxed group-[.is-user]:rounded-[1.35rem] group-[.is-user]:rounded-br-[0.55rem] group-[.is-user]:bg-[var(--bubble-surface)]'
                            }
                          >
                            <MessageResponse plugins={streamdownPlugins}>
                              {normalizeLatexDelimiters(part.text)}
                            </MessageResponse>
                          </MessageContent>
                          {/* Only once the answer is settled - a copy button on
                              half-streamed text copies a truncated answer. */}
                          {isAssistant && !busy && (
                            <MessageActions className="opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                              <CopyAnswer text={part.text} />
                            </MessageActions>
                          )}
                        </Message>
                      )
                    }

                    if (part.type?.startsWith('tool-')) {
                      return (
                        <Tool key={`${message.id}-${i}`}>
                          <ToolHeader
                            type={(part as ToolUIPart).type}
                            state={(part as ToolUIPart).state || 'output-available'}
                            className="cursor-pointer"
                          />
                          <ToolContent>
                            <ToolInput input={(part as ToolUIPart).input || {}} />
                            <ToolOutput
                              output={(part as ToolUIPart).output}
                              errorText={(part as ToolUIPart).errorText}
                            />
                          </ToolContent>
                        </Tool>
                      )
                    }

                    return null
                  })}
                </div>
              ))}
              {/* The wait between sending and the first token is the one place
                  in the chat where nothing is being read, so it is where the
                  character earns its place. It disappears the moment text
                  starts streaming. */}
              {status === 'submitted' && (
                <div className="flex animate-rise items-center gap-3 py-3">
                  <AristoMascot mood="thinking" className="size-10 shrink-0" />
                  <span className="text-muted-foreground text-sm">
                    Checking your syllabus…
                  </span>
                </div>
              )}

              <ConversationScrollButton />
            </ConversationContent>
          </Conversation>
        )}

        {/* Composer sits in the thumb zone and clears the home indicator. */}
        <div className="shrink-0 border-t bg-background px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto w-full max-w-3xl">
            {error && (
              <ErrorNotice
                error={error}
                onRetry={() => {
                  clearError()
                  regenerate()
                }}
                onDismiss={clearError}
              />
            )}

            {/* No PromptInputBody wrapper. It renders `display: contents`, which
                removes an element from layout but NOT from the DOM tree, so the
                InputGroup's `has-[>textarea]:h-auto` rule stops matching and the
                group keeps its 32px default height - clipping the 64px textarea
                top and bottom. The textarea has to be a direct child. */}
            <PromptInput onSubmit={() => submitText(input)}>
              <PromptInputTextarea
                onChange={(e) => setInput(e.target.value)}
                value={input}
                placeholder="Ask about your syllabus…"
                // Deliberately NOT disabled while streaming. A student who has
                // thought of their follow-up shouldn't have to wait for the
                // current answer to finish before typing it.
                disabled={!activeThreadId}
              />
              <PromptInputFooter>
                <PromptInputTools>
                  <span className="pl-1 text-muted-foreground text-xs">
                    Aristo can make mistakes. Check against your syllabus.
                  </span>
                </PromptInputTools>
                {/* status drives the icon: spinner while submitted, a stop
                    square while streaming, so a long answer stays interruptible. */}
                <PromptInputSubmit
                  status={status}
                  onStop={stop}
                  disabled={!busy && (!input.trim() || !activeThreadId)}
                />
              </PromptInputFooter>
            </PromptInput>
          </div>
        </div>
      </div>

      <Dialog open={renaming !== null} onOpenChange={(open) => !open && setRenaming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename chat</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="thread-title">Title</Label>
            <Input
              id="thread-title"
              value={renameValue}
              maxLength={200}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  confirmRename()
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(null)}>
              Cancel
            </Button>
            <Button onClick={confirmRename} disabled={!renameValue.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete chat</DialogTitle>
            <DialogDescription>
              “{deleting?.title}” and all of its messages will be permanently
              deleted. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
