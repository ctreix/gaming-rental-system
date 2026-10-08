import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import path from 'node:path'

// Talk to the same E2E test database the server uses.
const prisma = new PrismaClient({
  datasources: { db: { url: `file:${path.resolve('prisma/test.db')}` } },
})

test.beforeAll(async () => {
  // Start from a clean slate for this user so the list shows exactly the
  // reservation this test creates (the API suite may have left rows behind).
  const user = await prisma.user.findUnique({
    where: { email: 'customer@gamerent.local' },
  })
  if (user) {
    await prisma.reservation.deleteMany({ where: { user_id: user.id } })
  }
})

test.afterAll(async () => {
  await prisma.$disconnect()
})

// Build a local YYYY-MM-DD for "today + daysAhead".
function futureDate(daysAhead: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysAhead)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

test('customer books two consecutive slots and cancels the reservation', async ({ page }) => {
  await page.goto('/auth/login')
  await page.getByLabel('Email').fill('customer@gamerent.local')
  await page.getByLabel('Password').fill('Customer12345')
  await page.getByRole('button', { name: 'Sign In' }).click()
  await page.waitForURL('**/customer')

  // Open the first available unit.
  await page.getByRole('button', { name: 'Book Now' }).first().click()
  await page.waitForURL('**/customer/book/**')

  // Pick tomorrow.
  await page.locator('input[type="date"]').fill(futureDate(1))

  // Wait for the slot buttons, then choose the first two consecutive hours.
  const slotButtons = page.getByRole('button').filter({ hasText: /^\d{1,2}:00$/ })
  await expect(slotButtons.first()).toBeVisible()
  const hours = (await slotButtons.allTextContents())
    .map((t) => Number.parseInt(t, 10))
    .sort((a, b) => a - b)

  let startHour = -1
  for (let i = 0; i < hours.length - 1; i++) {
    if (hours[i + 1] === hours[i] + 1) {
      startHour = hours[i]
      break
    }
  }
  expect(startHour).toBeGreaterThanOrEqual(0)

  await page.getByRole('button', { name: `${startHour}:00`, exact: true }).click()
  await page.getByRole('button', { name: `${startHour + 1}:00`, exact: true }).click()

  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByText('Booking Summary')).toBeVisible()

  await page.getByRole('button', { name: 'Confirm Booking' }).click()
  await page.waitForURL('**/customer/reservations')
  await expect(page.getByText('pending', { exact: true })).toHaveCount(1)

  // Cancel it: accept the window.confirm() dialog, then expect the status.
  page.on('dialog', (dialog) => dialog.accept())
  await page.getByTestId('cancel-reservation').click()
  await expect(page.getByText('cancelled', { exact: true })).toBeVisible()
})
