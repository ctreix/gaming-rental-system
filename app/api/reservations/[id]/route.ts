import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { serializeUnit } from '@/lib/serialize'
import {
  canTransition,
  getTransitionRule,
  type ReservationStatus,
  type TransitionActor,
} from '@/lib/reservation-status'

export const dynamic = 'force-dynamic'

const patchSchema = z.object({
  status: z.enum([
    'PENDING',
    'CONFIRMED',
    'ACTIVE',
    'COMPLETED',
    'CANCELLED',
    'NO_SHOW',
  ]),
})

// PATCH /api/reservations/[id] { status }
//
// Authenticated users only. The caller's role and ownership are read from the
// database (never trusted from the JWT alone):
//   - reservation missing, or caller may not see it -> 404
//   - transition not in the table                   -> 409
//   - caller's role/ownership not allowed by it     -> 403
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireUser()
  if (auth.response) return auth.response
  const user = auth.user

  const body = await request.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }
  const to = parsed.data.status

  const reservation = await prisma.reservation.findUnique({
    where: { id: params.id },
  })
  if (!reservation) {
    return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
  }

  const isOwner = reservation.user_id === user.id
  const isAdmin = user.role === 'ADMIN'
  // Do not reveal reservations the caller has no right to see.
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
  }

  const from = reservation.status as ReservationStatus
  const rule = getTransitionRule(from, to)
  if (!rule) {
    return NextResponse.json(
      { error: `Cannot change status from ${from} to ${to}` },
      { status: 409 }
    )
  }

  const actor: TransitionActor = {
    role: isAdmin ? 'ADMIN' : 'CUSTOMER',
    isOwner,
  }
  if (!canTransition(from, to, actor)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const data: Prisma.ReservationUpdateInput = { status: to }
  if (rule.effect?.payment_status) {
    data.payment_status = rule.effect.payment_status
  }
  if (rule.effect?.verifyPayment) {
    data.payment_verified_at = new Date()
    data.payment_verified_by = user.id
  }

  const updated = await prisma.$transaction((tx) =>
    tx.reservation.update({
      where: { id: reservation.id },
      data,
      include: { unit: true },
    })
  )

  return NextResponse.json({
    reservation: { ...updated, unit: serializeUnit(updated.unit) },
  })
}
