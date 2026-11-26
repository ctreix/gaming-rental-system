// White-box unit tests - pure helpers shared by several features
// Units: serializeUnit (lib/serialize.ts 21-32), fieldErrors (lib/validation.ts 4-11),
//        resetSchema (lib/validation.ts 92-95, server payload of A3)
// No test doubles: these units are pure, so real inputs are enough.
import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { serializeUnit } from '@/lib/serialize'
import { fieldErrors, resetSchema, resetFormSchema, registerSchema } from '@/lib/validation'

describe('serializeUnit', () => {
  it('TC-LIB-18: parses a JSON object in specifications', () => {
    // Arrange
    const unit = { id: 'u', specifications: '{"cpu":"i7","ram":32}' }
    // Act
    const out = serializeUnit(unit)
    // Assert
    expect(out).toEqual({ id: 'u', specifications: { cpu: 'i7', ram: 32 } })
  })

  it.each([['malformed JSON', '{oops'], ['JSON null', 'null'], ['a JSON string', '"text"'], ['a JSON number', '42']])(
    'TC-LIB-19: falls back to {} for %s',
    (_label, specifications) => {
      // Arrange
      const unit = { id: 'u', specifications }
      // Act
      const out = serializeUnit(unit)
      // Assert
      expect(out.specifications).toEqual({})
    }
  )
})

describe('fieldErrors', () => {
  it('TC-LIB-20: keeps only the first message per top-level field', () => {
    // Arrange: a password that is both too short and has no digit -> two issues on "password"
    const result = registerSchema.safeParse({
      full_name: 'Budi Santoso',
      email: 'budi@example.com',
      password: 'abc',
    })
    // Act
    const errors = fieldErrors((result as any).error)
    // Assert
    expect(Object.keys(errors)).toEqual(['password'])
    expect(errors.password).toBe('Password must be at least 8 characters')
  })

  it('TC-LIB-21: ignores issues without a field path (root-level error)', () => {
    // Arrange
    const result = z.string().safeParse(123)
    // Act
    const errors = fieldErrors((result as any).error)
    // Assert
    expect(errors).toEqual({})
  })
})

describe('resetSchema', () => {
  it('TC-LIB-22: accepts a token with a valid password', () => {
    // Arrange / Act
    const result = resetSchema.safeParse({ token: 't', password: 'Passw0rdOK' })
    // Assert
    expect(result.success).toBe(true)
  })

  it.each([
    ['missing token', { password: 'Passw0rdOK' }],
    ['empty token', { token: '', password: 'Passw0rdOK' }],
    ['weak password', { token: 't', password: 'short' }],
  ])('TC-LIB-23: rejects %s', (_label, body) => {
    // Arrange / Act
    const result = resetSchema.safeParse(body)
    // Assert
    expect(result.success).toBe(false)
  })
})

describe('resetFormSchema (client form, password confirmation)', () => {
  it('TC-LIB-24: accepts matching password and confirmation', () => {
    // Arrange / Act
    const result = resetFormSchema.safeParse({ token: 't', password: 'Passw0rdOK', confirm_password: 'Passw0rdOK' })
    // Assert
    expect(result.success).toBe(true)
  })

  it('TC-LIB-25: rejects a mismatch with the message on confirm_password', () => {
    // Arrange / Act
    const result = resetFormSchema.safeParse({ token: 't', password: 'Passw0rdOK', confirm_password: 'Different1' })
    // Assert
    expect(result.success).toBe(false)
    expect(fieldErrors((result as any).error)).toEqual({ confirm_password: 'Passwords do not match' })
  })
})
