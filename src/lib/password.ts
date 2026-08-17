/**
 * The minimum a password has to be for this app.
 *
 * Supabase enforces its own project-level minimum server-side; this is the
 * number the forms check against so the student is told before submitting
 * rather than after. Keep it at or above whatever the project is configured
 * with, or the client will wave through a password the server then rejects.
 */
export const MIN_PASSWORD_LENGTH = 8
