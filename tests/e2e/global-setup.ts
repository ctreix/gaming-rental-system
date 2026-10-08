import { execSync } from 'node:child_process'

// Idempotent: applies migrations (no-op if applied) and seeds demo accounts.
// Deliberately does not delete the database, because the dev webServer may
// already have it open.
export default async function globalSetup(): Promise<void> {
  const env = { ...process.env, DATABASE_URL: 'file:./test.db' }
  execSync('npx prisma migrate deploy', { env, stdio: 'inherit' })
  execSync('npx prisma db seed', { env, stdio: 'inherit' })
}
