import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getCurrentUser, clearSessionCookie, SESSION_COOKIE } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/auth/me -> { user: { id, email, full_name, phone_number, role } | null }
export async function GET() {
  const user = await getCurrentUser()

  if (!user) {
    // Stale/invalid cookie or deleted account: clear it.
    if (cookies().has(SESSION_COOKIE)) clearSessionCookie()
    return NextResponse.json({ user: null })
  }

  return NextResponse.json({ user })
}
