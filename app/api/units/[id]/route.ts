import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { serializeUnit } from '@/lib/serialize'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const unit = await prisma.unit.findUnique({ where: { id: params.id } })
  if (!unit) {
    return NextResponse.json({ error: 'Unit not found' }, { status: 404 })
  }
  return NextResponse.json(serializeUnit(unit))
}
