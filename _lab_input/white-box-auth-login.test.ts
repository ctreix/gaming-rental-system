// White-box unit tests - Feature A2 (Login, Logout, Me)
// Units: POST /api/auth/login (lines 8-42), POST /api/auth/logout (6-9), GET /api/auth/me (8-18)
//
// Test doubles:
//   Stub  : prisma.user.findUnique, verifyPassword, signSession, getCurrentUser, cookies().has
//   Mock  : setSessionCookie / clearSessionCookie (call verification, including "never called")
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  verifyPassword: vi.fn(),
  signSession: vi.fn(),
  setSessionCookie: vi.fn(),
  clearSessionCookie: vi.fn(),
  getCurrentUser: vi.fn(),
  cookieHas: vi.fn(),
}))

vi.mock('@/lib/db', () => ({ prisma: { user: { findUnique: mocks.findUnique } } }))
vi.mock('@/lib/auth', () => ({
  SESSION_COOKIE: 'session',
  verifyPassword: mocks.verifyPassword,
  signSession: mocks.signSession,
  setSessionCookie: mocks.setSessionCookie,
  clearSessionCookie: mocks.clearSessionCookie,
  getCurrentUser: mocks.getCurrentUser,
}))
vi.mock('next/headers', () => ({ cookies: () => ({ has: mocks.cookieHas }) }))

import { POST as login } from '@/app/api/auth/login/route'
import { POST as logout } from '@/app/api/auth/logout/route'
import { GET as me } from '@/app/api/auth/me/route'

const post = (body: unknown) =>
  new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })

const row = {
  id: 'u1',
  email: 'budi@example.com',
  full_name: 'Budi',
  phone_number: null,
  role: 'CUSTOMER',
  password_hash: 'stored-hash',
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.signSession.mockResolvedValue('jwt-token')
})

describe('POST /api/auth/login', () => {
  it('TC-A2-01: returns 401 (not 400) for a malformed email', async () => {
    // Arrange
    const request = post({ email: 'not-an-email', password: 'x' })
    // Act
    const res = await login(request)
    // Assert
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Invalid email or password' })
    expect(mocks.findUnique).not.toHaveBeenCalled()
  })

  it('TC-A2-02: returns 401 for an unknown email without checking any password', async () => {
    // Arrange
    mocks.findUnique.mockResolvedValue(null)
    const request = post({ email: 'ghost@example.com', password: 'whatever1' })
    // Act
    const res = await login(request)
    // Assert
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Invalid email or password' })
    expect(mocks.verifyPassword).not.toHaveBeenCalled()
  })

  it('TC-A2-03: returns the same 401 for a wrong password', async () => {
    // Arrange
    mocks.findUnique.mockResolvedValue(row)
    mocks.verifyPassword.mockResolvedValue(false)
    const request = post({ email: row.email, password: 'wrongpass1' })
    // Act
    const res = await login(request)
    // Assert
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Invalid email or password' })
    expect(mocks.verifyPassword).toHaveBeenCalledWith('wrongpass1', 'stored-hash')
    expect(mocks.setSessionCookie).not.toHaveBeenCalled()
  })

  it('TC-A2-04: logs in, sets the cookie and never returns password_hash', async () => {
    // Arrange
    mocks.findUnique.mockResolvedValue(row)
    mocks.verifyPassword.mockResolvedValue(true)
    const request = post({ email: row.email, password: 'Passw0rdOK' })
    // Act
    const res = await login(request)
    // Assert
    expect(res.status).toBe(200)
    expect(mocks.signSession).toHaveBeenCalledWith({ sub: 'u1', email: row.email, role: 'CUSTOMER' })
    expect(mocks.setSessionCookie).toHaveBeenCalledWith('jwt-token')
    const json = await res.json()
    expect(json.user).toEqual({
      id: 'u1',
      email: row.email,
      full_name: 'Budi',
      phone_number: null,
      role: 'CUSTOMER',
    })
    expect(json.user).not.toHaveProperty('password_hash')
  })

  it('TC-A2-05: returns 401 when the body is not valid JSON', async () => {
    // Arrange
    const request = post('{broken')
    // Act
    const res = await login(request)
    // Assert
    expect(res.status).toBe(401)
  })
})

describe('POST /api/auth/logout', () => {
  it('TC-A2-06: clears the session cookie and reports success', async () => {
    // Arrange (nothing to prepare: the handler takes no input)
    // Act
    const res = await logout()
    // Assert
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })
    expect(mocks.clearSessionCookie).toHaveBeenCalledTimes(1)
  })
})

describe('GET /api/auth/me', () => {
  it('TC-A2-07: returns the current user when a valid session exists', async () => {
    // Arrange
    const user = { id: 'u1', email: row.email, full_name: 'Budi', phone_number: null, role: 'CUSTOMER' }
    mocks.getCurrentUser.mockResolvedValue(user)
    // Act
    const res = await me()
    // Assert
    expect(await res.json()).toEqual({ user })
    expect(mocks.clearSessionCookie).not.toHaveBeenCalled()
  })

  it('TC-A2-08: clears a stale cookie and returns user: null', async () => {
    // Arrange
    mocks.getCurrentUser.mockResolvedValue(null)
    mocks.cookieHas.mockReturnValue(true)
    // Act
    const res = await me()
    // Assert
    expect(await res.json()).toEqual({ user: null })
    expect(mocks.clearSessionCookie).toHaveBeenCalledTimes(1)
  })

  it('TC-A2-09: returns user: null without touching cookies when there is no cookie', async () => {
    // Arrange
    mocks.getCurrentUser.mockResolvedValue(null)
    mocks.cookieHas.mockReturnValue(false)
    // Act
    const res = await me()
    // Assert
    expect(await res.json()).toEqual({ user: null })
    expect(mocks.clearSessionCookie).not.toHaveBeenCalled()
  })
})
