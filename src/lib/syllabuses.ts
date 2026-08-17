import type { Qualification } from '@/mastra/rag/config'

/**
 * Selectable Cambridge syllabuses.
 *
 * Codes are the real Cambridge International subject codes - they double as the
 * retrieval filter value, so they must match the `syllabusCode` in ingested
 * content exactly.
 */
export type SyllabusOption = {
  code: string
  subject: string
  qualification: Qualification
}

export const SYLLABUSES: SyllabusOption[] = [
  // IGCSE
  { code: '0620', subject: 'Chemistry', qualification: 'IGCSE' },
  { code: '0625', subject: 'Physics', qualification: 'IGCSE' },
  { code: '0610', subject: 'Biology', qualification: 'IGCSE' },
  { code: '0580', subject: 'Mathematics', qualification: 'IGCSE' },
  { code: '0606', subject: 'Additional Mathematics', qualification: 'IGCSE' },
  { code: '0500', subject: 'English First Language', qualification: 'IGCSE' },
  { code: '0470', subject: 'History', qualification: 'IGCSE' },
  { code: '0450', subject: 'Business Studies', qualification: 'IGCSE' },
  { code: '0455', subject: 'Economics', qualification: 'IGCSE' },
  { code: '0478', subject: 'Computer Science', qualification: 'IGCSE' },

  // AS & A Level
  { code: '9701', subject: 'Chemistry', qualification: 'A Level' },
  { code: '9702', subject: 'Physics', qualification: 'A Level' },
  { code: '9700', subject: 'Biology', qualification: 'A Level' },
  { code: '9709', subject: 'Mathematics', qualification: 'A Level' },
  { code: '9231', subject: 'Further Mathematics', qualification: 'A Level' },
  { code: '9618', subject: 'Computer Science', qualification: 'A Level' },
  { code: '9708', subject: 'Economics', qualification: 'A Level' },
  { code: '9609', subject: 'Business', qualification: 'A Level' },
]

export function groupedSyllabuses() {
  const groups = new Map<Qualification, SyllabusOption[]>()
  for (const option of SYLLABUSES) {
    const list = groups.get(option.qualification) ?? []
    list.push(option)
    groups.set(option.qualification, list)
  }
  return [...groups.entries()]
}
