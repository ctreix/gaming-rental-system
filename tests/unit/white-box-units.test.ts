// White-box unit tests - Feature F1 (Katalog unit) and F2 (Detail unit & ketersediaan)
// Units: GET /api/units (12-27), GET /api/units/[id] (8-16),
//        GET /api/units/[id]/availability (26-88) incl. overlaps (20-22)
//
// Test doubles:
//   Dummy : `dummyRequest` / unused first argument of GET /api/units/[id]
//   Stub  : prisma.unit.findMany/findUnique, prisma.reservation.findMany, prisma.reservationLock.findMany,
//           requireUser (canned values)
//   Mock  : prisma.unit.findMany - the `where` / `orderBy` arguments are asserted
//   Fake  : fake timers (so "now" is fixed and slot availability is deterministic)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  unitFindMany: vi.fn(),
  unitFindUnique: vi.fn(),
  reservationFindMany: vi.fn(),
  lockFindMany: vi.fn(),
  requireUser: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    unit: { findMany: mocks.unitFindMany, findUnique: mocks.unitFindUnique },
    reservation: { findMany: mocks.reservationFindMany },
    reservationLock: { findMany: mocks.lockFindMany },
  },
}))
vi.mock('@/lib/auth', () => ({ requireUser: mocks.requireUser }))

import { GET as listUnits } from '@/app/api/units/route'
import { GET as unitDetail } from '@/app/api/units/[id]/route'
import { GET as availability } from '@/app/api/units/[id]/availability/route'

const unit = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  name: `Unit ${id}`,
  type: 'PC',
  hourly_rate: 10000,
  specifications: '{"cpu":"i7"}',
  ...extra,
})

beforeEach(() => {
  vi.resetAllMocks()
})

describe('GET /api/units (F1)', () => {
  it('TC-F1-01: lists all units sorted by name when no type filter is given', async () => {
    // Arrange
    mocks.unitFindMany.mockResolvedValue([unit('a'), unit('b')])
    const request = new Request('http://localhost/api/units')
    // Act
    const res = await listUnits(request)
    // Assert
    expect(res.status).toBe(200)
    expect(mocks.unitFindMany).toHaveBeenCalledWith({ where: undefined, orderBy: { name: 'asc' } })
    const json = await res.json()
    expect(json).toHaveLength(2)
    expect(json[0].specifications).toEqual({ cpu: 'i7' }) // serializeUnit parsed the JSON text
  })

  it.each(['PC', 'PS5', 'VIP'])('TC-F1-02: filters by type %s', async (type) => {
    // Arrange
    mocks.unitFindMany.mockResolvedValue([])
    const request = new Request(`http://localhost/api/units?type=${type}`)
    // Act
    const res = await listUnits(request)
    // Assert
    expect(res.status).toBe(200)
    expect(mocks.unitFindMany).toHaveBeenCalledWith({ where: { type }, orderBy: { name: 'asc' } })
  })

  it.each(['XBOX', 'pc', ''])('TC-F1-03: rejects the invalid type "%s" with 400', async (type) => {
    // Arrange
    const request = new Request(`http://localhost/api/units?type=${type}`)
    // Act
    const res = await listUnits(request)
    // Assert
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Invalid unit type' })
    expect(mocks.unitFindMany).not.toHaveBeenCalled()
  })
})

describe('GET /api/units/[id] (F2 detail)', () => {
  const dummyRequest = {} as Request // Dummy: the handler ignores it

  it('TC-F2-01: returns the unit with parsed specifications', async () => {
    // Arrange
    mocks.unitFindUnique.mockResolvedValue(unit('u1'))
    // Act
    const res = await unitDetail(dummyRequest, { params: { id: 'u1' } })
    // Assert
    expect(res.status).toBe(200)
    expect(mocks.unitFindUnique).toHaveBeenCalledWith({ where: { id: 'u1' } })
    expect((await res.json()).specifications).toEqual({ cpu: 'i7' })
  })

  it('TC-F2-02: returns 404 when the unit does not exist', async () => {
    // Arrange
    mocks.unitFindUnique.mockResolvedValue(null)
    // Act
    const res = await unitDetail(dummyRequest, { params: { id: 'nope' } })
    // Assert
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Unit not found' })
  })
})

describe('GET /api/units/[id]/availability (F2 slots)', () => {
  const DATE = '2026-12-01'
  const wib = (hh: string, date = DATE) => new Date(`${date}T${hh}+07:00`)
  const call = (query = `?date=${DATE}`) =>
    availability(new Request(`http://localhost/api/units/u1/availability${query}`), {
      params: { id: 'u1' },
    })

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-26T03:00:00.000Z')) // before the test day
    mocks.requireUser.mockResolvedValue({ user: { id: 'me' }, response: null })
    mocks.reservationFindMany.mockResolvedValue([])
    mocks.lockFindMany.mockResolvedValue([])
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('TC-F2-03: returns the auth response when the user is not logged in', async () => {
    // Arrange
    const unauthorized = NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    mocks.requireUser.mockResolvedValue({ user: null, response: unauthorized })
    // Act
    const res = await call()
    // Assert
    expect(res.status).toBe(401)
    expect(mocks.reservationFindMany).not.toHaveBeenCalled()
  })

  it.each(['', '?date=2026-1-1', '?date=01-12-2026', '?date=abc'])(
    'TC-F2-04: rejects an invalid date (%s) with 400',
    async (query) => {
      // Arrange (nothing else to prepare)
      // Act
      const res = await call(query)
      // Assert
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: 'Invalid date' })
    }
  )

  it('TC-F2-05: returns 16 slots (08:00-23:00 WIB), all available on a free future day', async () => {
    // Arrange (default stubs: no reservations, no locks)
    // Act
    const res = await call()
    // Assert
    const slots = await res.json()
    expect(slots).toHaveLength(16)
    expect(slots[0]).toEqual({
      start: wib('08:00').toISOString(),
      end: wib('09:00').toISOString(),
      available: true,
    })
    expect(slots[15].end).toBe(wib('00:00', '2026-12-02').toISOString())
    expect(slots.every((s: any) => s.available)).toBe(true)
  })

  it('TC-F2-06: marks slots that overlap a reservation as unavailable (strict overlap)', async () => {
    // Arrange: reservation 10:00-12:00 blocks the 10:00 and 11:00 slots only
    mocks.reservationFindMany.mockResolvedValue([
      { start_time: wib('10:00'), end_time: wib('12:00') },
    ])
    // Act
    const res = await call()
    // Assert
    const slots = await res.json()
    const free = (hh: string) =>
      slots.find((s: any) => s.start === wib(hh).toISOString()).available
    expect(free('09:00')).toBe(true) // ends exactly when the reservation starts
    expect(free('10:00')).toBe(false)
    expect(free('11:00')).toBe(false)
    expect(free('12:00')).toBe(true) // starts exactly when the reservation ends
  })

  it("TC-F2-07: marks slots held by another user's lock as unavailable", async () => {
    // Arrange
    mocks.lockFindMany.mockResolvedValue([{ start_time: wib('14:00'), end_time: wib('15:00') }])
    // Act
    const res = await call()
    // Assert
    const slots = await res.json()
    expect(slots.find((s: any) => s.start === wib('14:00').toISOString()).available).toBe(false)
    expect(slots.filter((s: any) => !s.available)).toHaveLength(1)
    const lockQuery = mocks.lockFindMany.mock.calls[0][0].where
    expect(lockQuery.user_id).toEqual({ not: 'me' }) // my own lock must not block me
  })

  it('TC-F2-08: marks slots that already started as unavailable', async () => {
    // Arrange: "now" is 12:30 WIB on the requested day
    vi.setSystemTime(new Date(`${DATE}T12:30:00+07:00`))
    // Act
    const res = await call()
    // Assert
    const slots = await res.json()
    const avail = (hh: string) => slots.find((s: any) => s.start === wib(hh).toISOString()).available
    expect(avail('12:00')).toBe(false) // started 30 minutes ago
    expect(avail('13:00')).toBe(true)
    expect(avail('08:00')).toBe(false)
  })

  it('TC-F2-08b: a slot that starts exactly now is already unavailable (boundary)', async () => {
    // Arrange: "now" is exactly 12:00:00 WIB
    vi.setSystemTime(new Date(`${DATE}T12:00:00+07:00`))
    // Act
    const res = await call()
    // Assert
    const slots = await res.json()
    const avail = (hh: string) => slots.find((s: any) => s.start === wib(hh).toISOString()).available
    expect(avail('12:00')).toBe(false)
    expect(avail('13:00')).toBe(true)
  })

  it('TC-F2-09: queries only blocking statuses within the day window', async () => {
    // Arrange / Act
    await call()
    // Assert
    const where = mocks.reservationFindMany.mock.calls[0][0].where
    expect(where.unit_id).toBe('u1')
    expect(where.status).toEqual({ in: ['PENDING', 'CONFIRMED', 'ACTIVE'] })
    expect(where.end_time).toEqual({ gt: wib('08:00') })
    expect(where.start_time).toEqual({ lt: wib('00:00', '2026-12-02') })
  })
})
