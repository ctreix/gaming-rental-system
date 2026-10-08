import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const LOCK_MINUTES = 15
const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
// Business timezone is Asia/Jakarta (UTC+7, no DST).
const WIB_OFFSET_MS = 7 * HOUR_MS
const OPEN_HOUR_MS = 8 * HOUR_MS // 08:00 WIB

const createLockSchema = z.object({
  unit_id: z.string().min(1),
  start_time: z.string().datetime({ offset: true }),
  end_time: z.string().datetime({ offset: true }),
})

type LockResult = {
  success: boolean
  session_id: string
  message: string
}

// Status is always explicit: a successful lock must never inherit a failure
// default and be turned into an error by clients checking `res.ok`.
const result = (body: LockResult, status: number) =>
  NextResponse.json<LockResult>(body, { status })

// Thrown inside the transaction to roll back on any rejection.
class LockRejected extends Error {
  constructor(
    message: string,
    readonly statusCode = 400
  ) {
    super(message)
  }
}

// POST /api/locks { unit_id, start_time, end_time }
// Keeps the legacy `acquire_unit_lock()` RPC response contract:
// { success: boolean, session_id: string, message: string }.
//
// Never touches units.status (it stays AVAILABLE/MAINTENANCE/OFFLINE and is
// only changed by an admin).
export async function POST(request: Request) {
  const auth = await requireUser()
  if (auth.response) {
    return result(
      { success: false, session_id: '', message: 'Not authenticated' },
      auth.response.status
    )
  }
  const userId = auth.user.id

  const body = await request.json().catch(() => null)
  const parsed = createLockSchema.safeParse(body)
  if (!parsed.success) {
    return result({ success: false, session_id: '', message: 'Invalid lock request' }, 400)
  }

  const start = new Date(parsed.data.start_time)
  const end = new Date(parsed.data.end_time)

  try {
    const lock = await prisma.$transaction(async (tx) => {
      // 1. Clean up expired locks first.
      await tx.reservationLock.deleteMany({
        where: { expires_at: { lt: new Date() } },
      })

      // 2. Unit must be bookable.
      const unit = await tx.unit.findUnique({ where: { id: parsed.data.unit_id } })
      if (!unit) throw new LockRejected('Unit not found', 404)
      if (unit.status === 'MAINTENANCE' || unit.status === 'OFFLINE') {
        throw new LockRejected('Unit is under maintenance or offline', 409)
      }

      // 3. Range sanity: start < end, whole hours, 08:00-24:00 WIB of a
      //    single day.
      if (start.getTime() >= end.getTime()) {
        throw new LockRejected('Start time must be before end time')
      }
      const wholeHours =
        (start.getTime() + WIB_OFFSET_MS) % HOUR_MS === 0 &&
        (end.getTime() + WIB_OFFSET_MS) % HOUR_MS === 0
      if (!wholeHours) {
        throw new LockRejected('Time range must cover whole hours')
      }
      const startRel = start.getTime() + WIB_OFFSET_MS
      const startOfDay = Math.floor(startRel / DAY_MS) * DAY_MS
      const withinDay =
        startRel >= startOfDay + OPEN_HOUR_MS &&
        end.getTime() + WIB_OFFSET_MS <= startOfDay + DAY_MS
      if (!withinDay) {
        throw new LockRejected('Bookings must be within 08:00-24:00 WIB on a single day')
      }

      // 4a. Strict overlap with active reservations (start < other.end AND
      //     end > other.start).
      const overlappingReservations = await tx.reservation.count({
        where: {
          unit_id: unit.id,
          status: { in: ['PENDING', 'CONFIRMED', 'ACTIVE'] },
          start_time: { lt: end },
          end_time: { gt: start },
        },
      })
      if (overlappingReservations > 0) {
        throw new LockRejected('Time slot is already booked', 409)
      }

      // 4b. Strict overlap with ANOTHER user's unexpired lock.
      const foreignLock = await tx.reservationLock.findFirst({
        where: {
          unit_id: unit.id,
          expires_at: { gt: new Date() },
          user_id: { not: userId },
          start_time: { lt: end },
          end_time: { gt: start },
        },
      })
      if (foreignLock) {
        throw new LockRejected('Unit is being booked by another user', 409)
      }

      // 5. Replace the caller's previous lock on this unit.
      await tx.reservationLock.deleteMany({
        where: { unit_id: unit.id, user_id: userId },
      })

      // 6. Create the lock (session_id comes from the column default).
      return tx.reservationLock.create({
        data: {
          unit_id: unit.id,
          user_id: userId,
          start_time: start,
          end_time: end,
          expires_at: new Date(Date.now() + LOCK_MINUTES * 60 * 1000),
        },
      })
    })

    return result(
      {
        success: true,
        session_id: lock.session_id,
        message: 'Lock acquired successfully',
      },
      200
    )
  } catch (err) {
    if (err instanceof LockRejected) {
      return result(
        { success: false, session_id: '', message: err.message },
        err.statusCode
      )
    }
    console.error('[locks/post]', err)
    return result({ success: false, session_id: '', message: 'Failed to acquire lock' }, 500)
  }
}
