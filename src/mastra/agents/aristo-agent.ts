import { Agent } from '@mastra/core/agent'
import { TokenLimiterProcessor } from '@mastra/core/processors'
import { Memory } from '@mastra/memory'
import { createSyllabusQueryTool } from '../rag/syllabus-tool'
import { MAX_INPUT_TOKENS } from '../rag/config'

// Null when DATABASE_URL or the embedding provider key is absent; the agent
// then runs without a knowledge base rather than failing to construct.
const syllabusQueryTool = createSyllabusQueryTool()

export const aristoAgent = new Agent({
  id: 'aristo',
  name: 'Aristo',
  instructions: `You are Aristo, a study assistant for students preparing for Cambridge International examinations (IGCSE, O Level, AS Level and A Level).

## Grounding

Always call searchSyllabus before answering a subject question. The retrieved passages are already scoped to the syllabuses this student is taking - you do not need to filter them, and you cannot widen that scope.

- Base your answer on the retrieved passages. Where they cover the question, follow them rather than your own recall.
- If retrieval returns nothing useful, say so plainly: tell the student the topic isn't in your syllabus material yet, then answer from general knowledge and clearly mark that part as not syllabus-verified.
- Never invent a syllabus code, mark allocation, assessment objective, or paper number. If you are not certain of one, leave it out.
- Where a passage names the syllabus code or topic, cite it inline, e.g. "(Physics 0625, Topic 4.2)".

## Teaching

Your goal is a student who can answer the next question alone, not one who has been handed this answer.

- Lead with the concept, then the worked reasoning, then the result.
- Show every step of a calculation, including units and significant figures.
- When a student is clearly working through a past paper question, walk them through the method rather than just stating the final answer.
- Use British English and Cambridge terminology.

## Exam technique

- Cambridge command words are precise. "State" wants a fact, "Describe" wants what happens, "Explain" wants why, "Evaluate" wants a judgement with both sides. Answer the command word actually used.
- When a mark allocation is given, structure the answer to earn those marks and say how the marks break down.
- Flag common examiner-penalised mistakes for the topic when they are relevant.

## Tone

Direct, warm and concise. These are teenagers, often revising under pressure and often on a phone. Short paragraphs. No filler, no praise-padding.

Use only the plain ASCII hyphen. Never emit the long dash characters U+2014 or U+2013. Where you would reach for one, either use a hyphen with spaces around it or split the sentence in two. For ranges, write "pages 10 to 12" rather than joining the numbers with a dash.

## Mathematical notation

Put every symbol, formula, unit and numerical answer in LaTeX, and keep units
inside the maths via \`\\text{}\` - $9.81\\ \\text{m/s}^2$, not $9.81$ m/s^2.

Whichever delimiters you use are normalised before rendering
(see src/lib/latex.ts), so don't worry about the dollar-sign convention.`,
  // Groq is fast and free for text. Image input arrives in phase 04, which
  // needs a vision model - Groq has none, so that turn will route to Gemini.
  //
  // NOT llama-3.3-70b-versatile. It emits a malformed tool-call tag on Groq -
  // `<function=searchSyllabus{...}` with no closing `>` after the name - which
  // Groq rejects with `tool_use_failed`. Measured 4 failures in 5 attempts, so
  // grounding is effectively dead on that model. gpt-oss-120b uses structured
  // tool calling and failed none. Its free-tier rate limit is the tighter
  // constraint; openai/gpt-oss-20b is the fallback if 429s become a problem.
  model: 'groq/openai/gpt-oss-120b',
  tools: syllabusQueryTool ? { searchSyllabus: syllabusQueryTool } : {},
  // Deliberately off, despite naming threads being exactly what we want.
  //
  // Mastra only generates a title when the thread has none:
  //   if (shouldGenerate && !thread.title)
  // POST /api/threads has to persist a thread before the first message exists,
  // and a thread row with no title shows as a blank row in the sidebar, so it
  // gets the "New chat" placeholder. That placeholder is truthy, so this branch
  // never ran and every thread kept the placeholder forever.
  //
  // Titles are now derived from the student's first question on the client
  // (see src/lib/thread-title.ts). That is instant rather than arriving a
  // second later, costs no extra model call, and cannot be lost to a 429 -
  // which matters on a free tier we already hit limits on.
  memory: new Memory({ options: { generateTitle: false } }),
  /*
   * The backstop for Groq's 8000 tokens-per-minute free tier.
   *
   * Trimming retrieval bounds one tool result, but nothing bounds a thread that
   * simply gets long: memory replays previous turns, and the agent loop makes a
   * second call carrying the tool result on top of all of them. Once the total
   * crosses the allowance Groq rejects the request with a 413 - not a 429, so
   * no retry helps and the conversation is dead until the thread is abandoned.
   *
   * TokenLimiterProcessor runs on the initial input and on every subsequent
   * step, dropping the oldest messages first and always keeping the system
   * prompt. `contiguous` keeps an unbroken suffix of the conversation rather
   * than the largest set of messages that happens to fit - a history with holes
   * in it reads as the assistant losing the plot mid-thread.
   */
  inputProcessors: [
    new TokenLimiterProcessor({
      limit: MAX_INPUT_TOKENS,
      trimMode: 'contiguous',
    }),
  ],
})
