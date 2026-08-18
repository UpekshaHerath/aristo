import { NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'

// FormData streaming and an outbound multipart POST, so not Edge.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// A minute of speech transcribes in a second or two; the ceiling only covers a
// slow upload from a phone.
export const maxDuration = 30

const GROQ_TRANSCRIPTION_URL =
  'https://api.groq.com/openai/v1/audio/transcriptions'
// Whisper large v3 turbo: the cheapest Groq speech model, and the only one whose
// latency is short enough to sit behind a press-to-talk button.
const TRANSCRIPTION_MODEL = 'whisper-large-v3-turbo'
/**
 * Groq's own limit is 25 MB on the free tier. Rejecting here rather than paying
 * for the upload first keeps a stuck recorder from burning the request budget.
 */
const MAX_AUDIO_BYTES = 25 * 1024 * 1024

/**
 * Transcribes a recorded clip for browsers without the Web Speech API.
 *
 * Chrome, Edge, Opera and Safari (14.1+ / iOS 14.5+) all speak SpeechRecognition
 * and never reach this route. In practice that leaves Firefox, which ships the
 * API disabled behind dom.webspeech.recognition.enable - there the composer
 * records with MediaRecorder and posts the clip here instead. Billed per second
 * of audio, so it stays a fallback rather than the default path.
 */
export async function POST(req: Request) {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    // 501, not 500: nothing is broken, the deployment simply has no speech key.
    return NextResponse.json(
      { error: 'Voice input is not configured on this server.' },
      { status: 501 }
    )
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json(
      { error: 'Expected an audio upload.' },
      { status: 400 }
    )
  }

  const audio = form.get('audio')
  if (!(audio instanceof File) || audio.size === 0) {
    return NextResponse.json(
      { error: 'No audio was received.' },
      { status: 400 }
    )
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      { error: 'That recording is too long. Keep it under 25 MB.' },
      { status: 413 }
    )
  }

  const upstream = new FormData()
  // Groq picks the decoder from the extension, so the filename matters even
  // though the content type is already set on the blob.
  upstream.set('file', audio, audio.name || 'speech.webm')
  upstream.set('model', TRANSCRIPTION_MODEL)
  upstream.set('response_format', 'json')

  try {
    const res = await fetch(GROQ_TRANSCRIPTION_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstream,
    })

    if (!res.ok) {
      const detail = await res.text()
      console.error('[api/transcribe] groq rejected the clip', res.status, detail)
      // The upstream body can carry the key, so it is logged but not returned.
      return NextResponse.json(
        {
          error:
            res.status === 429
              ? 'Speech-to-text is rate limited right now. Try again in a moment.'
              : "That recording couldn't be transcribed.",
        },
        { status: res.status === 429 ? 429 : 502 }
      )
    }

    const { text } = (await res.json()) as { text?: string }
    return NextResponse.json({ text: text?.trim() ?? '' })
  } catch (cause) {
    console.error('[api/transcribe] request failed', cause)
    return NextResponse.json(
      { error: 'Speech-to-text is unreachable right now.' },
      { status: 502 }
    )
  }
}
