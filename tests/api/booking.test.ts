import { describe, it, expect, beforeAll } from 'vitest'

// The dev server is started by tests/api/global-setup.ts on this port.
const BASE = process.env.TEST_BASE_URL ?? 'http://localhost:3210'

async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  expect(res.status).toBe(200)
  return (res.headers.get('set-cookie') ?? '').split(';')[0]
}

async function firstUnitId(): Promise<string> {
  const res = await fetch(`${BASE}/api/units`)
  const units = (await res.json()) as { id: string }[]
  return units[0].id
}

async function postLock(unitId: string, start: string, end: string, cookie: string) {
  const res = await fetch(`${BASE}/api/locks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ unit_id: unitId, start_time: start, end_time: end }),
  })
  return { res, body: (await res.json()) as { success: boolean; session_id: string; message: string } }
}

// A fixed future day; the test DB is recreated before every run.
const DAY = '2027-03-15'
const wib = (h: number) => `${DAY}T${String(h).padStart(2, '0')}:00:00+07:00`

describe('booking API', () => {
  let customerCookie = ''
  let adminCookie = ''
  let unitId = ''

  beforeAll(async () => {
    customerCookie = await login('customer@gamerent.local', 'Customer12345')
    adminCookie = await login('admin@gamerent.local', 'Admin12345')
    unitId = await firstUnitId()
  })

  it('a successful lock returns HTTP 200 (Step 1 regression)', async () => {
    const { res, body } = await postLock(unitId, wib(10), wib(12), customerCookie)
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.session_id).toBeTruthy()
    expect(body.message).toBe('Lock acquired successfully')
  })

  it('an overlapping lock for another user is a conflict', async () => {
    const { res, body } = await postLock(unitId, wib(11), wib(12), adminCookie)
    expect(res.status).toBe(409)
    expect(body.success).toBe(false)
  })

  it('back-to-back slots succeed', async () => {
    const { res, body } = await postLock(unitId, wib(12), wib(13), adminCookie)
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
  })

  it('a reservation without a valid lock returns 409', async () => {
    const res = await fetch(`${BASE}/api/reservations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: customerCookie },
      body: JSON.stringify({ session_id: 'no-such-lock' }),
    })
    expect(res.status).toBe(409)
  })

  it('a client cannot set its own role on register', async () => {
    const email = `api.role.${Date.now()}@example.com`
    const res = await fetch(`${BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'Role Probe',
        email,
        password: 'Password123',
        role: 'ADMIN',
      }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { user: { role: string } }
    expect(body.user.role).toBe('CUSTOMER')
  })

  it('a client cannot set the reservation amount or status', async () => {
    const lock = await postLock(unitId, wib(14), wib(15), customerCookie)
    expect(lock.res.status).toBe(200)

    const res = await fetch(`${BASE}/api/reservations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: customerCookie },
      body: JSON.stringify({
        session_id: lock.body.session_id,
        total_amount: 1,
        hourly_rate: 1,
        status: 'CONFIRMED',
      }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      reservation: { total_amount: number; status: string; total_hours: number }
    }

    const unitRes = await fetch(`${BASE}/api/units/${unitId}`)
    const unit = (await unitRes.json()) as { hourly_rate: number }

    expect(body.reservation.status).toBe('PENDING')
    expect(body.reservation.total_hours).toBe(1)
    expect(body.reservation.total_amount).toBe(unit.hourly_rate)
    expect(body.reservation.total_amount).not.toBe(1)
  })
})
