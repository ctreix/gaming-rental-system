'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { Unit, UnitType, UnitStatus } from '@/types'

export function useUnits(type?: UnitType) {
  const supabase = createClient()
  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchUnits = useCallback(async () => {
    try {
      setLoading(true)
      let query = supabase.from('units').select('*').order('name')
      
      if (type) {
        query = query.eq('type', type)
      }

      const { data, error } = await query

      if (error) throw error
      setUnits(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch units')
    } finally {
      setLoading(false)
    }
  }, [supabase, type])

  useEffect(() => {
    fetchUnits()

    // Subscribe to real-time changes
    const channel = supabase
      .channel('units-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'units' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setUnits((prev) => [...prev, payload.new as Unit])
          } else if (payload.eventType === 'UPDATE') {
            setUnits((prev) =>
              prev.map((unit) =>
                unit.id === payload.new.id ? (payload.new as Unit) : unit
              )
            )
          } else if (payload.eventType === 'DELETE') {
            setUnits((prev) =>
              prev.filter((unit) => unit.id !== payload.old.id)
            )
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, fetchUnits])

  return { units, loading, error, refetch: fetchUnits }
}

export function useUnit(id: string) {
  const supabase = createClient()
  const [unit, setUnit] = useState<Unit | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchUnit = async () => {
      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('units')
          .select('*')
          .eq('id', id)
          .single()

        if (error) throw error
        setUnit(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch unit')
      } finally {
        setLoading(false)
      }
    }

    if (id) {
      fetchUnit()
    }

    // Subscribe to real-time changes for this unit
    const channel = supabase
      .channel(`unit-${id}-changes`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'units',
          filter: `id=eq.${id}`,
        },
        (payload) => {
          setUnit(payload.new as Unit)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, id])

  return { unit, loading, error }
}

export function useUnitAvailability(unitId: string, date: Date) {
  const supabase = createClient()
  const [availability, setAvailability] = useState<{
    slots: { start: Date; end: Date; available: boolean }[]
    loading: boolean
    error: string | null
  }>({ slots: [], loading: true, error: null })

  useEffect(() => {
    const checkAvailability = async () => {
      try {
        const startOfDay = new Date(date)
        startOfDay.setHours(0, 0, 0, 0)
        
        const endOfDay = new Date(date)
        endOfDay.setHours(23, 59, 59, 999)

        // Get all reservations for this unit on this date
        const reservationsResult = await supabase
          .from('reservations')
          .select('*')
          .eq('unit_id', unitId)
          .in('status', ['CONFIRMED', 'ACTIVE'])
          .gte('start_time', startOfDay.toISOString())
          .lte('start_time', endOfDay.toISOString())

        if (reservationsResult.error) throw reservationsResult.error
        const reservations = reservationsResult.data as Array<{ start_time: string; end_time: string }> | null

        // Get all active locks for this unit
        const locksResult = await supabase
          .from('reservation_locks')
          .select('*')
          .eq('unit_id', unitId)
          .gt('expires_at', new Date().toISOString())

        if (locksResult.error) throw locksResult.error
        const locks = locksResult.data as Array<{ start_time: string; end_time: string }> | null

        // Generate time slots (8 AM to 12 AM, 1 hour intervals)
        const slots = []
        for (let hour = 8; hour < 24; hour++) {
          const slotStart = new Date(date)
          slotStart.setHours(hour, 0, 0, 0)
          
          const slotEnd = new Date(date)
          slotEnd.setHours(hour + 1, 0, 0, 0)

          // Check if slot conflicts with any reservation
          const isBooked = reservations?.some(
            (res) =>
              new Date(res.start_time) < slotEnd &&
              new Date(res.end_time) > slotStart
          )

          // Check if slot is locked
          const isLocked = locks?.some(
            (lock) =>
              new Date(lock.start_time) < slotEnd &&
              new Date(lock.end_time) > slotStart
          )

          slots.push({
            start: slotStart,
            end: slotEnd,
            available: !isBooked && !isLocked,
          })
        }

        setAvailability({ slots, loading: false, error: null })
      } catch (err) {
        setAvailability({
          slots: [],
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to check availability',
        })
      }
    }

    checkAvailability()

    // Subscribe to real-time changes
    const channel = supabase
      .channel(`availability-${unitId}-${date.toISOString()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations',
          filter: `unit_id=eq.${unitId}`,
        },
        () => {
          checkAvailability()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservation_locks',
          filter: `unit_id=eq.${unitId}`,
        },
        () => {
          checkAvailability()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, unitId, date])

  return availability
}
