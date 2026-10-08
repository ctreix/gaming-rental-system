import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { signSession, setSessionCookie, verifyPassword } from '@/lib/auth'
import { loginSchema } from '@/lib/validation'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }
  const { email, password } = parsed.data

  const row = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      full_name: true,
      phone_number: true,
      role: true,
      password_hash: true,
    },
  })

  // Unknown email and wrong password are deliberately indistinguishable.
  if (!row || !(await verifyPassword(password, row.password_hash))) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  const token = await signSession({
    sub: row.id,
    email: row.email,
    role: row.role,
  })
  setSessionCookie(token)

  const { password_hash: _password_hash, ...user } = row
  return NextResponse.json({ user })
}
