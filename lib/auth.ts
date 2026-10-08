import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { SignJWT, jwtVerify } from 'jose'
import { hash, compare } from 'bcryptjs'
import { prisma } from '@/lib/db'

export const SESSION_COOKIE = 'session'

export interface SessionPayload {
  sub: string
  email: string
  role: string
}

// Canonical user shape returned to clients (GET /api/auth/me).
export interface AuthUser {
  id: string
  email: string
  full_name: string | null
  phone_number: string | null
  role: string
}

const AUTH_USER_SELECT = {
  id: true,
  email: true,
  full_name: true,
  phone_number: true,
  role: true,
} as const

function getSecret(): Uint8Array {
  return new TextEncoder().encode(process.env.AUTH_SECRET)
}

// ---------------------------------------------------------------------------
// Session tokens (HS256 JWT stored in an httpOnly `session` cookie)
// ---------------------------------------------------------------------------

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ email: payload.email, role: payload.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret())
}

// Verifies signature + expiry only; the role is NOT trusted from here for
// authorization decisions - use getCurrentUser()/requireAdmin() instead.
export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ['HS256'],
    })
    if (typeof payload.sub !== 'string') return null
    return {
      sub: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : '',
      role: typeof payload.role === 'string' ? payload.role : 'CUSTOMER',
    }
  } catch {
    return null
  }
}

// Reads the session cookie, verifies the JWT, then loads the user from the
// database. Returns null when the cookie is missing, the token is invalid, or
// the account no longer exists.
export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = cookies().get(SESSION_COOKIE)?.value
  if (!token) return null
  const session = await verifySession(token)
  if (!session) return null
  return prisma.user.findUnique({
    where: { id: session.sub },
    select: AUTH_USER_SELECT,
  })
}

// ---------------------------------------------------------------------------
// Route guards
// ---------------------------------------------------------------------------

export type RequireResult =
  | { user: AuthUser; response: null }
  | { user: null; response: NextResponse }

// 401 when there is no valid session.
export async function requireUser(): Promise<RequireResult> {
  const user = await getCurrentUser()
  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }),
    }
  }
  return { user, response: null }
}

// 401 when not logged in, 403 when logged in without the ADMIN role.
// The role is read from the database, not from the JWT.
export async function requireAdmin(): Promise<RequireResult> {
  const result = await requireUser()
  if (result.response) return result
  if (result.user.role !== 'ADMIN') {
    return {
      user: null,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// Cookie helpers
// ---------------------------------------------------------------------------

export function setSessionCookie(token: string): void {
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  })
}

export function clearSessionCookie(): void {
  cookies().set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })
}

// ---------------------------------------------------------------------------
// Passwords
// ---------------------------------------------------------------------------

export function hashPassword(password: string): Promise<string> {
  return hash(password, 10)
}

export function verifyPassword(
  password: string,
  passwordHash: string
): Promise<boolean> {
  return compare(password, passwordHash)
}

// Password reset tokens are NOT handled here: they are random 32-byte
// tokens stored as sha256 hashes (see PasswordResetToken in the schema and
// the forgot-password / reset-password route handlers).
