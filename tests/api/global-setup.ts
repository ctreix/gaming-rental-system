import { execSync, spawn, type ChildProcess } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import path from 'node:path'

// The API suite runs against a throwaway SQLite copy (prisma/test.db).
const PORT = 3210
const DB_URL = 'file:./test.db'

let server: ChildProcess | undefined

async function waitFor(url: string, timeoutMs = 120_000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.status < 500) return
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error(`Timed out waiting for ${url}`)
}

export async function setup(): Promise<void> {
  // Fresh database for every run (this file is a disposable test copy).
  const dbPath = path.resolve('prisma/test.db')
  for (const file of [dbPath, `${dbPath}-journal`]) {
    if (existsSync(file)) rmSync(file)
  }

  const env = { ...process.env, DATABASE_URL: DB_URL }
  execSync('npx prisma migrate deploy', { env, stdio: 'inherit' })
  execSync('npx prisma db seed', { env, stdio: 'inherit' })

  server = spawn('npx', ['next', 'dev', '-p', String(PORT)], {
    env: {
      ...env,
      AUTH_SECRET: process.env.AUTH_SECRET ?? 'test-secret-for-vitest',
      APP_URL: `http://localhost:${PORT}`,
    },
    stdio: 'inherit',
    shell: true,
  })

  await waitFor(`http://localhost:${PORT}/api/units`)
}

export async function teardown(): Promise<void> {
  if (!server?.pid) return
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /PID ${server.pid} /T /F`, { stdio: 'ignore' })
    } else {
      server.kill('SIGKILL')
    }
  } catch {
    // best effort
  }
}
