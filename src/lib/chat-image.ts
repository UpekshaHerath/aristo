import { nanoid } from 'nanoid'
import type { FileUIPart } from 'ai'

import { createClient } from '@/lib/supabase/client'

export const CHAT_IMAGE_BUCKET = 'chat-images'

/** What the composer will let a student pick. Matches the bucket's mime allowlist. */
export const ACCEPTED_IMAGE_TYPES =
  'image/jpeg,image/png,image/webp,image/heic,image/heif'

/** One image per question. Two photos of the same page is the common mistake, not a use case. */
export const MAX_IMAGES_PER_MESSAGE = 1

/** Ceiling on what leaves the phone, checked before any decoding work. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024

/**
 * Longest edge kept after downscaling, in pixels.
 *
 * Gemini bills an image as 258 tokens per 768x768 tile, so pixels are money and
 * latency. 1568 is the smallest size at which a photographed exam question is
 * still legible - below roughly 1200 the model starts misreading subscripts and
 * handwritten minus signs, which is exactly the content it is being shown.
 */
const MAX_EDGE = 1568

/** Re-encode quality. 0.85 is where JPEG artefacts stop eating thin pencil strokes. */
const JPEG_QUALITY = 0.85

/**
 * How long the signed read URL stays valid.
 *
 * The URL is persisted inside the message, so its lifetime is the lifetime of
 * the thread as far as the student is concerned. A year is a full Cambridge
 * course; past that the image 404s and the text of the conversation remains.
 */
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 365

/** Raised for anything the student needs told about, so callers can show `.message`. */
export class ChatImageError extends Error {}

/** True for the parts this module handles - a photo, not a PDF or a stray file. */
export function isImagePart(part: { type?: string; mediaType?: string }): boolean {
  return part.type === 'file' && (part.mediaType?.startsWith('image/') ?? false)
}

function extensionFor(mediaType: string) {
  if (mediaType === 'image/png') return 'png'
  if (mediaType === 'image/webp') return 'webp'
  // Only reachable when the canvas couldn't decode the photo, which is the
  // usual outcome for an iPhone HEIC outside Safari. The bytes go up as they
  // came, so the name has to match them.
  if (mediaType === 'image/heic') return 'heic'
  if (mediaType === 'image/heif') return 'heif'
  return 'jpg'
}

/**
 * Shrinks a photo to `MAX_EDGE` and re-encodes it as JPEG.
 *
 * Returns the bytes untouched when they are already small enough, and also when
 * decoding fails. HEIC is the reason for that second case: an iPhone photo is
 * HEIC by default and only Safari can decode it into a canvas, so on every
 * other browser the original bytes are uploaded and Gemini does the decoding.
 */
async function downscale(
  source: Blob,
  mediaType: string
): Promise<{ blob: Blob; mediaType: string }> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(source)
  } catch {
    return { blob: source, mediaType }
  }

  try {
    const longest = Math.max(bitmap.width, bitmap.height)
    if (longest <= MAX_EDGE) {
      return { blob: source, mediaType }
    }

    const scale = MAX_EDGE / longest
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)

    const ctx = canvas.getContext('2d')
    if (!ctx) return { blob: source, mediaType }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
    )
    if (!blob) return { blob: source, mediaType }

    return { blob, mediaType: 'image/jpeg' }
  } finally {
    bitmap.close()
  }
}

/**
 * Moves one composer attachment into the student's own storage folder and
 * returns the part to actually send.
 *
 * PromptInput hands over a `data:` URL. Sending that as-is would work for one
 * turn and be wrong forever after: the base64 is roughly a third larger than
 * the file, it is written verbatim into the message row, and memory replays it
 * on every subsequent turn of the thread. A storage URL is a few hundred bytes
 * and is fetched only when something actually needs the pixels.
 *
 * Uploaded straight from the browser rather than through a route handler
 * because a Vercel serverless function caps its request body at 4.5 MB, which a
 * single phone photo clears. Row Level Security on `storage.objects` is what
 * makes that safe - see supabase/migrations/0002_chat_images.sql - so the path
 * prefix has to be the caller's own user id or the insert is rejected.
 */
export async function uploadChatImage(part: FileUIPart): Promise<FileUIPart> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    throw new ChatImageError('Sign in again to attach an image.')
  }

  let original: Blob
  try {
    original = await (await fetch(part.url)).blob()
  } catch {
    throw new ChatImageError("That image couldn't be read. Try attaching it again.")
  }

  if (original.size > MAX_IMAGE_BYTES) {
    throw new ChatImageError('That image is too large. Keep it under 10 MB.')
  }

  const { blob, mediaType } = await downscale(original, part.mediaType)
  const path = `${user.id}/${nanoid()}.${extensionFor(mediaType)}`

  const { error: uploadError } = await supabase.storage
    .from(CHAT_IMAGE_BUCKET)
    .upload(path, blob, { contentType: mediaType, upsert: false })
  if (uploadError) {
    throw new ChatImageError("That image couldn't be uploaded. Try again.")
  }

  // Signed rather than public: the bucket is private, and this URL is what both
  // the model's fetch and the student's own browser use to read the bytes back.
  const { data, error: signError } = await supabase.storage
    .from(CHAT_IMAGE_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
  if (signError || !data?.signedUrl) {
    throw new ChatImageError("That image couldn't be prepared. Try again.")
  }

  return {
    type: 'file',
    mediaType,
    filename: part.filename,
    url: data.signedUrl,
  }
}
