import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// DELETE /api/locks/[session_id] - release a lock. Only the owner can
// release it. Does not touch units.status.
export async function DELETE(
  _request: Request,
  { params }: { params: { session_id: string } }
) {
  const auth = await requireUser()
  if (auth.response) {
    return NextResponse.json(
      { success: false, message: 'Not authenticated' },
      { status: auth.response.status }
    )
  }

  const lock = await prisma.reservationLock.findFirst({
    where: { session_id: params.session_id },
  })
  if (!lock) {
    return NextResponse.json(
      { success: false, message: 'Lock not found' },
      { status: 404 }
    )
  }
  if (lock.user_id !== auth.user.id) {
    return NextResponse.json(
      { success: false, message: 'Forbidden' },
      { status: 403 }
    )
  }

  await prisma.reservationLock.delete({ where: { id: lock.id } })
  return NextResponse.json({ success: true })
}
