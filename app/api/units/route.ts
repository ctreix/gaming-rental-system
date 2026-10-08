import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { serializeUnit } from '@/lib/serialize'

export const dynamic = 'force-dynamic'

const listQuerySchema = z.object({
  type: z.enum(['PC', 'PS5', 'VIP']).optional(),
})

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const parsed = listQuerySchema.safeParse({
    type: searchParams.get('type') ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid unit type' }, { status: 400 })
  }

  const units = await prisma.unit.findMany({
    where: parsed.data.type ? { type: parsed.data.type } : undefined,
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(units.map(serializeUnit))
}
