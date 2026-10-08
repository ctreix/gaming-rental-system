import { describe, it, expect } from 'vitest'
import {
  fullNameSchema,
  emailSchema,
  phoneSchema,
  passwordSchema,
  registerSchema,
  loginSchema,
  forgotSchema,
  resetFormSchema,
} from '@/lib/validation'

describe('fullNameSchema (BVA 1/2/100/101)', () => {
  it('rejects 1 character', () => {
    expect(fullNameSchema.safeParse('A').success).toBe(false)
  })
  it('accepts 2 characters', () => {
    expect(fullNameSchema.safeParse('Ab').success).toBe(true)
  })
  it('accepts 100 characters', () => {
    expect(fullNameSchema.safeParse('a'.repeat(100)).success).toBe(true)
  })
  it('rejects 101 characters', () => {
    expect(fullNameSchema.safeParse('a'.repeat(101)).success).toBe(false)
  })
})

describe('passwordSchema (BVA 7/8/72/73 + EP)', () => {
  it('rejects 7 characters', () => {
    expect(passwordSchema.safeParse('Abc1234').success).toBe(false)
  })
  it('accepts 8 characters', () => {
    expect(passwordSchema.safeParse('Abc12345').success).toBe(true)
  })
  it('accepts 72 characters', () => {
    expect(passwordSchema.safeParse('a1'.repeat(36)).success).toBe(true)
  })
  it('rejects 73 characters', () => {
    expect(passwordSchema.safeParse('a1'.repeat(36) + 'a').success).toBe(false)
  })
  it('rejects a password with no digit', () => {
    const r = passwordSchema.safeParse('abcdefgh')
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.map((i) => i.message)).toContain(
        'Password must contain at least one digit'
      )
    }
  })
  it('rejects a password with no letter', () => {
    expect(passwordSchema.safeParse('12345678').success).toBe(false)
  })
})

describe('phoneSchema (optional, BVA 20/21)', () => {
  it('defaults to empty string when omitted', () => {
    const r = phoneSchema.safeParse(undefined)
    expect(r.success).toBe(true)
    if (r.success) expect(r.data).toBe('')
  })
  it('accepts 20 characters', () => {
    expect(phoneSchema.safeParse('1'.repeat(20)).success).toBe(true)
  })
  it('rejects 21 characters', () => {
    expect(phoneSchema.safeParse('1'.repeat(21)).success).toBe(false)
  })
})

describe('emailSchema (BVA 254/255)', () => {
  it('accepts a normal address', () => {
    expect(emailSchema.safeParse('user@example.com').success).toBe(true)
  })
  it('accepts 254 characters', () => {
    const email = 'a'.repeat(242) + '@example.com'
    expect(email.length).toBe(254)
    expect(emailSchema.safeParse(email).success).toBe(true)
  })
  it('rejects 255 characters', () => {
    const email = 'a'.repeat(243) + '@example.com'
    expect(email.length).toBe(255)
    expect(emailSchema.safeParse(email).success).toBe(false)
  })
  it('rejects a malformed address', () => {
    expect(emailSchema.safeParse('not-an-email').success).toBe(false)
  })
})

describe('registerSchema / loginSchema / forgotSchema', () => {
  it('accepts a valid registration payload', () => {
    const r = registerSchema.safeParse({
      full_name: 'Demo User',
      email: 'demo@example.com',
      phone_number: '+62812',
      password: 'Password123',
    })
    expect(r.success).toBe(true)
  })

  it('strips an unexpected role key', () => {
    const r = registerSchema.safeParse({
      full_name: 'Demo User',
      email: 'demo@example.com',
      password: 'Password123',
      role: 'ADMIN',
    })
    expect(r.success).toBe(true)
    if (r.success) expect('role' in r.data).toBe(false)
  })

  it('login keeps password min length 1 (does not leak rules)', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(true)
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false)
  })

  it('forgot requires a valid email', () => {
    expect(forgotSchema.safeParse({ email: 'bad' }).success).toBe(false)
  })
})

describe('resetFormSchema confirms the password', () => {
  it('accepts matching passwords', () => {
    const r = resetFormSchema.safeParse({
      token: 'tok',
      password: 'Password123',
      confirm_password: 'Password123',
    })
    expect(r.success).toBe(true)
  })

  it('rejects a mismatch on the confirm field', () => {
    const r = resetFormSchema.safeParse({
      token: 'tok',
      password: 'Password123',
      confirm_password: 'Different123',
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0].path[0]).toBe('confirm_password')
      expect(r.error.issues[0].message).toBe('Passwords do not match')
    }
  })

  it('rejects a missing token', () => {
    const r = resetFormSchema.safeParse({
      token: '',
      password: 'Password123',
      confirm_password: 'Password123',
    })
    expect(r.success).toBe(false)
  })
})
