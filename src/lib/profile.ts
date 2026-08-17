import { createClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'

export type StudentProfile = {
  userId: string
  displayName: string | null
  syllabusCodes: string[]
  qualification: string | null
}

/**
 * Loads the signed-in student's profile.
 *
 * Read through the Supabase client with the user's JWT, so RLS is what scopes
 * the row - not a WHERE clause we could forget to write.
 */
export async function getProfile(user: User): Promise<StudentProfile> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('student_profiles')
    .select('user_id, display_name, syllabus_codes, qualification')
    .eq('user_id', user.id)
    .maybeSingle()

  return {
    userId: user.id,
    displayName: data?.display_name ?? null,
    syllabusCodes: data?.syllabus_codes ?? [],
    qualification: data?.qualification ?? null,
  }
}

/**
 * Builds the metadata filter applied to every syllabus retrieval.
 *
 * Returns null when the student has no syllabuses selected - an unfiltered
 * search is correct then, because restricting to an empty set would silently
 * return nothing and look like an empty knowledge base.
 */
export function retrievalFilterFor(
  profile: StudentProfile
): Record<string, unknown> | null {
  if (profile.syllabusCodes.length === 0) return null
  return { syllabusCode: { $in: profile.syllabusCodes } }
}
