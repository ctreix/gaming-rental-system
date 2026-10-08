'use client'

import { useEffect, useState, useCallback } from 'react'
import { Unit, UnitType } from '@/types'
import { usePolling } from '@/hooks/usePolling'

// Replaces the legacy realtime subscriptions with 5-second polling.
const POLL_INTERVAL_MS = 5000

export function useUnits(type?: UnitType) {
  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchUnits = useCallback(
    async (showLoading = false) => {
      if (showLoading) setLoading(true)
      try {
        const res = await fetch(type ? `/api/units?type=${type}` : '/api/units')
        if (!res.ok) throw new Error('Failed to fetch units')
        const data: Unit[] = await res.json()
        setUnits(data)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch units')
      } finally {
        setLoading(false)
      }
    },
    [type]
  )

  useEffect(() => {
    fetchUnits(true)
  }, [fetchUnits])

  usePolling(() => fetchUnits(), POLL_INTERVAL_MS)

  return { units, loading, error, refetch: fetchUnits }
}

export function useUnit(id: string) {
  const [unit, setUnit] = useState<Unit | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchUnit = useCallback(async () => {
    if (!id) return
    try {
      const res = await fetch(`/api/units/${id}`)
      if (res.status === 404) {
        setUnit(null)
        setError(null)
        return
      }
      if (!res.ok) throw new Error('Failed to fetch unit')
      const data: Unit = await res.json()
      setUnit(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch unit')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchUnit()
  }, [fetchUnit])

  usePolling(() => fetchUnit(), POLL_INTERVAL_MS)

  return { unit, loading, error }
}

export function useUnitAvailability(unitId: string, date: Date) {
  const [availability, setAvailability] = useState<{
    slots: { start: Date; end: Date; available: boolean }[]
    loading: boolean
    error: string | null
  }>({ slots: [], loading: true, error: null })

  const checkAvailability = useCallback(async () => {
    if (!unitId) return
    try {
      const y = date.getFullYear()
      const m = String(date.getMonth() + 1).padStart(2, '0')
      const d = String(date.getDate()).padStart(2, '0')
      const dateStr = `${y}-${m}-${d}`

      const res = await fetch(
        `/api/units/${unitId}/availability?date=${dateStr}`
      )
      if (!res.ok) throw new Error('Failed to check availability')
      const data: { start: string; end: string; available: boolean }[] =
        await res.json()

      // The API returns one entry per hour (08:00-23:00 WIB) with overlap,
      // lock and already-started rules already applied server-side.
      const slots = Array.isArray(data)
        ? data.map((slot) => ({
            start: new Date(slot.start),
            end: new Date(slot.end),
            available: slot.available,
          }))
        : []

      setAvailability({ slots, loading: false, error: null })
    } catch (err) {
      setAvailability((prev) => ({
        slots: prev.slots,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to check availability',
      }))
    }
  }, [unitId, date])

  useEffect(() => {
    checkAvailability()
  }, [checkAvailability])

  usePolling(() => checkAvailability(), POLL_INTERVAL_MS)

  return availability
}
