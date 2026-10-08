import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import path from 'node:path'

// Read the local outbox directly from the E2E test database.
const prisma = new PrismaClient({
  datasources: { db: { url: `file:${path.resolve('prisma/test.db')}` } },
})

test.afterAll(async () => {
  await prisma.$disconnect()
})

test('wrong password shows a generic error', async ({ page }) => {
  await page.goto('/auth/login')
  await page.getByLabel('Email').fill('customer@gamerent.local')
  await page.getByLabel('Password').fill('WrongPassword1')
  await page.getByRole('button', { name: 'Sign In' }).click()

  await expect(page.getByText('Invalid email or password')).toBeVisible()
})

test('invalid register shows inline field errors', async ({ page }) => {
  await page.goto('/auth/register')
  // "A" violates the 2-char minimum (no native constraint blocks it).
  await page.getByLabel('Full Name').fill('A')
  await page.getByLabel('Email').fill(`inline.${Date.now()}@example.com`)
  // 8 chars passes the native minLength but has no digit -> zod rejects it.
  await page.getByLabel('Password').fill('abcdefgh')
  await page.getByRole('button', { name: 'Create Account' }).click()

  await expect(page.getByText('Full name must be at least 2 characters')).toBeVisible()
  await expect(page.getByText('Password must contain at least one digit')).toBeVisible()
})

test('forgot password shows the neutral message, then the link resets the password', async ({
  page,
  request,
}) => {
  const email = `reset.${Date.now()}@example.com`
  const registered = await request.post('/api/auth/register', {
    data: {
      full_name: 'Reset User',
      email,
      password: 'Password123',
    },
  })
  expect(registered.status()).toBe(200)

  await page.goto('/auth/forgot-password')
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Send Reset Link' }).click()
  await expect(
    page.getByText('If an account exists for this email, a reset link has been generated.')
  ).toBeVisible()

  // Read the reset link from the local EmailOutbox table.
  const message = await prisma.emailOutbox.findFirst({
    where: { to: email },
    orderBy: { created_at: 'desc' },
  })
  expect(message).not.toBeNull()
  const token = message!.body.match(/reset-password\?token=([a-f0-9]+)/)?.[1]
  expect(token).toBeTruthy()

  await page.goto(`/auth/reset-password?token=${token}`)
  await page.getByLabel('New Password').fill('NewPassword123')
  await page.getByLabel('Confirm Password').fill('NewPassword123')
  await page.getByRole('button', { name: 'Update Password' }).click()
  await page.waitForURL('**/auth/login')

  // Log in with the new password.
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('NewPassword123')
  await page.getByRole('button', { name: 'Sign In' }).click()
  await page.waitForURL('**/customer')
})
