/** Longest title we keep. Past this the sidebar truncates anyway. */
const MAX_LENGTH = 60

/**
 * Turns a student's first question into a thread title.
 *
 * Deliberately deterministic rather than model-generated: it lands the moment
 * the question is sent, costs nothing, and can't be lost to a rate limit.
 *
 * Trimming happens at a word boundary. Cutting mid-word produces titles like
 * "Explain electromagnetic induc…", which reads as a rendering bug rather than
 * an abbreviation.
 */
export function deriveThreadTitle(question: string): string {
  const cleaned = question
    // Markdown and LaTeX punctuation carry no meaning in a sidebar label.
    .replace(/[*_`#>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!cleaned) return 'New chat'

  if (cleaned.length <= MAX_LENGTH) {
    // A trailing question mark is redundant once it's a label, but a trailing
    // digit or letter must survive - "Physics 0625" should not become "Physics".
    return cleaned.replace(/[\s?.,;:]+$/, '')
  }

  const clipped = cleaned.slice(0, MAX_LENGTH)
  const lastSpace = clipped.lastIndexOf(' ')

  // Fall back to the hard cut when the first 60 characters hold no space at
  // all, which a pasted URL or a long formula can manage.
  const body = lastSpace > MAX_LENGTH * 0.5 ? clipped.slice(0, lastSpace) : clipped

  return `${body.replace(/[\s?.,;:]+$/, '')}…`
}
