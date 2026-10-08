import type { Prisma } from '@prisma/client'

// User columns as they existed in the legacy hosted `profiles` table.
// Excludes the local-auth fields (email, password_hash) so JSON responses keep
// the exact shape the UI already consumes.
export const profileSelect = {
  id: true,
  full_name: true,
  phone_number: true,
  role: true,
  created_at: true,
  updated_at: true,
} as const

export type ProfileRow = Prisma.UserGetPayload<{
  select: typeof profileSelect
}>

// `specifications` is stored as TEXT containing JSON; parse it here so the
// client still receives an object.
export function serializeUnit<T extends { specifications: string }>(
  unit: T
): Omit<T, 'specifications'> & { specifications: Record<string, unknown> } {
  let specifications: Record<string, unknown> = {}
  try {
    const parsed = JSON.parse(unit.specifications)
    if (parsed && typeof parsed === 'object') specifications = parsed
  } catch {
    // keep {} for malformed JSON
  }
  return { ...unit, specifications }
}
