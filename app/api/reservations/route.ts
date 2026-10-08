import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const createSchema = z.object({
  session_id: z.string().min(1),
})

// Thrown inside the transaction to roll back on any rejection.
class ReservationRejected extends Error {
  constructor(
    message: string,
    readonly statusCode = 400
  ) {
    super(message)
  }
}

// POST /api/reservations { session_id }
//
// Everything is derived from the caller's lock inside one transaction:
//   - 409 when the lock is missing or expired,
//   - total_hours / total_amount computed server-side from the lock range and
//     the unit's CURRENT hourly_rate (amounts from the client are ignored),
//   - the reservation is created as PENDING / PENDING,
//   - the lock is consumed (deleted), so a reservation can never exist
//     without a valid lock.
export async function POST(request: Request) {
  const auth = await requireUser()
  if (auth.response) return auth.response
  const { user } = auth

  const body = await request.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  try {
    const reservation = await prisma.$transaction(async (tx) => {
      const now = new Date()
      const lock = await tx.reservationLock.findFirst({
        where: { session_id: parsed.data.session_id, user_id: user.id },
      })
      if (!lock || lock.expires_at.getTime() <= now.getTime()) {
        throw new ReservationRejected(
          'Booking session is missing or expired',
          409
        )
      }

      const unit = await tx.unit.findUnique({ where: { id: lock.unit_id } })
      if (!unit) throw new ReservationRejected('Unit not found', 404)

      // Server-side pricing - never trust amounts from the client.
      const total_hours = Math.round(
        (lock.end_time.getTime() - lock.start_time.getTime()) / (60 * 60 * 1000)
      )
      const total_amount = unit.hourly_rate * total_hours

      const created = await tx.reservation.create({
        data: {
          user_id: user.id,
          unit_id: lock.unit_id,
          status: 'PENDING',
          payment_status: 'PENDING',
          start_time: lock.start_time,
          end_time: lock.end_time,
          hourly_rate: unit.hourly_rate,
          total_hours,
          total_amount,
        },
      })

      await tx.reservationLock.delete({ where: { id: lock.id } })
      return created
    })

    return NextResponse.json({ reservation })
  } catch (err) {
    if (err instanceof ReservationRejected) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    console.error('[reservations/post]', err)
    return NextResponse.json({ error: 'Booking failed to save' }, { status: 500 })
  }
}
