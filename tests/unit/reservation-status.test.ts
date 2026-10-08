import { describe, it, expect } from 'vitest'
import {
  canTransition,
  getTransitionRule,
  type ReservationStatus,
  type TransitionActor,
} from '@/lib/reservation-status'

const admin: TransitionActor = { role: 'ADMIN', isOwner: false }
const owner: TransitionActor = { role: 'CUSTOMER', isOwner: true }
const other: TransitionActor = { role: 'CUSTOMER', isOwner: false }

describe('allowed transitions', () => {
  it('ADMIN: PENDING -> CONFIRMED', () => {
    expect(canTransition('PENDING', 'CONFIRMED', admin)).toBe(true)
  })
  it('owner CUSTOMER: PENDING -> CANCELLED', () => {
    expect(canTransition('PENDING', 'CANCELLED', owner)).toBe(true)
  })
  it('ADMIN: PENDING -> CANCELLED', () => {
    expect(canTransition('PENDING', 'CANCELLED', admin)).toBe(true)
  })
  it('ADMIN: CONFIRMED -> ACTIVE', () => {
    expect(canTransition('CONFIRMED', 'ACTIVE', admin)).toBe(true)
  })
  it('ADMIN: ACTIVE -> COMPLETED', () => {
    expect(canTransition('ACTIVE', 'COMPLETED', admin)).toBe(true)
  })
  it('ADMIN: CONFIRMED -> NO_SHOW', () => {
    expect(canTransition('CONFIRMED', 'NO_SHOW', admin)).toBe(true)
  })
  it('ADMIN: CONFIRMED -> CANCELLED', () => {
    expect(canTransition('CONFIRMED', 'CANCELLED', admin)).toBe(true)
  })
})

describe('rejected transitions', () => {
  it('CUSTOMER cannot PENDING -> CONFIRMED (admin only)', () => {
    expect(canTransition('PENDING', 'CONFIRMED', owner)).toBe(false)
  })
  it('non-owner CUSTOMER cannot PENDING -> CANCELLED', () => {
    expect(canTransition('PENDING', 'CANCELLED', other)).toBe(false)
  })
  it('CUSTOMER cannot CONFIRMED -> CANCELLED (admin only)', () => {
    expect(canTransition('CONFIRMED', 'CANCELLED', owner)).toBe(false)
  })
  it('PENDING -> ACTIVE is not in the table', () => {
    expect(canTransition('PENDING', 'ACTIVE', admin)).toBe(false)
  })
  it('PENDING -> COMPLETED is not in the table', () => {
    expect(canTransition('PENDING', 'COMPLETED', admin)).toBe(false)
  })
  it('CONFIRMED -> PENDING is not in the table', () => {
    expect(canTransition('CONFIRMED', 'PENDING', admin)).toBe(false)
  })
  it('COMPLETED -> ACTIVE is not in the table', () => {
    expect(canTransition('COMPLETED', 'ACTIVE', admin)).toBe(false)
  })
  it('CANCELLED -> PENDING is not in the table', () => {
    expect(canTransition('CANCELLED', 'PENDING', admin)).toBe(false)
  })
  it('NO_SHOW -> CONFIRMED is not in the table', () => {
    expect(canTransition('NO_SHOW', 'CONFIRMED', admin)).toBe(false)
  })
  it('ACTIVE -> CANCELLED is not in the table', () => {
    expect(canTransition('ACTIVE', 'CANCELLED', admin)).toBe(false)
  })
})

describe('transition side effects', () => {
  it('PENDING -> CONFIRMED marks the payment PAID and verifies it', () => {
    const rule = getTransitionRule('PENDING', 'CONFIRMED')
    expect(rule?.effect?.payment_status).toBe('PAID')
    expect(rule?.effect?.verifyPayment).toBe(true)
  })
  it('CONFIRMED -> CANCELLED refunds the payment', () => {
    const rule = getTransitionRule('CONFIRMED', 'CANCELLED')
    expect(rule?.effect?.payment_status).toBe('REFUNDED')
  })
  it('PENDING -> CANCELLED has no payment side effect', () => {
    const rule = getTransitionRule('PENDING', 'CANCELLED')
    expect(rule?.effect).toBeUndefined()
  })
  it('getTransitionRule returns undefined for unknown pairs', () => {
    const from: ReservationStatus = 'COMPLETED'
    const to: ReservationStatus = 'ACTIVE'
    expect(getTransitionRule(from, to)).toBeUndefined()
  })
})
