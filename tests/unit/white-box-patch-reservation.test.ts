// White-box unit tests: PATCH /api/reservations/[id]
// (app/api/reservations/[id]/route.ts, lines 34-100)
// Pre-Lab design: TC-01..TC-08 -> 33/33 statements, 18/18 branches.
//
// Test doubles used (all external dependencies of PATCH are replaced):
//   Dummy : `dummyRequest` in TC-01 (passed only to satisfy the signature).
//   Stub  : requireUser, prisma.reservation.findUnique, serializeUnit
//           (return canned values, no assertions on how they were called).
//   Mock  : `updateMock` (tx.reservation.update) - we assert it is called once
//           with the exact data on success, and never on rejection.
//   Fake  : the $transaction implementation (a working stand-in that just runs
//           the callback with a fake `tx`) and fake timers for new Date().
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  findUnique: vi.fn(),
  updateMock: vi.fn(),
  serializeUnit: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ requireUser: mocks.requireUser }))
vi.mock('@/lib/serialize', () => ({ serializeUnit: mocks.serializeUnit }))
vi.mock('@/lib/db', () => ({
  prisma: {
    reservation: { findUnique: mocks.findUnique },
    // Fake: a working, simplified $transaction that runs the callback.
    $transaction: (cb: (tx: unknown) => unknown) =>
      cb({ reservation: { update: mocks.updateMock } }),
  },
}))

import { NextResponse } from 'next/server'
import { PATCH } from '@/app/api/reservations/[id]/route'

const ADMIN = { id: 'admin-1', role: 'ADMIN' }
const OWNER = { id: 'user-1', role: 'CUSTOMER' }
const OTHER = { id: 'user-2', role: 'CUSTOMER' }
const RES_ID = 'res-1'
const params = { params: { id: RES_ID } }

const patchRequest = (body: unknown) =>
  new Request('http://localhost/api/reservations/res-1', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })

const reservation = (status: string, user_id = OWNER.id) => ({
  id: RES_ID,
  user_id,
  status,
})

describe('PATCH /api/reservations/[id]', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-26T03:00:00.000Z'))
    // Default stubs: authenticated user is set per test.
    mocks.serializeUnit.mockImplementation((u: unknown) => ({ serialized: u }))
    mocks.updateMock.mockImplementation(async (args: any) => ({
      ...args.data,
      id: RES_ID,
      unit: { id: 'unit-1' },
    }))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  // ---------- Negative scenarios (rejections) ----------

  it('TC-F5-01: returns the auth response (401) when the user is not authenticated', async () => {
    // Arrange
    const unauthorized = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    mocks.requireUser.mockResolvedValue({ response: unauthorized })
    const dummyRequest = {} as Request // Dummy: never touched by the unit
    // Act
    const res = await PATCH(dummyRequest, params)
    // Assert
    expect(res.status).toBe(401)
    expect(res).toBe(unauthorized)
    expect(mocks.findUnique).not.toHaveBeenCalled()
    expect(mocks.updateMock).not.toHaveBeenCalled()
  })

  it('TC-F5-02: returns 400 when the body is not valid JSON', async () => {
    // Arrange
    mocks.requireUser.mockResolvedValue({ user: OWNER })
    const request = patchRequest('{not-json')
    // Act
    const res = await PATCH(request, params)
    // Assert
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Invalid input' })
    expect(mocks.updateMock).not.toHaveBeenCalled()
  })

  it('TC-F5-02b: returns 400 when status is not one of the allowed values', async () => {
    // Arrange
    mocks.requireUser.mockResolvedValue({ user: OWNER })
    const request = patchRequest({ status: 'DELETED' })
    // Act
    const res = await PATCH(request, params)
    // Assert
    expect(res.status).toBe(400)
    expect(mocks.findUnique).not.toHaveBeenCalled()
  })

  it('TC-F5-03: returns 404 when the reservation does not exist', async () => {
    // Arrange
    mocks.requireUser.mockResolvedValue({ user: ADMIN })
    mocks.findUnique.mockResolvedValue(null)
    const request = patchRequest({ status: 'CONFIRMED' })
    // Act
    const res = await PATCH(request, params)
    // Assert
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Reservation not found' })
    expect(mocks.updateMock).not.toHaveBeenCalled()
  })

  it('TC-F5-04: returns 404 (not 403) when a CUSTOMER is not the owner', async () => {
    // Arrange
    mocks.requireUser.mockResolvedValue({ user: OTHER })
    mocks.findUnique.mockResolvedValue(reservation('PENDING', OWNER.id))
    const request = patchRequest({ status: 'CANCELLED' })
    // Act
    const res = await PATCH(request, params)
    // Assert
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Reservation not found' })
    expect(mocks.updateMock).not.toHaveBeenCalled()
  })

  it('TC-F5-05: returns 409 when the transition is not in the table', async () => {
    // Arrange
    mocks.requireUser.mockResolvedValue({ user: ADMIN })
    mocks.findUnique.mockResolvedValue(reservation('PENDING'))
    const request = patchRequest({ status: 'ACTIVE' })
    // Act
    const res = await PATCH(request, params)
    // Assert
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({
      error: 'Cannot change status from PENDING to ACTIVE',
    })
    expect(mocks.updateMock).not.toHaveBeenCalled()
  })

  it('TC-F5-06: returns 403 when the owner tries a transition reserved for ADMIN', async () => {
    // Arrange
    mocks.requireUser.mockResolvedValue({ user: OWNER })
    mocks.findUnique.mockResolvedValue(reservation('CONFIRMED'))
    const request = patchRequest({ status: 'CANCELLED' })
    // Act
    const res = await PATCH(request, params)
    // Assert
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'Forbidden' })
    expect(mocks.updateMock).not.toHaveBeenCalled()
  })

  // ---------- Positive scenarios ----------

  it('TC-F5-07: ADMIN confirms a PENDING reservation (payment PAID + verified)', async () => {
    // Arrange
    mocks.requireUser.mockResolvedValue({ user: ADMIN })
    mocks.findUnique.mockResolvedValue(reservation('PENDING'))
    const request = patchRequest({ status: 'CONFIRMED' })
    // Act
    const res = await PATCH(request, params)
    // Assert
    expect(res.status).toBe(200)
    expect(mocks.updateMock).toHaveBeenCalledTimes(1)
    expect(mocks.updateMock).toHaveBeenCalledWith({
      where: { id: RES_ID },
      data: {
        status: 'CONFIRMED',
        payment_status: 'PAID',
        payment_verified_at: new Date('2026-11-26T03:00:00.000Z'),
        payment_verified_by: ADMIN.id,
      },
      include: { unit: true },
    })
    expect(mocks.serializeUnit).toHaveBeenCalledWith({ id: 'unit-1' })
    const json = await res.json()
    expect(json.reservation.status).toBe('CONFIRMED')
  })

  it('TC-F5-08: the owner cancels a PENDING reservation (no payment side effects)', async () => {
    // Arrange
    mocks.requireUser.mockResolvedValue({ user: OWNER })
    mocks.findUnique.mockResolvedValue(reservation('PENDING'))
    const request = patchRequest({ status: 'CANCELLED' })
    // Act
    const res = await PATCH(request, params)
    // Assert
    expect(res.status).toBe(200)
    expect(mocks.updateMock).toHaveBeenCalledTimes(1)
    expect(mocks.updateMock).toHaveBeenCalledWith({
      where: { id: RES_ID },
      data: { status: 'CANCELLED' },
      include: { unit: true },
    })
  })

  it('extra: ADMIN cancels a CONFIRMED reservation (payment REFUNDED, not re-verified)', async () => {
    // Arrange
    mocks.requireUser.mockResolvedValue({ user: ADMIN })
    mocks.findUnique.mockResolvedValue(reservation('CONFIRMED'))
    const request = patchRequest({ status: 'CANCELLED' })
    // Act
    const res = await PATCH(request, params)
    // Assert
    expect(res.status).toBe(200)
    expect(mocks.updateMock).toHaveBeenCalledWith({
      where: { id: RES_ID },
      data: { status: 'CANCELLED', payment_status: 'REFUNDED' },
      include: { unit: true },
    })
  })
})
