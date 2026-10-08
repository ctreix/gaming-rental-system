import { createHash, randomBytes } from 'crypto'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { forgotSchema } from '@/lib/validation'

export const dynamic = 'force-dynamic'

// Identical response whether or not the account exists (no user enumeration).
const MESSAGE = 'If an account exists for this email, a reset link has been generated.'

const neutral = () => NextResponse.json({ success: true, message: MESSAGE })

// ---------------------------------------------------------------------------
// In-memory fixed-window rate limiter (single Node process; a multi-instance
// deployment would need a shared store instead).
// ---------------------------------------------------------------------------

const WINDOW_MS = 15 * 60 * 1000 // 15 minutes
const EMAIL_LIMIT = 5 // allowed requests per email per window
const IP_LIMIT = 20 // allowed requests per client IP per window

const buckets = new Map<string, { count: number; resetAt: number }>()

// Returns true when the request is allowed. Counters never change the
// response body: throttled requests get the exact same neutral 200.
function rateLimit(key: string, limit: number): boolean {
  const now = Date.now()
  // Opportunistic purge so rotating keys cannot grow the map unbounded.
  if (buckets.size > 1000) {
    buckets.forEach((b, k) => {
      if (b.resetAt <= now) buckets.delete(k)
    })
  }
  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return true
  }
  bucket.count += 1
  return bucket.count <= limit
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return request.headers.get('x-real-ip') ?? 'unknown'
}

export async function POST(request: Request) {
  // Per-IP first: when throttled, skip the email bucket and the database.
  if (!rateLimit(`ip:${clientIp(request)}`, IP_LIMIT)) {
    console.log('[rate-limit] forgot-password throttled (ip)')
    return neutral()
  }

  const body = await request.json().catch(() => null)
  const parsed = forgotSchema.safeParse(body)
  if (!parsed.success) {
    return neutral()
  }
  const { email } = parsed.data

  // Per-email: slows reset-token/outbox spam even across rotating IPs.
  if (!rateLimit(`email:${email.toLowerCase()}`, EMAIL_LIMIT)) {
    console.log('[rate-limit] forgot-password throttled (email)')
    return neutral()
  }

  const user = await prisma.user.findUnique({ where: { email } })

  if (user) {
    const now = new Date()

    // Invalidate any older unused tokens for this user.
    await prisma.passwordResetToken.updateMany({
      where: { user_id: user.id, used_at: null },
      data: { used_at: now },
    })

    // 32-byte random token; only its sha256 is stored.
    const token = randomBytes(32).toString('hex')
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000) // now + 30 min

    await prisma.passwordResetToken.create({
      data: {
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
      },
    })

    const link = `${process.env.APP_URL ?? 'http://localhost:3000'}/auth/reset-password?token=${token}`

    await prisma.emailOutbox.create({
      data: {
        to: user.email,
        subject: 'Reset your password',
        body:
          `Hello,\n\n` +
          `Use the link below to reset your password (valid for 30 minutes):\n` +
          `${link}\n\n` +
          `If you did not request this, you can ignore this email.`,
      },
    })

    // No local mail delivery: surface the link on the server console.
    console.log(link)
  }

  // Always report the same success body so the response does not reveal
  // which emails exist (or that the request was throttled).
  return neutral()
}
