/**
 * Rewrites LaTeX delimiters into the dollar form the markdown renderer parses.
 *
 * Models emit `\(inline\)` and `\[display\]` - that is what OpenAI-lineage
 * models are trained to produce, and asking for dollars in the system prompt
 * does not change it (gpt-oss-120b ignored an explicit instruction in testing).
 * @streamdown/math only recognises `$...$` and `$$...$$`, so untranslated
 * markup reaches the student as literal backslashes: `\[ V = N A \frac{...} \]`.
 *
 * Doing this at render time rather than in the prompt keeps it deterministic and
 * independent of which model is configured.
 */

/** Matches a fenced code block (``` or ~~~) or an inline code span. */
const CODE_SPAN = /(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/

export function normalizeLatexDelimiters(markdown: string): string {
  // Split on code so the substitutions below never rewrite a fenced example
  // that is deliberately showing raw LaTeX. The capture group means the
  // delimiters themselves land in the array and pass through untouched.
  return markdown
    .split(new RegExp(CODE_SPAN.source, 'g'))
    .map((segment, i) =>
      // Odd indices are the captured code spans.
      i % 2 === 1
        ? segment
        : segment
            // Display first: `\[ ... \]` -> `$$ ... $$`.
            .replace(/\\\[([\s\S]*?)\\\]/g, (_, body) => `$$${body}$$`)
            // Then inline: `\( ... \)` -> `$ ... $`.
            .replace(/\\\(([\s\S]*?)\\\)/g, (_, body) => `$${body}$`)
    )
    .join('')
}
