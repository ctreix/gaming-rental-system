// White-box unit tests - Feature F4 (Konfirmasi reservasi & riwayat)
// Units: POST /api/reservations (lines 31-90) and GET /api/reservations/mine (lines 10-23)
//
// Test doubles:
//   Stub  : requireUser, tx.reservationLock.findFirst, tx.unit.findUnique, prisma.reservation.findMany
//   Mock  : tx.reservation.create and tx.reservationLock.delete (exact arguments / "never called")
//   Fake  : $transaction (runs the callback with a fake tx) and fake timers (lock expiry checks)
//   Spy   : console.error (unexpected-error test)
//   (serializeUnit is pure, so the real one is used in GET /mine - no double needed there)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  transaction: vi.fn(),
  txLockFind: vi.fn(),
  txLockDelete: vi.fn(),
  txUnitFind: vi.fn(),
  txResCreate: vi.fn(),
  resFindMany: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ requireUser: mocks.requireUser }))
vi.mock('@/lib/db', () => ({
  prisma: { $transaction: mocks.transaction, reservation: { findMany: mocks.resFindMany } },
}))

import { POST } from '@/app/api/reservations/route'
import { GET as mine } from '@/app/api/reservations/mine/route'

const NOW = new Date('2026-11-26T03:00:00.000Z')
const post = (body: unknown) =>
  new Request('http://localhost/api/reservations', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })

describe('POST /api/reservations (F4)', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>
  const lock = (overrides: Record<string, unknown> = {}) => ({
    id: 'lock-1',
    unit_id: 'unit-1',
    expires_at: new Date(NOW.getTime() + 10 * 60 * 1000),
    start_time: new Date('2026-12-01T03:00:00.000Z'), // 10:00 WIB
    end_time: new Date('2026-12-01T06:00:00.000Z'), // 13:00 WIB (3 hours)
    ...overrides,
  })

  beforeEach(() => {
    vi.resetAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.requireUser.mockResolvedValue({ user: { id: 'me' }, response: null })
    mocks.transaction.mockImplementation((cb: (tx: unknown) => unknown) =>
      cb({
        reservationLock: { findFirst: mocks.txLockFind, delete: mocks.txLockDelete },
        unit: { findUnique: mocks.txUnitFind },
        reservation: { create: mocks.txResCreate },
      })
    )
    mocks.txLockFind.mockResolvedValue(lock())
    mocks.txUnitFind.mockResolvedValue({ id: 'unit-1', hourly_rate: 15000 })
    mocks.txResCreate.mockImplementation(async ({ data }: any) => ({ id: 'res-1', ...data }))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('TC-F4-01: returns the guard response (401) when not logged in', async () => {
    // Arrange
    mocks.requireUser.mockResolvedValue({
      user: null,
      response: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }),
    })
    // Act
    const res = await POST(post({ session_id: 's' }))
    // Assert
    expect(res.status).toBe(401)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it.each([['not JSON', '{broken'], ['missing session_id', {}], ['empty session_id', { session_id: '' }]])(
    'TC-F4-02: returns 400 for an invalid body (%s)',
    async (_l, body) => {
      // Arrange / Act
      const res = await POST(post(body))
      // Assert
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: 'Invalid input' })
      expect(mocks.transaction).not.toHaveBeenCalled()
    }
  )

  it('TC-F4-03: returns 409 when the caller has no such lock', async () => {
    // Arrange
    mocks.txLockFind.mockResolvedValue(null)
    // Act
    const res = await POST(post({ session_id: 'missing' }))
    // Assert
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'Booking session is missing or expired' })
    expect(mocks.txResCreate).not.toHaveBeenCalled()
  })

  it.each([
    ['already expired', new Date(NOW.getTime() - 1000)],
    ['expiring exactly now', new Date(NOW.getTime())],
  ])('TC-F4-04: returns 409 when the lock is %s', async (_l, expires_at) => {
    // Arrange
    mocks.txLockFind.mockResolvedValue(lock({ expires_at }))
    // Act
    const res = await POST(post({ session_id: 's' }))
    // Assert
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'Booking session is missing or expired' })
    expect(mocks.txResCreate).not.toHaveBeenCalled()
  })

  it('TC-F4-05: returns 404 when the unit of the lock no longer exists', async () => {
    // Arrange
    mocks.txUnitFind.mockResolvedValue(null)
    // Act
    const res = await POST(post({ session_id: 's' }))
    // Assert
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Unit not found' })
  })

  it('TC-F4-06: creates a PENDING reservation priced on the server and consumes the lock', async () => {
    // Arrange: client tries to inject its own price/status - they must be ignored
    const body = { session_id: 's', total_amount: 1, status: 'CONFIRMED', hourly_rate: 1 }
    // Act
    const res = await POST(post(body))
    // Assert
    expect(res.status).toBe(200)
    expect(mocks.txLockFind).toHaveBeenCalledWith({ where: { session_id: 's', user_id: 'me' } })
    expect(mocks.txResCreate).toHaveBeenCalledWith({
      data: {
        user_id: 'me',
        unit_id: 'unit-1',
        status: 'PENDING',
        payment_status: 'PENDING',
        start_time: new Date('2026-12-01T03:00:00.000Z'),
        end_time: new Date('2026-12-01T06:00:00.000Z'),
        hourly_rate: 15000,
        total_hours: 3,
        total_amount: 45000,
      },
    })
    expect(mocks.txLockDelete).toHaveBeenCalledWith({ where: { id: 'lock-1' } })
    expect((await res.json()).reservation.total_amount).toBe(45000)
  })

  it('TC-F4-07: returns 500 and logs when something unexpected fails', async () => {
    // Arrange
    mocks.txResCreate.mockRejectedValue(new Error('disk full'))
    // Act
    const res = await POST(post({ session_id: 's' }))
    // Assert
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Booking failed to save' })
    expect(errorSpy).toHaveBeenCalledTimes(1)
    expect(mocks.txLockDelete).not.toHaveBeenCalled()
  })
})

describe('GET /api/reservations/mine (F4)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.requireUser.mockResolvedValue({ user: { id: 'me' }, response: null })
  })

  it('TC-F4-08: returns the guard response (401) when not logged in', async () => {
    // Arrange
    mocks.requireUser.mockResolvedValue({
      user: null,
      response: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }),
    })
    // Act
    const res = await mine()
    // Assert
    expect(res.status).toBe(401)
    expect(mocks.resFindMany).not.toHaveBeenCalled()
  })

  it('TC-F4-09: returns only the caller\'s reservations, newest first, with parsed unit specs', async () => {
    // Arrange
    mocks.resFindMany.mockResolvedValue([
      { id: 'r2', status: 'PENDING', unit: { id: 'u1', specifications: '{"gpu":"4070"}' } },
      { id: 'r1', status: 'CANCELLED', unit: { id: 'u2', specifications: 'not json' } },
    ])
    // Act
    const res = await mine()
    // Assert
    expect(mocks.resFindMany).toHaveBeenCalledWith({
      where: { user_id: 'me' },
      include: { unit: true },
      orderBy: { created_at: 'desc' },
    })
    const json = await res.json()
    expect(json.map((r: any) => r.id)).toEqual(['r2', 'r1'])
    expect(json[0].unit.specifications).toEqual({ gpu: '4070' })
    expect(json[1].unit.specifications).toEqual({}) // malformed JSON falls back to {}
  })

  it('TC-F4-10: returns an empty list when the user has no reservations', async () => {
    // Arrange
    mocks.resFindMany.mockResolvedValue([])
    // Act
    const res = await mine()
    // Assert
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })
})
