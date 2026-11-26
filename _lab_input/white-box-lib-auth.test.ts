// White-box unit tests - shared auth helpers used by every feature (A1-A3, F2-F5)
// Unit: lib/auth.ts (signSession, verifySession, getCurrentUser, requireUser, requireAdmin,
//       setSessionCookie, clearSessionCookie, hashPassword, verifyPassword)
//
// Test doubles:
//   Stub : cookies().get (returns a canned cookie), prisma.user.findUnique
//   Mock : cookies().set (arguments verified)
//   Real : jose and bcryptjs are NOT replaced - they are deterministic enough to exercise for real
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SignJWT } from 'jose'

const mocks = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  cookieSet: vi.fn(),
  findUnique: vi.fn(),
}))
vi.mock('next/headers', () => ({
  cookies: () => ({ get: mocks.cookieGet, set: mocks.cookieSet }),
}))
vi.mock('@/lib/db', () => ({ prisma: { user: { findUnique: mocks.findUnique } } }))

import {
  signSession,
  verifySession,
  getCurrentUser,
  requireUser,
  requireAdmin,
  setSessionCookie,
  clearSessionCookie,
  hashPassword,
  verifyPassword,
  SESSION_COOKIE,
} from '@/lib/auth'

const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET)
const dbUser = (role = 'CUSTOMER') => ({
  id: 'u1', email: 'a@b.co', full_name: 'A', phone_number: null, role,
})

beforeEach(() => {
  vi.resetAllMocks()
  process.env.AUTH_SECRET = 'unit-test-secret-unit-test-secret'
})
afterEach(() => {
  vi.unstubAllEnvs()
})

describe('session tokens', () => {
  it('TC-LIB-01: a signed session verifies back to the same payload', async () => {
    // Arrange
    const token = await signSession({ sub: 'u1', email: 'a@b.co', role: 'CUSTOMER' })
    // Act
    const session = await verifySession(token)
    // Assert
    expect(session).toEqual({ sub: 'u1', email: 'a@b.co', role: 'CUSTOMER' })
  })

  it('TC-LIB-02: a malformed token yields null', async () => {
    // Arrange / Act / Assert
    expect(await verifySession('not.a.jwt')).toBeNull()
  })

  it('TC-LIB-03: a token signed with a different secret yields null', async () => {
    // Arrange
    const forged = await new SignJWT({ email: 'x', role: 'ADMIN' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('u1')
      .sign(new TextEncoder().encode('another-secret-another-secret-123'))
    // Act / Assert
    expect(await verifySession(forged)).toBeNull()
  })

  it('TC-LIB-04: an expired token yields null', async () => {
    // Arrange
    const expired = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('u1')
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(secret())
    // Act / Assert
    expect(await verifySession(expired)).toBeNull()
  })

  it('TC-LIB-05: a token without a string subject yields null', async () => {
    // Arrange
    const noSub = await new SignJWT({ email: 'a@b.co', role: 'CUSTOMER' })
      .setProtectedHeader({ alg: 'HS256' })
      .sign(secret())
    // Act / Assert
    expect(await verifySession(noSub)).toBeNull()
  })

  it('TC-LIB-06: non-string email/role claims fall back to "" and CUSTOMER', async () => {
    // Arrange
    const odd = await new SignJWT({ email: 123, role: 7 })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('u1')
      .sign(secret())
    // Act
    const session = await verifySession(odd)
    // Assert
    expect(session).toEqual({ sub: 'u1', email: '', role: 'CUSTOMER' })
  })
})

describe('getCurrentUser / requireUser / requireAdmin', () => {
  const withCookie = async () => {
    const token = await signSession({ sub: 'u1', email: 'a@b.co', role: 'ADMIN' })
    mocks.cookieGet.mockReturnValue({ value: token })
  }

  it('TC-LIB-07: getCurrentUser returns null without a cookie', async () => {
    // Arrange
    mocks.cookieGet.mockReturnValue(undefined)
    // Act / Assert
    expect(await getCurrentUser()).toBeNull()
    expect(mocks.findUnique).not.toHaveBeenCalled()
  })

  it('TC-LIB-08: getCurrentUser returns null for an invalid token', async () => {
    // Arrange
    mocks.cookieGet.mockReturnValue({ value: 'garbage' })
    // Act / Assert
    expect(await getCurrentUser()).toBeNull()
    expect(mocks.findUnique).not.toHaveBeenCalled()
  })

  it('TC-LIB-09: getCurrentUser loads the user from the database for a valid token', async () => {
    // Arrange
    await withCookie()
    mocks.findUnique.mockResolvedValue(dbUser())
    // Act
    const user = await getCurrentUser()
    // Assert
    expect(mocks.cookieGet).toHaveBeenCalledWith(SESSION_COOKIE)
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { id: 'u1' },
      select: { id: true, email: true, full_name: true, phone_number: true, role: true },
    })
    expect(user).toEqual(dbUser())
  })

  it('TC-LIB-10: requireUser answers 401 when there is no valid session', async () => {
    // Arrange
    mocks.cookieGet.mockReturnValue(undefined)
    // Act
    const result = await requireUser()
    // Assert
    expect(result.user).toBeNull()
    expect(result.response?.status).toBe(401)
  })

  it('TC-LIB-11: requireUser returns the user and no response for a valid session', async () => {
    // Arrange
    await withCookie()
    mocks.findUnique.mockResolvedValue(dbUser())
    // Act
    const result = await requireUser()
    // Assert
    expect(result).toEqual({ user: dbUser(), response: null })
  })

  it('TC-LIB-12: requireAdmin passes the 401 through when not logged in', async () => {
    // Arrange
    mocks.cookieGet.mockReturnValue(undefined)
    // Act
    const result = await requireAdmin()
    // Assert
    expect(result.response?.status).toBe(401)
  })

  it('TC-LIB-13: requireAdmin answers 403 for a CUSTOMER (role comes from the DB)', async () => {
    // Arrange: JWT says ADMIN, database says CUSTOMER
    await withCookie()
    mocks.findUnique.mockResolvedValue(dbUser('CUSTOMER'))
    // Act
    const result = await requireAdmin()
    // Assert
    expect(result.user).toBeNull()
    expect(result.response?.status).toBe(403)
  })

  it('TC-LIB-14: requireAdmin lets an ADMIN through', async () => {
    // Arrange
    await withCookie()
    mocks.findUnique.mockResolvedValue(dbUser('ADMIN'))
    // Act
    const result = await requireAdmin()
    // Assert
    expect(result).toEqual({ user: dbUser('ADMIN'), response: null })
  })
})

describe('cookie helpers', () => {
  it.each([
    ['production', true],
    ['development', false],
  ])('TC-LIB-15: setSessionCookie in %s sets secure=%s', (env, secure) => {
    // Arrange
    vi.stubEnv('NODE_ENV', env)
    // Act
    setSessionCookie('tok')
    // Assert
    expect(mocks.cookieSet).toHaveBeenCalledWith(SESSION_COOKIE, 'tok', {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    })
  })

  it.each([
    ['production', true],
    ['development', false],
  ])('TC-LIB-16: clearSessionCookie in %s expires the cookie (secure=%s)', (env, secure) => {
    // Arrange
    vi.stubEnv('NODE_ENV', env)
    // Act
    clearSessionCookie()
    // Assert
    expect(mocks.cookieSet).toHaveBeenCalledWith(SESSION_COOKIE, '', {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: '/',
      maxAge: 0,
    })
  })
})

describe('passwords', () => {
  it('TC-LIB-17: hashPassword never returns the plain text and verifyPassword accepts only the right one', async () => {
    // Arrange
    const hash = await hashPassword('Passw0rdOK')
    // Act / Assert
    expect(hash).not.toBe('Passw0rdOK')
    expect(await verifyPassword('Passw0rdOK', hash)).toBe(true)
    expect(await verifyPassword('Passw0rdNO', hash)).toBe(false)
  })
})
