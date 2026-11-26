// White-box unit tests - Feature A3 (Forgot / Reset password)
// Units: POST /api/auth/forgot-password (lines 49-114, plus rateLimit 26-41 and clientIp 43-47)
//        POST /api/auth/reset-password  (lines 14-67)
//
// Test doubles:
//   Stub  : prisma.user.findUnique, randomBytes (fixed token), hashPassword
//   Mock  : prisma.passwordResetToken.*, prisma.emailOutbox.create, tx.* (call verification)
//   Fake  : $transaction (runs the callback with a fake `tx`) and fake timers (Date.now / new Date)
//   Spy   : console.log (observe the throttle log line without printing it)
// The rate limiter keeps module-level state, so each forgot-password test re-imports a fresh module.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createHash } from 'crypto'

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  tokenUpdateMany: vi.fn(),
  tokenCreate: vi.fn(),
  outboxCreate: vi.fn(),
  txFindFirst: vi.fn(),
  txTokenUpdate: vi.fn(),
  txUserUpdate: vi.fn(),
  transaction: vi.fn(),
  hashPassword: vi.fn(),
  randomBytes: vi.fn(),
}))

vi.mock('crypto', async (orig) => ({
  ...(await orig<typeof import('crypto')>()),
  randomBytes: mocks.randomBytes,
}))
vi.mock('@/lib/auth', () => ({ hashPassword: mocks.hashPassword }))
vi.mock('@/lib/db', () => ({
  prisma: {
    user: { findUnique: mocks.findUnique },
    passwordResetToken: { updateMany: mocks.tokenUpdateMany, create: mocks.tokenCreate },
    emailOutbox: { create: mocks.outboxCreate },
    $transaction: mocks.transaction,
  },
}))

const NOW = new Date('2026-11-26T03:00:00.000Z')
const FIXED_TOKEN_HEX = '01'.repeat(32)
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

const forgotReq = (email: unknown, headers: Record<string, string> = {}) =>
  new Request('http://localhost/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof email === 'string' && email.startsWith('{') ? email : JSON.stringify({ email }),
  })

async function freshForgot() {
  vi.resetModules()
  return (await import('@/app/api/auth/forgot-password/route')).POST
}

let logSpy: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {}) // Spy
  mocks.randomBytes.mockReturnValue(Buffer.alloc(32, 1)) // Stub: deterministic token
  mocks.findUnique.mockResolvedValue(null)
})
afterEach(() => {
  vi.useRealTimers()
  delete process.env.APP_URL
})

describe('POST /api/auth/forgot-password', () => {
  it('TC-A3-01: returns the neutral message and skips the DB for an invalid email', async () => {
    // Arrange
    const POST = await freshForgot()
    // Act
    const res = await POST(forgotReq('not-an-email'))
    // Assert
    expect(res.status).toBe(200)
    expect((await res.json()).success).toBe(true)
    expect(mocks.findUnique).not.toHaveBeenCalled()
  })

  it('TC-A3-01b: returns the neutral message when the body is not valid JSON', async () => {
    // Arrange
    const POST = await freshForgot()
    // Act
    const res = await POST(forgotReq('{broken'))
    // Assert
    expect(res.status).toBe(200)
    expect((await res.json()).success).toBe(true)
    expect(mocks.findUnique).not.toHaveBeenCalled()
  })

  it('TC-A3-02: returns the neutral message and creates nothing for an unknown email', async () => {
    // Arrange
    const POST = await freshForgot()
    // Act
    const res = await POST(forgotReq('ghost@example.com'))
    // Assert
    expect(res.status).toBe(200)
    expect(mocks.findUnique).toHaveBeenCalledWith({ where: { email: 'ghost@example.com' } })
    expect(mocks.tokenCreate).not.toHaveBeenCalled()
    expect(mocks.outboxCreate).not.toHaveBeenCalled()
  })

  it('TC-A3-03: for a known email, invalidates old tokens and stores only the sha256 of the new one', async () => {
    // Arrange
    const POST = await freshForgot()
    mocks.findUnique.mockResolvedValue({ id: 'u1', email: 'budi@example.com' })
    // Act
    const res = await POST(forgotReq('budi@example.com'))
    // Assert
    expect(res.status).toBe(200)
    expect(mocks.tokenUpdateMany).toHaveBeenCalledWith({
      where: { user_id: 'u1', used_at: null },
      data: { used_at: NOW },
    })
    expect(mocks.tokenCreate).toHaveBeenCalledWith({
      data: {
        user_id: 'u1',
        token_hash: sha256(FIXED_TOKEN_HEX),
        expires_at: new Date(NOW.getTime() + 30 * 60 * 1000),
      },
    })
    const outbox = mocks.outboxCreate.mock.calls[0][0].data
    expect(outbox.to).toBe('budi@example.com')
    expect(outbox.body).toContain(
      `http://localhost:3000/auth/reset-password?token=${FIXED_TOKEN_HEX}`
    )
    expect(outbox.body).not.toContain(sha256(FIXED_TOKEN_HEX))
  })

  it('TC-A3-04: uses APP_URL for the link when it is set', async () => {
    // Arrange
    process.env.APP_URL = 'https://rental.example.com'
    const POST = await freshForgot()
    mocks.findUnique.mockResolvedValue({ id: 'u1', email: 'budi@example.com' })
    // Act
    await POST(forgotReq('budi@example.com'))
    // Assert
    expect(mocks.outboxCreate.mock.calls[0][0].data.body).toContain(
      `https://rental.example.com/auth/reset-password?token=${FIXED_TOKEN_HEX}`
    )
  })

  it('TC-A3-05: throttles the 6th request for the same email (neutral 200, no DB lookup)', async () => {
    // Arrange
    const POST = await freshForgot()
    for (let i = 1; i <= 5; i++) {
      await POST(forgotReq('same@example.com', { 'x-forwarded-for': `10.0.0.${i}` }))
    }
    mocks.findUnique.mockClear()
    // Act
    const res = await POST(forgotReq('same@example.com', { 'x-forwarded-for': '10.0.0.99' }))
    // Assert
    expect(res.status).toBe(200)
    expect(mocks.findUnique).not.toHaveBeenCalled()
    expect(logSpy).toHaveBeenCalledWith('[rate-limit] forgot-password throttled (email)')
  })

  it('TC-A3-06: throttles the 21st request from the same IP (checked before the body)', async () => {
    // Arrange
    const POST = await freshForgot()
    for (let i = 1; i <= 20; i++) {
      await POST(forgotReq(`user${i}@example.com`, { 'x-forwarded-for': '9.9.9.9, 1.1.1.1' }))
    }
    mocks.findUnique.mockClear()
    // Act
    const res = await POST(forgotReq('user21@example.com', { 'x-forwarded-for': '9.9.9.9' }))
    // Assert
    expect(res.status).toBe(200)
    expect(mocks.findUnique).not.toHaveBeenCalled()
    expect(logSpy).toHaveBeenCalledWith('[rate-limit] forgot-password throttled (ip)')
  })

  it('TC-A3-07: reads the client IP from x-real-ip, then falls back to "unknown"', async () => {
    // Arrange
    const POST = await freshForgot()
    for (let i = 1; i <= 20; i++) {
      await POST(forgotReq(`a${i}@example.com`, { 'x-real-ip': '7.7.7.7' }))
    }
    // Act: 21st from x-real-ip is throttled, a request with no header uses another bucket
    mocks.findUnique.mockClear()
    await POST(forgotReq('b1@example.com', { 'x-real-ip': '7.7.7.7' }))
    const throttledCalls = mocks.findUnique.mock.calls.length
    await POST(forgotReq('c1@example.com'))
    // Assert
    expect(throttledCalls).toBe(0)
    expect(mocks.findUnique).toHaveBeenCalledTimes(1)
  })

  it('TC-A3-08: purge of expired buckets (map > 1000) keeps unexpired counters intact', async () => {
    // Arrange: 300 requests at t0 -> 600 buckets (ip + email each)
    const POST = await freshForgot()
    for (let i = 0; i < 300; i++) {
      await POST(forgotReq(`old${i}@example.com`, { 'x-forwarded-for': `1.0.${i >> 8}.${i & 255}` }))
    }
    vi.setSystemTime(new Date(NOW.getTime() + 16 * 60 * 1000)) // window (15 min) has passed
    // Act: 300 more requests; the map passes 1000 and the purge keeps the fresh ones
    for (let i = 0; i < 300; i++) {
      await POST(forgotReq(`new${i}@example.com`, { 'x-forwarded-for': `2.0.${i >> 8}.${i & 255}` }))
    }
    mocks.findUnique.mockClear()
    // Assert: a fresh bucket still counts (same email 6 times -> the 6th is throttled)
    for (let i = 0; i < 6; i++) {
      await POST(forgotReq('new1@example.com', { 'x-forwarded-for': `3.0.0.${i}` }))
    }
    expect(mocks.findUnique).toHaveBeenCalledTimes(4) // new1 already used 1 of 5 slots
  })
})

describe('POST /api/auth/reset-password', () => {
  let POST: (r: Request) => Promise<Response>
  const resetReq = (body: unknown) =>
    new Request('http://localhost/api/auth/reset-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    })

  beforeEach(async () => {
    vi.resetModules()
    POST = (await import('@/app/api/auth/reset-password/route')).POST
    mocks.hashPassword.mockResolvedValue('new-hash') // Stub
    // Fake $transaction: run the callback with a fake tx
    mocks.transaction.mockImplementation((cb: (tx: unknown) => unknown) =>
      cb({
        passwordResetToken: { findFirst: mocks.txFindFirst, update: mocks.txTokenUpdate },
        user: { update: mocks.txUserUpdate },
      })
    )
  })

  it('TC-A3-09: returns the password rule message when the new password is invalid', async () => {
    // Arrange
    const request = resetReq({ token: 'tok', password: 'short' })
    // Act
    const res = await POST(request)
    // Assert
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Password must be at least 8 characters' })
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('TC-A3-10: returns the uniform error when the token is missing', async () => {
    // Arrange
    const request = resetReq({ password: 'Passw0rdOK' })
    // Act
    const res = await POST(request)
    // Assert
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'This reset link is invalid or expired' })
  })

  it('TC-A3-11: returns the uniform error when the body is not valid JSON', async () => {
    // Arrange
    const request = resetReq('{broken')
    // Act
    const res = await POST(request)
    // Assert
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'This reset link is invalid or expired' })
  })

  it('TC-A3-12: returns the uniform error when no valid token record is found', async () => {
    // Arrange
    mocks.txFindFirst.mockResolvedValue(null)
    const request = resetReq({ token: 'unknown-token', password: 'Passw0rdOK' })
    // Act
    const res = await POST(request)
    // Assert
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'This reset link is invalid or expired' })
    expect(mocks.txTokenUpdate).not.toHaveBeenCalled()
    expect(mocks.txUserUpdate).not.toHaveBeenCalled()
  })

  it('TC-A3-13: updates the password and marks the token used inside one transaction', async () => {
    // Arrange
    mocks.txFindFirst.mockResolvedValue({ id: 'tok-1', user_id: 'u1' })
    const request = resetReq({ token: 'plain-token', password: 'Passw0rdOK' })
    // Act
    const res = await POST(request)
    // Assert
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })
    expect(mocks.hashPassword).toHaveBeenCalledWith('Passw0rdOK')
    expect(mocks.txFindFirst).toHaveBeenCalledWith({
      where: { token_hash: sha256('plain-token'), used_at: null, expires_at: { gt: NOW } },
    })
    expect(mocks.txTokenUpdate).toHaveBeenCalledWith({
      where: { id: 'tok-1' },
      data: { used_at: NOW },
    })
    expect(mocks.txUserUpdate).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { password_hash: 'new-hash' },
    })
  })

  it('TC-A3-14: hides internal errors behind the uniform message', async () => {
    // Arrange
    mocks.transaction.mockRejectedValue(new Error('db down'))
    const request = resetReq({ token: 'plain-token', password: 'Passw0rdOK' })
    // Act
    const res = await POST(request)
    // Assert
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'This reset link is invalid or expired' })
  })
})
