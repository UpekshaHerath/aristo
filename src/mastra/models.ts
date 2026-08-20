import { MAX_INPUT_TOKENS } from './rag/config'

/**
 * Which model answers a turn, and how much input it is allowed.
 *
 * Aristo runs on two models rather than one because no Groq model can see. The
 * provider registry lists fifteen - gpt-oss, llama, qwen, whisper, compound -
 * and not one of them accepts image input, so a turn carrying a photo has to
 * leave Groq entirely. The route decides which of the two applies and puts the
 * answer in the request context; see src/app/api/chat/route.ts.
 */

/** Request context key set by the chat route when the turn carries an image. */
export const HAS_IMAGE = 'hasImage'

/**
 * Text-only turns, which is nearly all of them.
 *
 * NOT llama-3.3-70b-versatile. It emits a malformed tool-call tag on Groq -
 * `<function=searchSyllabus{...}` with no closing `>` after the name - which
 * Groq rejects with `tool_use_failed`. Measured 4 failures in 5 attempts, so
 * grounding is effectively dead on that model. gpt-oss-120b uses structured
 * tool calling and failed none. Its free-tier rate limit is the tighter
 * constraint; openai/gpt-oss-20b is the fallback if 429s become a problem.
 */
export const TEXT_MODEL = 'groq/openai/gpt-oss-120b'

/**
 * Turns carrying an image.
 *
 * Google rather than a second provider because the syllabus embeddings already
 * run on GOOGLE_API_KEY, so this adds a model, not a vendor or a key.
 *
 * flash-lite rather than flash: the images are photographs of handwriting and
 * hand-drawn diagrams, where the binding constraint is character recognition,
 * and 3.5-flash-lite reads a pencilled subscript as well as flash does at a
 * fifth of the output price. Charged per token like any other input - a
 * downscaled photo is roughly 800 image tokens - so a turn costs fractions of
 * a cent, and nothing at all while the free tier holds.
 */
export const VISION_MODEL = 'google/gemini-3.5-flash-lite'

/**
 * Input ceiling for an image turn.
 *
 * MAX_INPUT_TOKENS exists to survive Groq's 8000 tokens-per-minute free tier
 * and is far too tight here: an image is worth hundreds to low thousands of
 * tokens on its own, so applying the text limit would make the trimmer drop
 * either the photo or the syllabus passages the answer is meant to be grounded
 * in. Gemini's free tier is not priced the same way and its context is orders
 * of magnitude larger, so the limit only needs to stop a runaway thread.
 */
export const MAX_VISION_INPUT_TOKENS = 24_000

/** The two ceilings together, so a caller picks one rather than remembering both. */
export const inputTokenLimitFor = (hasImage: boolean) =>
  hasImage ? MAX_VISION_INPUT_TOKENS : MAX_INPUT_TOKENS
