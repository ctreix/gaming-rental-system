import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const querySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

// Business timezone is Asia/Jakarta (UTC+7, no DST): day boundaries are
// built from "YYYY-MM-DD" as `${date}T${hh}:00:00+07:00`.
const FIRST_HOUR = 8 // 08:00 WIB
const LAST_HOUR = 23 // last slot starts 23:00, ends 24:00 WIB

type Interval = { start_time: Date; end_time: Date }

// Strict overlap: start < other.end AND end > other.start.
function overlaps(a: Interval, b: Interval): boolean {
  return a.start_time < b.end_time && a.end_time > b.start_time
}

// GET /api/units/[id]/availability?date=YYYY-MM-DD  (requires login)
// -> [{ start, end, available }] for every hour 08:00..23:00 WIB.
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireUser()
  if (auth.response) return auth.response

  const { searchParams } = new URL(request.url)
  const parsed = querySchema.safeParse({ date: searchParams.get('date') })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
  }
  const { date } = parsed.data

  const dayStart = new Date(`${date}T08:00:00+07:00`)
  const dayEnd = new Date(`${date}T00:00:00+07:00`).getTime() + 24 * 60 * 60 * 1000
  const windowEnd = new Date(dayEnd)
  const now = new Date()

  const [reservations, locks] = await Promise.all([
    // Blocking reservations: PENDING, CONFIRMED or ACTIVE.
    prisma.reservation.findMany({
      where: {
        unit_id: params.id,
        status: { in: ['PENDING', 'CONFIRMED', 'ACTIVE'] },
        start_time: { lt: windowEnd },
        end_time: { gt: dayStart },
      },
      select: { start_time: true, end_time: true },
    }),
    // Unexpired locks belonging to OTHER users.
    prisma.reservationLock.findMany({
      where: {
        unit_id: params.id,
        expires_at: { gt: now },
        user_id: { not: auth.user.id },
        start_time: { lt: windowEnd },
        end_time: { gt: dayStart },
      },
      select: { start_time: true, end_time: true },
    }),
  ])

  const slots = []
  for (let hour = FIRST_HOUR; hour <= LAST_HOUR; hour++) {
    const start = new Date(
      `${date}T${String(hour).padStart(2, '0')}:00:00+07:00`
    )
    const end = new Date(start.getTime() + 60 * 60 * 1000)

    const blockedByReservation = reservations.some((r) => overlaps({ start_time: start, end_time: end }, r))
    const blockedByLock = locks.some((l) => overlaps({ start_time: start, end_time: end }, l))
    const alreadyStarted = start.getTime() <= now.getTime()

    slots.push({
      start: start.toISOString(),
      end: end.toISOString(),
      available: !blockedByReservation && !blockedByLock && !alreadyStarted,
    })
  }

  return NextResponse.json(slots)
}
