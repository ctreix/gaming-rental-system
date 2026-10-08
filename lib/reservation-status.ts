// Reservation status transitions (pure, no I/O).
//
// This module is the single source of truth for which status changes are
// allowed and who may perform them. The API route and the UI both import it,
// so the buttons shown match exactly what the server will accept.

export type ReservationStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW'

export type PaymentStatus = 'PENDING' | 'PAID' | 'REFUNDED' | 'FAILED'

export const RESERVATION_STATUSES: ReservationStatus[] = [
  'PENDING',
  'CONFIRMED',
  'ACTIVE',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
]

export interface TransitionActor {
  role: 'CUSTOMER' | 'ADMIN'
  isOwner: boolean
}

// Side effects applied together with the status change.
export interface TransitionEffect {
  payment_status?: PaymentStatus
  // When true, the route fills payment_verified_at / payment_verified_by
  // (both columns exist in prisma/schema.prisma).
  verifyPayment?: boolean
}

export interface TransitionRule {
  // Only ADMIN may perform this transition.
  adminOnly: boolean
  // The owning CUSTOMER may perform this transition.
  allowOwnerCustomer: boolean
  effect?: TransitionEffect
}

// from -> to table. Any pair not listed here is rejected.
export const TRANSITIONS: Record<string, TransitionRule> = {
  // ADMIN confirms a pending booking; no payment-proof upload exists yet, so
  // confirming marks the payment as PAID and records who verified it.
  'PENDING->CONFIRMED': {
    adminOnly: true,
    allowOwnerCustomer: false,
    effect: { payment_status: 'PAID', verifyPayment: true },
  },
  // The owner can cancel their own pending request (or an admin can).
  'PENDING->CANCELLED': {
    adminOnly: false,
    allowOwnerCustomer: true,
  },
  'CONFIRMED->ACTIVE': {
    adminOnly: true,
    allowOwnerCustomer: false,
  },
  'ACTIVE->COMPLETED': {
    adminOnly: true,
    allowOwnerCustomer: false,
  },
  'CONFIRMED->NO_SHOW': {
    adminOnly: true,
    allowOwnerCustomer: false,
  },
  // Cancelling a confirmed booking refunds the payment.
  'CONFIRMED->CANCELLED': {
    adminOnly: true,
    allowOwnerCustomer: false,
    effect: { payment_status: 'REFUNDED' },
  },
}

export function transitionKey(
  from: ReservationStatus,
  to: ReservationStatus
): string {
  return `${from}->${to}`
}

export function getTransitionRule(
  from: ReservationStatus,
  to: ReservationStatus
): TransitionRule | undefined {
  return TRANSITIONS[transitionKey(from, to)]
}

// True when `actor` may change a reservation from `from` to `to`.
// ADMIN may perform any transition listed in the table; a CUSTOMER may only
// perform transitions explicitly opened to the owner (and only when they
// actually own the reservation).
export function canTransition(
  from: ReservationStatus,
  to: ReservationStatus,
  actor: TransitionActor
): boolean {
  const rule = TRANSITIONS[transitionKey(from, to)]
  if (!rule) return false
  if (actor.role === 'ADMIN') return true
  return rule.allowOwnerCustomer && actor.isOwner
}
