import { createHash } from 'crypto'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
// Same password rules as registration (shared schema).
import { resetSchema } from '@/lib/validation'

export const dynamic = 'force-dynamic'

// Uniform error for every token failure: never reveals whether the token
// exists, was already used, or expired.
const ERROR = 'This reset link is invalid or expired'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = resetSchema.safeParse(body)
  if (!parsed.success) {
    // Password problems surface the same messages as registration; any
    // other failure (missing token, malformed body) stays uniform.
    const passwordIssue = parsed.error.issues.find(
      (issue) => issue.path[0] === 'password'
    )
    if (passwordIssue) {
      return NextResponse.json({ error: passwordIssue.message }, { status: 400 })
    }
    return NextResponse.json({ error: ERROR }, { status: 400 })
  }
  const { token, password } = parsed.data

  const tokenHash = createHash('sha256').update(token).digest('hex')

  try {
    const passwordHash = await hashPassword(password)
    const now = new Date()

    // Match by hash, unexpired and unused; update password and mark the
    // token used in one transaction.
    const updated = await prisma.$transaction(async (tx) => {
      const record = await tx.passwordResetToken.findFirst({
        where: {
          token_hash: tokenHash,
          used_at: null,
          expires_at: { gt: now },
        },
      })
      if (!record) return null

      await tx.passwordResetToken.update({
        where: { id: record.id },
        data: { used_at: now },
      })
      await tx.user.update({
        where: { id: record.user_id },
        data: { password_hash: passwordHash },
      })
      return record
    })

    if (!updated) {
      return NextResponse.json({ error: ERROR }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: ERROR }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
