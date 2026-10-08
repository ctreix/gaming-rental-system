'use client'

import { useEffect, useState } from 'react'

// Mirrors the `user` object returned by GET /api/auth/me.
export interface AuthUser {
  id: string
  email: string
  full_name: string | null
  phone_number: string | null
  role: string
}

/**
 * Loads the signed-in user (or null). Keeps the legacy `useUser()` name and
 * `{ user, loading }` return shape so pages needed no other changes.
 */
export function useUser() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const res = await fetch('/api/auth/me')
        const data = res.ok ? await res.json() : { user: null }
        if (!cancelled) setUser(data.user ?? null)
      } catch {
        if (!cancelled) setUser(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [])

  return { user, loading }
}

/**
 * Clears the session cookie via POST /api/auth/logout and returns to the
 * landing page. Used by every logout button (customer, reservations, admin).
 */
export async function logout(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST' })
  } catch {
    // ignore network errors - the cookie expires server-side anyway
  }
  window.location.assign('/')
}
