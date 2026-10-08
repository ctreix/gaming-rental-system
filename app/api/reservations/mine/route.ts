import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { serializeUnit } from '@/lib/serialize'

export const dynamic = 'force-dynamic'

// GET /api/reservations/mine - the caller's reservations with `unit`
// nested, newest first.
export async function GET() {
  const auth = await requireUser()
  if (auth.response) return auth.response

  const rows = await prisma.reservation.findMany({
    where: { user_id: auth.user.id },
    include: { unit: true },
    orderBy: { created_at: 'desc' },
  })

  return NextResponse.json(
    rows.map((row) => ({ ...row, unit: serializeUnit(row.unit) }))
  )
}
