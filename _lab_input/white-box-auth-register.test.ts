// White-box unit tests - Feature A1 (Register)
// Unit: POST /api/auth/register  (app/api/auth/register/route.ts, lines 11-57)
//
// Test doubles:
//   Stub  : prisma.user.findUnique, signSession, hashPassword (canned return values)
//   Mock  : prisma.user.create and setSessionCookie (we verify how they were called)
//   Spy   : vi.spyOn(registerSchema, 'safeParse') - one test overrides it to force
//           the defensive `?? 'Invalid input'` branch
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  create: vi.fn(),
  hashPassword: vi.fn(),
  signSession: vi.fn(),
  setSessionCookie: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: { user: { findUnique: mocks.findUnique, create: mocks.create } },
}))
vi.mock('@/lib/auth', () => ({
  hashPassword: mocks.hashPassword,
  signSession: mocks.signSession,
  setSessionCookie: mocks.setSessionCookie,
}))

import { POST } from '@/app/api/auth/register/route'
import { registerSchema } from '@/lib/validation'

const post = (body: unknown) =>
  new Request('http://localhost/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })

const validBody = {
  full_name: 'Budi Santoso',
  email: 'budi@example.com',
  phone_number: '081234567890',
  password: 'Passw0rdOK',
}

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetAllMocks()
    mocks.findUnique.mockResolvedValue(null) // Stub: email not taken
    mocks.hashPassword.mockResolvedValue('hashed-pw') // Stub
    mocks.signSession.mockResolvedValue('jwt-token') // Stub
    mocks.create.mockImplementation(async ({ data }: any) => ({
      id: 'user-1',
      full_name: data.full_name,
      phone_number: data.phone_number,
      role: data.role,
    }))
  })

  it('TC-A1-01: returns 400 with the zod message when the password is too short', async () => {
    // Arrange
    const request = post({ ...validBody, password: 'abc1' })
    // Act
    const res = await POST(request)
    // Assert
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Password must be at least 8 characters' })
    expect(mocks.findUnique).not.toHaveBeenCalled()
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('TC-A1-02: returns 400 when the body is not valid JSON', async () => {
    // Arrange
    const request = post('{broken')
    // Act
    const res = await POST(request)
    // Assert
    expect(res.status).toBe(400)
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('TC-A1-03: falls back to "Invalid input" when the schema reports no issue message', async () => {
    // Arrange (Spy/Stub: force a failed parse with an empty issue list)
    vi.spyOn(registerSchema, 'safeParse').mockReturnValueOnce({
      success: false,
      error: { issues: [] },
    } as any)
    const request = post(validBody)
    // Act
    const res = await POST(request)
    // Assert
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Invalid input' })
  })

  it('TC-A1-04: returns 409 when the email is already registered', async () => {
    // Arrange
    mocks.findUnique.mockResolvedValue({ id: 'existing' })
    const request = post(validBody)
    // Act
    const res = await POST(request)
    // Assert
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'An account with this email already exists' })
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.setSessionCookie).not.toHaveBeenCalled()
  })

  it('TC-A1-05: registers a user, hashes the password and sets the session cookie', async () => {
    // Arrange
    const request = post(validBody)
    // Act
    const res = await POST(request)
    // Assert
    expect(res.status).toBe(200)
    expect(mocks.hashPassword).toHaveBeenCalledWith('Passw0rdOK')
    expect(mocks.create).toHaveBeenCalledTimes(1)
    const arg = mocks.create.mock.calls[0][0]
    expect(arg.data).toEqual({
      email: 'budi@example.com',
      password_hash: 'hashed-pw',
      full_name: 'Budi Santoso',
      phone_number: '081234567890',
      role: 'CUSTOMER',
    })
    expect(mocks.signSession).toHaveBeenCalledWith({
      sub: 'user-1',
      email: 'budi@example.com',
      role: 'CUSTOMER',
    })
    expect(mocks.setSessionCookie).toHaveBeenCalledWith('jwt-token')
    const json = await res.json()
    expect(json.user).toEqual({
      id: 'user-1',
      email: 'budi@example.com',
      full_name: 'Budi Santoso',
      phone_number: '081234567890',
      role: 'CUSTOMER',
    })
    expect(JSON.stringify(json)).not.toContain('hashed-pw')
  })

  it('TC-A1-06: stores phone_number as null when it is omitted', async () => {
    // Arrange
    const { phone_number: _omit, ...withoutPhone } = validBody
    const request = post(withoutPhone)
    // Act
    const res = await POST(request)
    // Assert
    expect(res.status).toBe(200)
    expect(mocks.create.mock.calls[0][0].data.phone_number).toBeNull()
    expect((await res.json()).user.phone_number).toBeNull()
  })

  it('TC-A1-07: ignores a client-supplied role (always CUSTOMER)', async () => {
    // Arrange
    const request = post({ ...validBody, role: 'ADMIN' })
    // Act
    const res = await POST(request)
    // Assert
    expect(res.status).toBe(200)
    expect(mocks.create.mock.calls[0][0].data.role).toBe('CUSTOMER')
  })
})
