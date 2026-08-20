'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { DefaultChatTransport, type ChatStatus, type FileUIPart, type ToolUIPart } from 'ai'
import { useChat } from '@ai-sdk/react'
import {
  Check,
  Copy,
  ImagePlus,
  LogOut,
  PanelLeft,
  RotateCcw,
  SlidersHorizontal,
  SquarePen,
  X,
} from 'lucide-react'

import {
  PromptInput,
  PromptInputButton,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
  type PromptInputMessage,
} from '@/components/ai-elements/prompt-input'
import {
  Attachment,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from '@/components/ai-elements/attachments'
import { SpeechInput } from '@/components/ai-elements/speech-input'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ThemeToggle } from '@/components/theme-toggle'
import { normalizeLatexDelimiters } from '@/lib/latex'
import { deriveThreadTitle } from '@/lib/thread-title'
import {
  ACCEPTED_IMAGE_TYPES,
  ChatImageError,
  MAX_IMAGES_PER_MESSAGE,
  MAX_IMAGE_BYTES,
  isImagePart,
  uploadChatImage,
} from '@/lib/chat-image'
import { AristoWordmark } from '@/components/brand/aristo-mark'
import { AristoMascot } from '@/components/brand/aristo-mascot'
import { cjk } from '@streamdown/cjk'
import { code } from '@streamdown/code'
import { createMathPlugin } from '@streamdown/math'
import { mermaid } from '@streamdown/mermaid'
import { ConversationSkeleton } from './conversation-skeleton'
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

/**
 * Opens the file picker for the composer.
 *
 * Its own component because `usePromptInputAttachments` reads a context that
 * PromptInput provides, so the hook can only run inside it.
 */
function AttachImageButton({ disabled }: { disabled?: boolean }) {
  const attachments = usePromptInputAttachments()
  const full = attachments.files.length >= MAX_IMAGES_PER_MESSAGE

  return (
    <PromptInputButton
      // Inside the composer's form, the default submit type would fire the
      // question off the moment the student reaches for a photo.
      type="button"
      size="icon-sm"
      aria-label="Attach a photo"
      title={full ? 'One photo per question' : 'Attach a photo'}
      disabled={disabled || full}
      onClick={attachments.openFileDialog}
    >
      <ImagePlus className="size-4" />
    </PromptInputButton>
  )
}

/** The picked photo, shown above the textarea until the question is sent. */
function ComposerAttachments() {
  const attachments = usePromptInputAttachments()
  if (attachments.files.length === 0) return null

  return (
    <Attachments className="ml-0 px-3 pt-3" variant="grid">
      {attachments.files.map((file) => (
        <Attachment
          data={file}
          key={file.id}
          onRemove={() => attachments.remove(file.id)}
        >
          <AttachmentPreview />
          <AttachmentRemove />
        </Attachment>
      ))}
    </Attachments>
  )
}

/**
 * The send button.
 *
 * Split out for the same reason as the two components above: whether there is
 * anything to send depends on the attached files, and those live in a context
 * only PromptInput's children can read. A photo with no typed question is a
 * complete message, so an empty textarea is not on its own a reason to disable.
 */
function ComposerSubmit({
  busy,
  disabled,
  hasText,
  onStop,
  status,
  uploading,
}: {
  busy: boolean
  disabled: boolean
  hasText: boolean
  onStop: () => void
  status: ChatStatus
  uploading: boolean
}) {
  const attachments = usePromptInputAttachments()
  const empty = !hasText && attachments.files.length === 0

  return (
    // The spinner is borrowed for the upload too. From the student's side the
    // wait is the same wait - the question is on its way - and a send button
    // that looks idle while a photo uploads invites a second press.
    <PromptInputSubmit
      status={uploading ? 'submitted' : status}
      onStop={onStop}
      disabled={uploading || (!busy && (empty || disabled))}
    />
  )
}

/** Copies an answer, confirming with a tick so the click isn't silent. */
function CopyAnswer({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(timer)
  }, [copied])

  const label = copied ? 'Copied' : 'Copy answer'

  const copy = async () => {
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
  }

  return (
    <MessageAction label={label} onClick={copy} tooltip={label}>
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
  /*
   * The transport throws with the raw response body as the message, so a route
   * that answered `{"error":"..."}` carries its reason here. Unwrapping it is
   * what turns "That answer didn't come through" - which names no cause and
   * suggests no action - into something a student can act on.
   */
  let detail = error.message
  try {
    const parsed = JSON.parse(detail)
    if (typeof parsed?.error === 'string') detail = parsed.error
  } catch {
    // Not JSON - a model or network error. The message stands as-is.
  }

  // Rate limits are the common case on a free model tier and are worth naming,
  // since the fix is simply to wait rather than to rephrase the question.
  // Groq reports the per-minute token ceiling as "request too large" with a 413
  // rather than a 429, so that wording has to be matched here too or it falls
  // through to the generic copy and reads like a bug in the app.
  const rateLimited =
    /rate.?limit|429|413|quota|too large|tokens per minute|tpm/i.test(detail)
  // A session that expired mid-visit needs a sign-in, not a retry.
  const signedOut = /not authenticated|401/i.test(detail)

  return (
    <div
      role="alert"
      className="mb-2 flex animate-rise items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2.5 text-sm"
    >
      <AristoMascot mood="concerned" className="-mt-0.5 size-7 shrink-0" />
      <div className="min-w-0 flex-1 text-foreground/90">
        <p>
          {rateLimited
            ? 'Aristo is busy right now - the free model tier is rate limited. Wait a few seconds and try again.'
            : signedOut
              ? 'Your session expired. Sign in again to keep going.'
              : "That answer didn't come through."}
        </p>
        {!rateLimited && !signedOut && detail && (
          // Shown, not swallowed: a retry that keeps failing for the same
          // reason is unfixable when the reason is never named.
          <p className="mt-0.5 text-muted-foreground text-xs break-words">
            {detail}
          </p>
        )}
      </div>
      {signedOut ? (
        <Button size="sm" variant="outline" className="h-7" render={<Link href="/login" />}>
          Sign in
        </Button>
      ) : (
        <Button size="sm" variant="outline" className="h-7" onClick={onRetry}>
          <RotateCcw className="size-3.5" />
          Retry
        </Button>
      )}
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
  /*
   * Whether the thread list has been fetched at least once.
   *
   * Only the empty case needs it: an empty `threads` array means "none yet" and
   * "not asked yet" equally, and the sidebar's copy states the first as fact.
   * Set inside the fetch after its await, so it never fires during a render.
   */
  const [threadsSettled, setThreadsSettled] = useState(false)
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
  const composerRef = useRef<HTMLTextAreaElement>(null)
  /*
   * Why the composer needs its own error slot: the chat `error` above belongs
   * to useChat and is cleared by its own retry, and it only ever covers a turn
   * that reached the agent. Everything that fails before that - a denied
   * microphone, a rejected clip, an image that wouldn't upload - would leave a
   * button that appears to do nothing.
   */
  const [composerError, setComposerError] = useState<string | null>(null)
  /*
   * True while a photo is on its way to storage. The send button waits on it:
   * an image that hasn't finished uploading has no URL for the model to fetch.
   */
  const [uploading, setUploading] = useState(false)

  /**
   * Adds a finished phrase to whatever is already typed.
   *
   * Appended rather than sent: dictation mishears names and formulae, and a
   * question that goes straight to the agent can't be corrected first. The
   * student reviews, edits, then presses send as usual.
   */
  const appendTranscript = useCallback((text: string) => {
    const phrase = text.trim()
    if (!phrase) return
    setComposerError(null)
    setInput((current) =>
      current.trim() ? `${current.trimEnd()} ${phrase}` : phrase
    )
    composerRef.current?.focus()
  }, [])

  /**
   * Fallback path for browsers without SpeechRecognition - in practice Firefox,
   * which ships it disabled by default. SpeechInput records with MediaRecorder
   * and hands the clip here, where it is transcribed server-side for a fee.
   */
  const transcribeRecording = useCallback(async (audio: Blob) => {
    setComposerError(null)
    let res: Response
    try {
      const body = new FormData()
      // The filename is what tells the server-side decoder the container type.
      body.append('audio', audio, 'speech.webm')
      res = await fetch('/api/transcribe', { method: 'POST', body })
    } catch {
      setComposerError('Could not reach the server to transcribe that.')
      return ''
    }

    if (!res.ok) {
      const detail = await res
        .json()
        .then((body: { error?: string }) => body.error)
        .catch(() => undefined)
      setComposerError(detail ?? "That recording couldn't be transcribed.")
      return ''
    }

    const { text } = (await res.json()) as { text?: string }
    if (!text) {
      setComposerError("Didn't catch that. Try again a little closer to the mic.")
    }
    return text ?? ''
  }, [])

  /*
   * Focus the composer whenever a chat is opened - on mount and on every thread
   * switch, including "New chat". The workspace never unmounts between threads,
   * so `autoFocus` would only ever fire once; keying the effect on the active
   * thread covers the later opens too. Skipped on coarse pointers, where taking
   * focus pops the on-screen keyboard over a conversation the student is still
   * reading.
   */
  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return
    composerRef.current?.focus()
  }, [activeThreadId])
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
    // Marked settled either way. A failed first fetch should fall through to the
    // empty copy, not leave the sidebar loading forever.
    if (!res.ok) {
      setThreadsSettled(true)
      return [] as ThreadSummary[]
    }
    const data = await res.json()
    setThreads(data.threads)
    setThreadsSettled(true)
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

  /**
   * Sends one question, with or without a photo attached.
   *
   * Throws rather than returning quietly when the upload fails, because that is
   * what stops PromptInput clearing the composer - the student keeps both their
   * typed question and the photo they picked, and can simply press send again.
   */
  const submitMessage = async ({ text, files }: PromptInputMessage) => {
    const trimmed = text.trim()
    const images = (files ?? []).filter(isImagePart)
    if ((!trimmed && images.length === 0) || !activeThreadId) return

    // The photo has to reach storage before the turn is sent: what goes into the
    // message is a URL, and the model fetches it server-side.
    let attachments: typeof images = []
    if (images.length > 0) {
      setUploading(true)
      try {
        attachments = await Promise.all(images.map(uploadChatImage))
      } catch (cause) {
        setComposerError(
          cause instanceof ChatImageError
            ? cause.message
            : "That image couldn't be uploaded. Try again."
        )
        throw cause
      } finally {
        setUploading(false)
      }
    }

    setInput('')
    setComposerError(null)

    // Name the thread from its opening question, before the answer starts
    // arriving. Done here rather than after the response so the sidebar stops
    // showing a column of identical "New chat" rows the instant you ask.
    const isFirstMessage = messagesRef.current.length === 0
    if (isFirstMessage) {
      // A photo sent with no question of its own has no words to name the thread
      // after, so it gets a placeholder that at least says what is in it.
      const title = trimmed ? deriveThreadTitle(trimmed) : 'Photo question'
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

    // A photo on its own goes without a text part rather than with an empty one:
    // an empty string still becomes a part, and it renders as a blank bubble
    // above the image for the rest of the thread's life.
    await sendMessage(
      trimmed
        ? { text: trimmed, files: attachments }
        : { files: attachments },
      { body: { threadId: activeThreadId } }
    )
    refreshThreads()
  }

  /** The text-only path, for the suggestion chips on an empty thread. */
  const submitText = (text: string) => submitMessage({ text, files: [] })

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
      loading={!threadsSettled}
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

  /*
   * The account row.
   *
   * Was three stacked controls - an email line, then Subjects and Sign out side
   * by side - which gave the two rarest actions in the app the most permanent
   * furniture in the sidebar. They now live behind the account itself, which is
   * where someone goes looking for them, and the footer is a single row.
   */
  const accountFooter = (
    <div className="flex items-center gap-2 border-t p-2">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              // Left-aligned and greedy: the email is the label, so it should
              // read as a line of text you can press, not a centred caption.
              className="h-9 min-w-0 flex-1 justify-start gap-2 px-1.5 font-normal"
              aria-label="Account menu"
            />
          }
        >
          <span
            aria-hidden
            className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 font-medium text-[0.6875rem] text-primary uppercase"
          >
            {userEmail.slice(0, 1)}
          </span>
          <span className="min-w-0 flex-1 truncate text-left text-muted-foreground text-xs">
            {userEmail}
          </span>
        </DropdownMenuTrigger>

        {/* Opens upward - it is pinned to the bottom of the sidebar, and on a
            phone it is inches from the bottom of the screen. */}
        <DropdownMenuContent align="start" side="top" className="w-56">
          {/* Really a link, not a button: it navigates to /settings, so it
              should be middle-clickable and open in a new tab. Base UI assumes
              a native <button> unless told otherwise, and warns because
              rendering an <a> would silently drop button semantics. Here
              dropping them is the intent, so nativeButton is false. */}
          <DropdownMenuItem nativeButton={false} render={<Link href="/settings" />}>
            <SlidersHorizontal className="size-3.5" />
            Subjects
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {/* Still a real form post rather than a click handler - sign-out has
              to clear an httpOnly cookie, which only the server can do. */}
          <form action="/auth/signout" method="post">
            <DropdownMenuItem nativeButton render={<button type="submit" className="w-full" />}>
              <LogOut className="size-3.5" />
              Sign out
            </DropdownMenuItem>
          </form>
        </DropdownMenuContent>
      </DropdownMenu>

      <ThemeToggle />
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
        {/* bg-inherit, so the sticky group headings inside have the sidebar's
            own colour to sit on as rows scroll under them. */}
        <nav className="min-h-0 flex-1 overflow-y-auto bg-inherit px-1.5 pb-3">
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
          <nav className="min-h-0 flex-1 overflow-y-auto bg-inherit px-1.5 pb-2">
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

        {loadingHistory || !threadsSettled ? (
          // Quiet placeholder, never the starter questions: showing those while
          // a real conversation loads tells the student the thread is empty and
          // then contradicts itself a second later. Message-shaped rather than a
          // spinner, so switching threads holds the conversation's layout
          // instead of collapsing to a dot and springing back.
          //
          // `threadsSettled` covers the same flash at boot: until the first
          // fetch lands there is no active thread yet, and without it the
          // starter questions appear for that beat on every page load.
          <ConversationSkeleton />
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
                    // A photo the student attached. Pinned right like their
                    // text bubble so a question made of an image and a sentence
                    // reads as one turn rather than two.
                    if (isImagePart(part)) {
                      const file = part as FileUIPart
                      return (
                        <Attachments
                          className="ml-auto"
                          key={`${message.id}-${i}`}
                          variant="grid"
                        >
                          <Attachment
                            className="size-40"
                            data={{ ...file, id: `${message.id}-${i}` }}
                          >
                            <AttachmentPreview />
                          </Attachment>
                        </Attachments>
                      )
                    }

                    if (part.type === 'text') {
                      const isAssistant = message.role !== 'user'
                      return (
                        <Message key={`${message.id}-${i}`} from={message.role}>
                          <MessageContent
                            className={
                              isAssistant
                                ? // Long-form explanation, so give it reading
                                  // typography rather than chat-bubble sizing.
                                  // The katex rule is a phone fix. Display maths
                                  // does not wrap, and the content box clips
                                  // rather than scrolls - so on a narrow screen
                                  // a long equation simply lost its right-hand
                                  // side. Scrolling the equation itself keeps
                                  // that inside the message instead of dragging
                                  // the conversation sideways.
                                  'text-[0.9375rem] leading-relaxed [&_.katex-display]:overflow-x-auto [&_.katex-display]:py-1 [&_h2]:mt-6 [&_h2]:font-semibold [&_h2]:text-lg [&_h3]:mt-5 [&_h3]:font-semibold [&_h3]:text-base [&_li]:leading-relaxed [&_p]:leading-relaxed'
                                : // mr-7 reserves the tail's own width. The
                                  // tail is drawn by pseudo-elements that reach
                                  // 1.6rem past the bubble's right edge, and the
                                  // bubble is pinned to the right of the column
                                  // - so without this it hangs over the scroll
                                  // container's edge and the whole conversation
                                  // slides sideways on a phone.
                                  'bubble-student mr-7 overflow-visible px-4 py-2.5 text-[0.9375rem] leading-relaxed group-[.is-user]:rounded-[1.35rem] group-[.is-user]:rounded-br-[0.55rem] group-[.is-user]:bg-[var(--bubble-surface)]'
                            }
                          >
                            <MessageResponse plugins={streamdownPlugins}>
                              {normalizeLatexDelimiters(part.text)}
                            </MessageResponse>
                          </MessageContent>
                          {/* Only once the answer is settled - a copy button on
                              half-streamed text copies a truncated answer. */}
                          {isAssistant && !busy && (
                            // Hidden until hovered on a desktop, always present
                            // on a touch screen. A phone has no hover, so the
                            // copy button was simply unreachable there.
                            <MessageActions className="opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
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
                            // The pointer now comes from the base layer. What
                            // was missing is the other half: a header that
                            // expands on click but never reacts to the pointer
                            // gives no sign it is a control at all.
                            className="rounded-md transition-colors hover:bg-accent/50"
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
                  if (!activeThreadId) return
                  clearError()
                  // The threadId has to be repeated here. `regenerate` does not
                  // reuse the body from the send it is retrying, so without it
                  // the route sees no threadId and answers 400 - which made
                  // Retry fail every single time.
                  regenerate({ body: { threadId: activeThreadId } })
                }}
                onDismiss={clearError}
              />
            )}

            {/* No PromptInputBody wrapper. It renders `display: contents`, which
                removes an element from layout but NOT from the DOM tree, so the
                InputGroup's `has-[>textarea]:h-auto` rule stops matching and the
                group keeps its 32px default height - clipping the 64px textarea
                top and bottom. The textarea has to be a direct child. */}
            <PromptInput
              accept={ACCEPTED_IMAGE_TYPES}
              maxFiles={MAX_IMAGES_PER_MESSAGE}
              maxFileSize={MAX_IMAGE_BYTES}
              multiple={false}
              onError={(err) =>
                setComposerError(
                  err.code === 'accept'
                    ? 'Attach a photo - JPEG, PNG, WebP or HEIC.'
                    : err.code === 'max_file_size'
                      ? 'That image is too large. Keep it under 10 MB.'
                      : 'One photo per question.'
                )
              }
              // The text comes from `input` rather than from the submitted
              // message: the textarea is controlled here, and dictation writes
              // into that same state. Only the files are read off the event.
              onSubmit={(message) =>
                submitMessage({ text: input, files: message.files })
              }
            >
              <ComposerAttachments />
              <PromptInputTextarea
                ref={composerRef}
                onChange={(e) => {
                  setInput(e.target.value)
                  // Typing is the student moving on; the last dictation failure
                  // stops being news at that point.
                  if (composerError) setComposerError(null)
                }}
                value={input}
                placeholder="Ask about your syllabus…"
                // Deliberately NOT disabled while streaming. A student who has
                // thought of their follow-up shouldn't have to wait for the
                // current answer to finish before typing it.
                disabled={!activeThreadId}
              />
              <PromptInputFooter>
                <PromptInputTools>
                  {/* type="button": inside the composer's form, the default
                      submit type would fire the question off mid-sentence. */}
                  <SpeechInput
                    type="button"
                    size="icon-sm"
                    aria-label="Dictate your question"
                    title="Dictate your question"
                    disabled={!activeThreadId}
                    onTranscriptionChange={appendTranscript}
                    onAudioRecorded={transcribeRecording}
                  />
                  <AttachImageButton disabled={!activeThreadId || uploading} />
                  {/* The disclaimer's slot doubles as the composer's error line,
                      so a failed dictation or upload is named where the student
                      is looking instead of adding a second line of chrome. */}
                  <span
                    className={
                      composerError
                        ? 'pl-1 text-destructive text-xs'
                        : 'pl-1 text-muted-foreground text-xs'
                    }
                    role={composerError ? 'alert' : undefined}
                  >
                    {composerError ??
                      'Aristo can make mistakes. Check against your syllabus.'}
                  </span>
                </PromptInputTools>
                {/* status drives the icon: spinner while submitted, a stop
                    square while streaming, so a long answer stays interruptible. */}
                <ComposerSubmit
                  busy={busy}
                  disabled={!activeThreadId}
                  hasText={Boolean(input.trim())}
                  onStop={stop}
                  status={status}
                  uploading={uploading}
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
