import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { signSession, setSessionCookie, hashPassword } from '@/lib/auth'
import { profileSelect } from '@/lib/serialize'
// Shared with the register page. `role` is intentionally absent - zod strips
// unknown keys and the row below is always created as CUSTOMER.
import { registerSchema } from '@/lib/validation'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = registerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    )
  }
  const { full_name, email, phone_number, password } = parsed.data

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json(
      { error: 'An account with this email already exists' },
      { status: 409 }
    )
  }

  const profile = await prisma.user.create({
    data: {
      email,
      password_hash: await hashPassword(password),
      full_name,
      phone_number: phone_number || null,
      role: 'CUSTOMER',
    },
    select: profileSelect,
  })

  const token = await signSession({
    sub: profile.id,
    email,
    role: profile.role,
  })
  setSessionCookie(token)

  return NextResponse.json({
    user: {
      id: profile.id,
      email,
      full_name: profile.full_name,
      phone_number: profile.phone_number,
      role: profile.role,
    },
  })
}
