'use client'

import { useEffect, useState, useCallback } from 'react'
import { Reservation, ReservationWithDetails, LockResult } from '@/types'
import { usePolling } from '@/hooks/usePolling'

// Replaces the legacy realtime subscriptions with 5-second polling.
const POLL_INTERVAL_MS = 5000

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url)
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(data?.error ?? 'Failed to fetch reservations')
  }
  return res.json()
}

// Own reservations, newest first (GET /api/reservations/mine).
export function useUserReservations() {
  const [reservations, setReservations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchReservations = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true)
    try {
      const data = (await fetchJson('/api/reservations/mine')) as any[]
      setReservations(data)
      setError(null)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to fetch reservations'
      )
      setReservations([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchReservations(true)
  }, [fetchReservations])

  usePolling(() => fetchReservations(), POLL_INTERVAL_MS)

  return { reservations, loading, error, refetch: fetchReservations }
}

// Alias kept for callers that use the shorter name.
export function useReservations() {
  const { reservations, loading, error, refetch } = useUserReservations()
  return {
    reservations: reservations as Reservation[],
    loading,
    error,
    refetch,
  }
}

// Every reservation (GET /api/admin/reservations, ADMIN only).
export function useAllReservations() {
  const [reservations, setReservations] = useState<ReservationWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchReservations = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true)
    try {
      const data = (await fetchJson(
        '/api/admin/reservations'
      )) as ReservationWithDetails[]
      setReservations(data)
      setError(null)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to fetch reservations'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchReservations(true)
  }, [fetchReservations])

  usePolling(() => fetchReservations(), POLL_INTERVAL_MS)

  return { reservations, loading, error, refetch: fetchReservations }
}

// 15-minute booking lock helpers.
export function useReservationLock() {
  const [locking, setLocking] = useState(false)

  // POST /api/locks
  const acquireLock = async (
    unitId: string,
    startTime: Date,
    endTime: Date
  ): Promise<LockResult | null> => {
    setLocking(true)
    try {
      const res = await fetch('/api/locks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unit_id: unitId,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
        }),
      })
      if (!res.ok) return null
      return (await res.json()) as LockResult
    } catch (err) {
      console.error('Failed to acquire lock:', err)
      return null
    } finally {
      setLocking(false)
    }
  }

  // DELETE /api/locks/[session_id]
  const releaseLock = async (sessionId: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/locks/${encodeURIComponent(sessionId)}`, {
        method: 'DELETE',
      })
      if (!res.ok) return false
      const data = (await res.json()) as { success: boolean }
      return data.success
    } catch (err) {
      console.error('Failed to release lock:', err)
      return false
    }
  }

  return { acquireLock, releaseLock, locking }
}
