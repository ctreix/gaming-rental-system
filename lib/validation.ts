import { z, type ZodError } from 'zod'

// Map a ZodError to one message per top-level field, for inline display.
export function fieldErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? '')
    if (key && !out[key]) out[key] = issue.message
  }
  return out
}

// ---------------------------------------------------------------------------
// Shared input validation, imported by BOTH the API route handlers and the
// client pages so the rules cannot drift apart.
//
// Limit constants are exported so the pages can set matching maxLength/min
// attributes. Comments above each schema give the EP/BVA partitions.
// ---------------------------------------------------------------------------

export const NAME_MIN = 2
export const NAME_MAX = 100
export const EMAIL_MAX = 254
export const PHONE_MAX = 20
export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 72

// Full name.
// EP:     valid = 2-100 chars; invalid = empty/1 char, > 100 chars.
// BVA:    1 (reject), 2 (accept), 100 (accept), 101 (reject).
export const fullNameSchema = z
  .string()
  .trim()
  .min(NAME_MIN, `Full name must be at least ${NAME_MIN} characters`)
  .max(NAME_MAX, `Full name must be at most ${NAME_MAX} characters`)

// Email.
// EP:     valid = single @ with domain; invalid = missing @, empty, > 254.
// BVA:    254 (accept), 255 (reject).
export const emailSchema = z
  .string()
  .trim()
  .email('Invalid email address')
  .max(EMAIL_MAX, `Email must be at most ${EMAIL_MAX} characters`)

// Phone number (optional).
// EP:     valid = empty or <= 20 chars; invalid = > 20 chars.
// BVA:    20 (accept), 21 (reject).
export const phoneSchema = z
  .string()
  .trim()
  .max(PHONE_MAX, `Phone number must be at most ${PHONE_MAX} characters`)
  .optional()
  .default('')

// Password.
// EP:     valid = 8-72 chars with >=1 letter AND >=1 digit;
//         invalid = too short, too long, no letter, no digit.
// BVA:    7 (reject), 8 (accept), 9 (accept), 71 (accept), 72 (accept),
//         73 (reject).
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `Password must be at least ${PASSWORD_MIN} characters`)
  .max(PASSWORD_MAX, `Password must be at most ${PASSWORD_MAX} characters`)
  .regex(/[A-Za-z]/, 'Password must contain at least one letter')
  .regex(/[0-9]/, 'Password must contain at least one digit')

// Register. NOTE: `role` is intentionally absent - zod strips unknown keys and
// the route always creates the row as CUSTOMER, so the client cannot set it.
export const registerSchema = z.object({
  full_name: fullNameSchema,
  email: emailSchema,
  phone_number: phoneSchema,
  password: passwordSchema,
})
export type RegisterInput = z.infer<typeof registerSchema>

// Login. Password keeps min length 1 so login never leaks the password rules.
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(PASSWORD_MAX),
})
export type LoginInput = z.infer<typeof loginSchema>

// Forgot password.
export const forgotSchema = z.object({
  email: emailSchema,
})
export type ForgotInput = z.infer<typeof forgotSchema>

// Reset password (server payload). Same password rules as registration.
export const resetSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
})
export type ResetInput = z.infer<typeof resetSchema>

// Reset password form (client only): adds confirm-password equality.
// EP: valid = password === confirm; invalid = mismatch.
export const resetFormSchema = z
  .object({
    token: z.string().min(1),
    password: passwordSchema,
    confirm_password: z.string(),
  })
  .refine((data) => data.password === data.confirm_password, {
    path: ['confirm_password'],
    message: 'Passwords do not match',
  })
export type ResetFormInput = z.infer<typeof resetFormSchema>
