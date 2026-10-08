import { describe, it, expect } from 'vitest'
import { areSlotsContiguous, maskUsername, calculateDurationHours } from '@/lib/utils'

// Local-time hour helper so tests are timezone-independent.
const hour = (h: number) => new Date(2026, 0, 1, h, 0, 0, 0)

describe('areSlotsContiguous (Step 2)', () => {
  it('is true for an empty selection', () => {
    expect(areSlotsContiguous([])).toBe(true)
  })

  it('is true for a single slot', () => {
    expect(areSlotsContiguous([hour(10)])).toBe(true)
  })

  it('is true for consecutive hours', () => {
    expect(areSlotsContiguous([hour(10), hour(11), hour(12)])).toBe(true)
  })

  it('is true for consecutive hours given out of order', () => {
    expect(areSlotsContiguous([hour(12), hour(10), hour(11)])).toBe(true)
  })

  it('is false when there is a gap', () => {
    expect(areSlotsContiguous([hour(10), hour(12)])).toBe(false)
  })

  it('is false when slots are 30 minutes apart', () => {
    const a = new Date(2026, 0, 1, 10, 0)
    const b = new Date(2026, 0, 1, 10, 30)
    expect(areSlotsContiguous([a, b])).toBe(false)
  })
})

describe('maskUsername', () => {
  it('keeps first and last character and masks the rest', () => {
    expect(maskUsername('Christopher')).toBe('C' + '*'.repeat(9) + 'r')
  })

  it('masks a two-word name', () => {
    expect(maskUsername('Alice Smith')).toBe('A' + '*'.repeat(9) + 'h')
  })

  it('returns *** for short names', () => {
    expect(maskUsername('Al')).toBe('***')
  })

  it('returns *** for null/undefined', () => {
    expect(maskUsername(null)).toBe('***')
    expect(maskUsername(undefined)).toBe('***')
  })
})

describe('calculateDurationHours', () => {
  it('rounds whole hours', () => {
    expect(calculateDurationHours(hour(10), hour(12))).toBe(2)
  })

  it('rounds up partial hours', () => {
    const end = new Date(2026, 0, 1, 11, 30)
    expect(calculateDurationHours(hour(10), end)).toBe(2)
  })
})
