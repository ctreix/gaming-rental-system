'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { Reservation, ReservationWithDetails } from '@/types'

export function useReservations() {
  const supabase = createClient()
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchReservations = useCallback(async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        setReservations([])
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .eq('user_id', user.id)
        .order('start_time', { ascending: false })

      if (error) throw error
      setReservations(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch reservations')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchReservations()

    const channel = supabase
      .channel('user-reservations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setReservations((prev) => [payload.new as Reservation, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setReservations((prev) =>
              prev.map((res) =>
                res.id === payload.new.id ? (payload.new as Reservation) : res
              )
            )
          } else if (payload.eventType === 'DELETE') {
            setReservations((prev) =>
              prev.filter((res) => res.id !== payload.old.id)
            )
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, fetchReservations])

  return { reservations, loading, error, refetch: fetchReservations }
}

export function useAllReservations() {
  const supabase = createClient()
  const [reservations, setReservations] = useState<ReservationWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchReservations = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('reservations')
        .select(`
          *,
          unit:units(*),
          user:profiles(*)
        `)
        .order('start_time', { ascending: false })

      if (error) throw error
      setReservations(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch reservations')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchReservations()

    const channel = supabase
      .channel('all-reservations')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservations' },
        () => {
          fetchReservations()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, fetchReservations])

  return { reservations, loading, error, refetch: fetchReservations }
}

export function useReservationLock() {
  const supabase = createClient()
  const [locking, setLocking] = useState(false)

  const acquireLock = async (
    unitId: string,
    startTime: Date,
    endTime: Date,
    durationMinutes: number = 15
  ) => {
    setLocking(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase.rpc('acquire_unit_lock', {
        p_unit_id: unitId,
        p_user_id: user.id,
        p_start_time: startTime.toISOString(),
        p_end_time: endTime.toISOString(),
        p_duration_minutes: durationMinutes,
      })

      if (error) throw error
      return data
    } finally {
      setLocking(false)
    }
  }

  const releaseLock = async (sessionId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase.rpc('release_unit_lock', {
        p_session_id: sessionId,
        p_user_id: user.id,
      })

      if (error) throw error
      return data
    } catch (err) {
      console.error('Failed to release lock:', err)
      return false
    }
  }

  return { acquireLock, releaseLock, locking }
}
