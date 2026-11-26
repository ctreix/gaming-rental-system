// White-box unit tests - Feature F3 (Pilih slot & kunci unit)
// Units: POST /api/locks (lines 48-164) and DELETE /api/locks/[session_id] (lines 9-39)
//
// Test doubles:
//   Dummy : `dummyRequest` in DELETE tests (the handler never reads it)
//   Stub  : requireUser, tx.unit.findUnique, tx.reservation.count, tx.reservationLock.findFirst
//   Mock  : tx.reservationLock.create / deleteMany (arguments verified; "never called" on rejection)
//   Fake  : $transaction (runs the callback with a fake tx) and fake timers (expires_at = now + 15 min)
//   Spy   : console.error (the unexpected-error test checks it without printing)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  transaction: vi.fn(),
  txDeleteMany: vi.fn(),
  txUnitFind: vi.fn(),
  txResCount: vi.fn(),
  txLockFind: vi.fn(),
  txLockCreate: vi.fn(),
  lockFindFirst: vi.fn(),
  lockDelete: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ requireUser: mocks.requireUser }))
vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: mocks.transaction,
    reservationLock: { findFirst: mocks.lockFindFirst, delete: mocks.lockDelete },
  },
}))

import { POST } from '@/app/api/locks/route'
import { DELETE } from '@/app/api/locks/[session_id]/route'

const NOW = new Date('2026-11-26T03:00:00.000Z')
const DAY = '2026-12-01'
const range = (s: string, e: string, d1 = DAY, d2 = DAY) => ({
  unit_id: 'unit-1',
  start_time: `${d1}T${s}+07:00`,
  end_time: `${d2}T${e}+07:00`,
})
const post = (body: unknown) =>
  new Request('http://localhost/api/locks', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })

describe('POST /api/locks (F3)', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    vi.resetAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {}) // Spy
    mocks.requireUser.mockResolvedValue({ user: { id: 'me' }, response: null })
    mocks.transaction.mockImplementation((cb: (tx: unknown) => unknown) =>
      cb({
        reservationLock: {
          deleteMany: mocks.txDeleteMany,
          findFirst: mocks.txLockFind,
          create: mocks.txLockCreate,
        },
        unit: { findUnique: mocks.txUnitFind },
        reservation: { count: mocks.txResCount },
      })
    )
    mocks.txUnitFind.mockResolvedValue({ id: 'unit-1', status: 'AVAILABLE' }) // Stub
    mocks.txResCount.mockResolvedValue(0) // Stub
    mocks.txLockFind.mockResolvedValue(null) // Stub
    mocks.txLockCreate.mockImplementation(async ({ data }: any) => ({ ...data, session_id: 'sess-1' }))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  const expectRejected = async (res: Response, status: number, message: string) => {
    expect(res.status).toBe(status)
    expect(await res.json()).toEqual({ success: false, session_id: '', message })
    expect(mocks.txLockCreate).not.toHaveBeenCalled()
  }

  it('TC-F3-01: returns 401 with the lock-style body when not logged in', async () => {
    // Arrange
    mocks.requireUser.mockResolvedValue({
      user: null,
      response: NextResponse.json({ error: 'x' }, { status: 401 }),
    })
    // Act
    const res = await POST(post(range('10:00:00', '12:00:00')))
    // Assert
    await expectRejected(res, 401, 'Not authenticated')
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it.each([
    ['not JSON', '{broken'],
    ['missing unit_id', { start_time: `${DAY}T10:00:00+07:00`, end_time: `${DAY}T11:00:00+07:00` }],
    ['start_time without offset', { unit_id: 'u', start_time: '2026-12-01T10:00:00', end_time: `${DAY}T11:00:00+07:00` }],
  ])('TC-F3-02: returns 400 for an invalid request (%s)', async (_label, body) => {
    // Arrange / Act
    const res = await POST(post(body))
    // Assert
    await expectRejected(res, 400, 'Invalid lock request')
  })

  it('TC-F3-03: returns 404 when the unit does not exist', async () => {
    // Arrange
    mocks.txUnitFind.mockResolvedValue(null)
    // Act
    const res = await POST(post(range('10:00:00', '12:00:00')))
    // Assert
    await expectRejected(res, 404, 'Unit not found')
  })

  it.each(['MAINTENANCE', 'OFFLINE'])('TC-F3-04: returns 409 when the unit is %s', async (status) => {
    // Arrange
    mocks.txUnitFind.mockResolvedValue({ id: 'unit-1', status })
    // Act
    const res = await POST(post(range('10:00:00', '12:00:00')))
    // Assert
    await expectRejected(res, 409, 'Unit is under maintenance or offline')
  })

  it.each([
    ['start equals end', '10:00:00', '10:00:00'],
    ['start after end', '12:00:00', '10:00:00'],
  ])('TC-F3-05: returns 400 when %s', async (_l, s, e) => {
    // Arrange / Act
    const res = await POST(post(range(s, e)))
    // Assert
    await expectRejected(res, 400, 'Start time must be before end time')
  })

  it.each([
    ['start is not on the hour', '10:30:00', '12:00:00'],
    ['end is not on the hour', '10:00:00', '12:30:00'],
    ['neither is on the hour', '10:15:00', '12:45:00'],
  ])('TC-F3-06: returns 400 when %s', async (_l, s, e) => {
    // Arrange / Act
    const res = await POST(post(range(s, e)))
    // Assert
    await expectRejected(res, 400, 'Time range must cover whole hours')
  })

  it.each([
    ['starts before 08:00', range('07:00:00', '09:00:00')],
    ['ends after 24:00', range('23:00:00', '01:00:00', DAY, '2026-12-02')],
    ['spans two days', range('10:00:00', '10:00:00', DAY, '2026-12-02')],
  ])('TC-F3-07: returns 400 when the range %s', async (_l, body) => {
    // Arrange / Act
    const res = await POST(post(body))
    // Assert
    await expectRejected(res, 400, 'Bookings must be within 08:00-24:00 WIB on a single day')
  })

  it('TC-F3-08: returns 409 when an active reservation overlaps', async () => {
    // Arrange
    mocks.txResCount.mockResolvedValue(1)
    // Act
    const res = await POST(post(range('10:00:00', '12:00:00')))
    // Assert
    await expectRejected(res, 409, 'Time slot is already booked')
    expect(mocks.txResCount.mock.calls[0][0].where.status).toEqual({ in: ['PENDING', 'CONFIRMED', 'ACTIVE'] })
  })

  it("TC-F3-09: returns 409 when another user's unexpired lock overlaps", async () => {
    // Arrange
    mocks.txLockFind.mockResolvedValue({ id: 'foreign' })
    // Act
    const res = await POST(post(range('10:00:00', '12:00:00')))
    // Assert
    await expectRejected(res, 409, 'Unit is being booked by another user')
    expect(mocks.txLockFind.mock.calls[0][0].where.user_id).toEqual({ not: 'me' })
  })

  it('TC-F3-10: acquires a 15-minute lock and replaces the caller\'s previous lock', async () => {
    // Arrange
    const body = range('10:00:00', '12:00:00')
    // Act
    const res = await POST(post(body))
    // Assert
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      success: true,
      session_id: 'sess-1',
      message: 'Lock acquired successfully',
    })
    expect(mocks.txDeleteMany).toHaveBeenNthCalledWith(1, { where: { expires_at: { lt: NOW } } })
    expect(mocks.txDeleteMany).toHaveBeenNthCalledWith(2, { where: { unit_id: 'unit-1', user_id: 'me' } })
    expect(mocks.txLockCreate).toHaveBeenCalledWith({
      data: {
        unit_id: 'unit-1',
        user_id: 'me',
        start_time: new Date(body.start_time),
        end_time: new Date(body.end_time),
        expires_at: new Date(NOW.getTime() + 15 * 60 * 1000),
      },
    })
  })

  it.each([
    ['08:00 start (opening boundary)', range('08:00:00', '09:00:00')],
    ['24:00 end (closing boundary)', range('23:00:00', '00:00:00', DAY, '2026-12-02')],
  ])('TC-F3-11: accepts the boundary %s', async (_l, body) => {
    // Arrange / Act
    const res = await POST(post(body))
    // Assert
    expect(res.status).toBe(200)
    expect((await res.json()).success).toBe(true)
  })

  it('TC-F3-12: returns 500 and logs when something unexpected fails', async () => {
    // Arrange
    mocks.txResCount.mockRejectedValue(new Error('db exploded'))
    // Act
    const res = await POST(post(range('10:00:00', '12:00:00')))
    // Assert
    await expectRejected(res, 500, 'Failed to acquire lock')
    expect(errorSpy).toHaveBeenCalledTimes(1)
  })
})

describe('DELETE /api/locks/[session_id] (F3)', () => {
  const dummyRequest = {} as Request // Dummy
  const params = { params: { session_id: 'sess-1' } }

  beforeEach(() => {
    vi.resetAllMocks()
    mocks.requireUser.mockResolvedValue({ user: { id: 'me' }, response: null })
  })

  it('TC-F3-13: returns 401 when not logged in (status taken from the guard response)', async () => {
    // Arrange
    mocks.requireUser.mockResolvedValue({
      user: null,
      response: NextResponse.json({ error: 'x' }, { status: 401 }),
    })
    // Act
    const res = await DELETE(dummyRequest, params)
    // Assert
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ success: false, message: 'Not authenticated' })
    expect(mocks.lockDelete).not.toHaveBeenCalled()
  })

  it('TC-F3-14: returns 404 when the lock does not exist', async () => {
    // Arrange
    mocks.lockFindFirst.mockResolvedValue(null)
    // Act
    const res = await DELETE(dummyRequest, params)
    // Assert
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ success: false, message: 'Lock not found' })
  })

  it("TC-F3-15: returns 403 when the lock belongs to another user", async () => {
    // Arrange
    mocks.lockFindFirst.mockResolvedValue({ id: 'l1', user_id: 'someone-else' })
    // Act
    const res = await DELETE(dummyRequest, params)
    // Assert
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ success: false, message: 'Forbidden' })
    expect(mocks.lockDelete).not.toHaveBeenCalled()
  })

  it('TC-F3-16: releases the caller\'s own lock', async () => {
    // Arrange
    mocks.lockFindFirst.mockResolvedValue({ id: 'l1', user_id: 'me' })
    // Act
    const res = await DELETE(dummyRequest, params)
    // Assert
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })
    expect(mocks.lockFindFirst).toHaveBeenCalledWith({ where: { session_id: 'sess-1' } })
    expect(mocks.lockDelete).toHaveBeenCalledWith({ where: { id: 'l1' } })
  })
})
