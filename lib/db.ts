import { PrismaClient } from '@prisma/client'

// Standard Prisma singleton: reuse one client across hot reloads in dev so
// we don't exhaust the database connection pool.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
