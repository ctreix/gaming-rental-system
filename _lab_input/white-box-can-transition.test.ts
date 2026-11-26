// White-box unit tests: canTransition (lib/reservation-status.ts, lines 99-108)
// Pre-Lab design: TC-C1..TC-C4 -> 6/6 statements, 6/6 branches.
import { describe, it, expect } from 'vitest'
import {
  canTransition,
  type TransitionActor,
} from '@/lib/reservation-status'

// Test data (plain values; canTransition has no dependencies, so no test double is needed here).
const admin: TransitionActor = { role: 'ADMIN', isOwner: false }
const owner: TransitionActor = { role: 'CUSTOMER', isOwner: true }
const stranger: TransitionActor = { role: 'CUSTOMER', isOwner: false }

describe('canTransition', () => {
  it('TC-F5-C1: rejects a transition that is not in the table (even for ADMIN)', () => {
    // Arrange
    const from = 'PENDING'
    const to = 'ACTIVE'
    // Act
    const result = canTransition(from, to, admin)
    // Assert
    expect(result).toBe(false)
  })

  it('TC-F5-C2: allows ADMIN to perform a listed transition', () => {
    // Arrange
    const from = 'PENDING'
    const to = 'CONFIRMED'
    // Act
    const result = canTransition(from, to, admin)
    // Assert
    expect(result).toBe(true)
  })

  it('TC-F5-C3: allows the owning CUSTOMER to cancel a PENDING reservation', () => {
    // Arrange
    const from = 'PENDING'
    const to = 'CANCELLED'
    // Act
    const result = canTransition(from, to, owner)
    // Assert
    expect(result).toBe(true)
  })

  it('TC-F5-C4: rejects a CUSTOMER on a transition not opened to owners', () => {
    // Arrange
    const from = 'CONFIRMED'
    const to = 'ACTIVE'
    // Act
    const result = canTransition(from, to, owner)
    // Assert
    expect(result).toBe(false)
  })

  it('extra: rejects a non-owner CUSTOMER even on an owner-allowed transition', () => {
    // Arrange
    const from = 'PENDING'
    const to = 'CANCELLED'
    // Act
    const result = canTransition(from, to, stranger)
    // Assert
    expect(result).toBe(false)
  })
})
