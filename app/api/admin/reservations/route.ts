import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { serializeUnit } from '@/lib/serialize'

export const dynamic = 'force-dynamic'

// GET /api/admin/reservations - ADMIN only (role verified in the database).
// Includes `unit` and `user` (id, full_name, phone_number, role - never
// email or password_hash).
export async function GET() {
  const auth = await requireAdmin()
  if (auth.response) return auth.response

  const rows = await prisma.reservation.findMany({
    include: {
      unit: true,
      user: {
        select: { id: true, full_name: true, phone_number: true, role: true },
      },
    },
    orderBy: { start_time: 'desc' },
  })

  return NextResponse.json(
    rows.map((row) => ({ ...row, unit: serializeUnit(row.unit) }))
  )
}
