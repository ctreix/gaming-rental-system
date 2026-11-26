// White-box unit tests - lib/db.ts (Prisma singleton, lines 1-9)
// Test doubles:
//   Stub : a fake PrismaClient class replaces the real client (no database is opened)
//   Spy  : the constructor counts how many clients get created
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const ctor = vi.hoisted(() => vi.fn())
vi.mock('@prisma/client', () => ({
  PrismaClient: class {
    constructor() {
      ctor()
    }
  },
}))

const g = globalThis as unknown as { prisma?: unknown }

describe('prisma singleton', () => {
  beforeEach(() => {
    vi.resetModules()
    ctor.mockClear()
    delete g.prisma
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    delete g.prisma
  })

  it('TC-LIB-26: in development the client is cached on globalThis and reused after a reload', async () => {
    // Arrange
    vi.stubEnv('NODE_ENV', 'development')
    // Act
    const first = (await import('@/lib/db')).prisma
    vi.resetModules()
    const second = (await import('@/lib/db')).prisma
    // Assert
    expect(g.prisma).toBe(first)
    expect(second).toBe(first)
    expect(ctor).toHaveBeenCalledTimes(1)
  })

  it('TC-LIB-27: in production the client is not stored on globalThis', async () => {
    // Arrange
    vi.stubEnv('NODE_ENV', 'production')
    // Act
    await import('@/lib/db')
    // Assert
    expect(g.prisma).toBeUndefined()
    expect(ctor).toHaveBeenCalledTimes(1)
  })
})
