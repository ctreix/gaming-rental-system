'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useUnit } from '@/hooks/useUnits'
import { useReservationLock } from '@/hooks/useReservations'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  ArrowLeft, 
  Clock, 
  Calendar, 
  Monitor, 
  Gamepad2, 
  Users,
  AlertCircle,
  CheckCircle,
  Upload
} from 'lucide-react'
import Link from 'next/link'
import { formatCurrency, formatDate, calculateDurationHours } from '@/lib/utils'
import { toast } from 'sonner'

export default function BookingPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const { unit, loading: unitLoading } = useUnit(params.id as string)
  const { acquireLock, releaseLock, locking } = useReservationLock()
  
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [selectedSlots, setSelectedSlots] = useState<Date[]>([])
  const [availableSlots, setAvailableSlots] = useState<Date[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<'select' | 'confirm' | 'payment'>('select')
  const [paymentFile, setPaymentFile] = useState<File | null>(null)

  useEffect(() => {
    if (!unit) return
    
    const fetchAvailability = async () => {
      const startOfDay = new Date(selectedDate)
      startOfDay.setHours(0, 0, 0, 0)
      
      const endOfDay = new Date(selectedDate)
      endOfDay.setHours(23, 59, 59, 999)

      const { data: reservations } = await supabase
        .from('reservations')
        .select('*')
        .eq('unit_id', unit.id)
        .in('status', ['CONFIRMED', 'ACTIVE'])
        .gte('start_time', startOfDay.toISOString())
        .lte('start_time', endOfDay.toISOString()) as { data: Array<{ start_time: string; end_time: string }> | null }

      const { data: locks } = await supabase
        .from('reservation_locks')
        .select('*')
        .eq('unit_id', unit.id)
        .gt('expires_at', new Date().toISOString()) as { data: Array<{ start_time: string; end_time: string }> | null }

      const slots: Date[] = []
      for (let hour = 8; hour < 24; hour++) {
        const slotStart = new Date(selectedDate)
        slotStart.setHours(hour, 0, 0, 0)
        
        const slotEnd = new Date(selectedDate)
        slotEnd.setHours(hour + 1, 0, 0, 0)

        const isBooked = reservations?.some(
          (res) =>
            new Date(res.start_time) < slotEnd &&
            new Date(res.end_time) > slotStart
        )

        const isLocked = locks?.some(
          (lock) =>
            new Date(lock.start_time) < slotEnd &&
            new Date(lock.end_time) > slotStart
        )

        if (!isBooked && !isLocked) {
          slots.push(slotStart)
        }
      }
      
      setAvailableSlots(slots)
    }

    fetchAvailability()
  }, [unit, selectedDate, supabase])

  const handleSlotToggle = (slot: Date) => {
    setSelectedSlots(prev => {
      const exists = prev.find(s => s.getTime() === slot.getTime())
      if (exists) {
        return prev.filter(s => s.getTime() !== slot.getTime())
      }
      return [...prev, slot].sort((a, b) => a.getTime() - b.getTime())
    })
  }

  const handleContinue = async () => {
    if (selectedSlots.length === 0) return
    
    console.log('handleContinue called')
    setLoading(true)
    setError(null)

    const startTime = selectedSlots[0]
    const endTime = new Date(selectedSlots[selectedSlots.length - 1])
    endTime.setHours(endTime.getHours() + 1)
    
    console.log('Acquiring lock...', { unitId: unit!.id, startTime, endTime })

    const result = await acquireLock(unit!.id, startTime, endTime)
    console.log('Lock result:', result)

    if (!result || !result.success) {
      console.error('Lock failed:', result?.message || 'Unknown error')
      toast.error(result?.message || 'Failed to lock time slot')
      setError(result?.message || 'Failed to lock time slot')
      setLoading(false)
      return
    }

    setSessionId(result.session_id)
    setStep('confirm')
    setLoading(false)
    console.log('Step changed to confirm')
  }

  const handleConfirm = async () => {
    if (!unit || selectedSlots.length === 0) return

    setLoading(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Please sign in to continue')
      setLoading(false)
      return
    }

    const startTime = selectedSlots[0]
    const endTime = new Date(selectedSlots[selectedSlots.length - 1])
    endTime.setHours(endTime.getHours() + 1)

    const totalHours = selectedSlots.length
    const totalAmount = unit.hourly_rate * totalHours

    console.log('Creating reservation...', { user_id: user.id, unit_id: unit.id })

    const { data: reservation, error: createError } = await supabase
      .from('reservations')
      .insert({
        user_id: user.id,
        unit_id: unit.id,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        hourly_rate: unit.hourly_rate,
        total_hours: totalHours,
        total_amount: totalAmount,
        status: 'PENDING',
        payment_status: 'PENDING',
      } as any)
      .select()
      .single()

    console.log('Reservation result:', { reservation, createError })

    // Always release lock, even on error
    if (sessionId) {
      await releaseLock(sessionId)
    }

    if (createError) {
      console.error('Reservation creation failed:', createError)
      toast.error(`Booking failed: ${createError.message}`)
      setError(createError.message)
      setLoading(false)
      return
    }

    if (!reservation) {
      toast.error('Booking failed: No reservation data returned')
      setLoading(false)
      return
    }

    console.log('Reservation created successfully:', reservation)
    toast.success('Booking confirmed!')
    router.push('/customer/reservations')
  }

  const unitTypeIcon = unit?.type === 'PC' ? <Monitor className="h-5 w-5" /> :
                      unit?.type === 'PS5' ? <Gamepad2 className="h-5 w-5" /> :
                      <Users className="h-5 w-5" />

  if (unitLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-cyan-400">Loading...</div>
      </div>
    )
  }

  if (!unit) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-400">Unit not found</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <Link href="/customer">
          <Button variant="outline" className="mb-6 border-cyan-500/50 text-cyan-400">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Stations
          </Button>
        </Link>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Unit Info */}
          <Card className="md:col-span-1 bg-gaming-card border-cyan-500/20">
            <CardHeader>
              <div className={`inline-flex p-2 rounded-lg mb-3 ${
                unit.type === 'PC' ? 'bg-blue-500/20 text-blue-400' :
                unit.type === 'PS5' ? 'bg-purple-500/20 text-purple-400' :
                'bg-pink-500/20 text-pink-400'
              }`}>
                {unitTypeIcon}
              </div>
              <CardTitle className="text-white">{unit.name}</CardTitle>
              <p className="text-gray-400 text-sm">{unit.type} Gaming Station</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-2xl font-bold text-cyan-400">
                {formatCurrency(unit.hourly_rate)}
                <span className="text-gray-400 text-sm font-normal">/hour</span>
              </div>
              {unit.specifications && (
                <div className="text-sm text-gray-400">
                  <p className="mb-2 font-medium text-gray-300">Specifications:</p>
                  {Object.entries(unit.specifications).map(([key, value]) => (
                    <p key={key}>• {key}: {value as string}</p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Booking Form */}
          <Card className="md:col-span-2 bg-gaming-card border-cyan-500/20">
            <CardHeader>
              <CardTitle className="text-white">
                {step === 'select' && 'Select Time Slots'}
                {step === 'confirm' && 'Confirm Booking'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {step === 'select' && (
                <div className="space-y-6">
                  {/* Date Selection */}
                  <div>
                    <label className="text-sm text-gray-400 mb-2 block">
                      <Calendar className="h-4 w-4 inline mr-2" />
                      Select Date
                    </label>
                    <input
                      type="date"
                      value={selectedDate.toISOString().split('T')[0]}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) => {
                        setSelectedDate(new Date(e.target.value))
                        setSelectedSlots([])
                      }}
                      className="w-full px-3 py-2 bg-gaming-dark border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  {/* Time Slots */}
                  <div>
                    <label className="text-sm text-gray-400 mb-2 block">
                      <Clock className="h-4 w-4 inline mr-2" />
                      Available Slots ({selectedSlots.length} selected)
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {availableSlots.map((slot) => {
                        const isSelected = selectedSlots.find(
                          s => s.getTime() === slot.getTime()
                        )
                        return (
                          <button
                            key={slot.toISOString()}
                            onClick={() => handleSlotToggle(slot)}
                            className={`p-2 rounded-lg text-sm transition-all ${
                              isSelected
                                ? 'bg-cyan-500 text-white'
                                : 'bg-gaming-dark border border-gray-700 text-gray-300 hover:border-cyan-500/50'
                            }`}
                          >
                            {slot.getHours()}:00
                          </button>
                        )
                      })}
                    </div>
                    {availableSlots.length === 0 && (
                      <p className="text-gray-400 text-sm mt-2">
                        No available slots for this date.
                      </p>
                    )}
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 text-red-400 text-sm">
                      <AlertCircle className="h-4 w-4" />
                      {error}
                    </div>
                  )}

                  <Button
                    className="w-full bg-cyan-500 hover:bg-cyan-600 text-white"
                    disabled={selectedSlots.length === 0 || loading || locking}
                    onClick={handleContinue}
                  >
                    {loading || locking ? 'Processing...' : 'Continue'}
                  </Button>
                </div>
              )}

              {step === 'confirm' && (
                <div className="space-y-6">
                  <div className="bg-gaming-dark rounded-lg p-4">
                    <h3 className="text-white font-medium mb-3">Booking Summary</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Unit</span>
                        <span className="text-white">{unit.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Date</span>
                        <span className="text-white">{formatDate(selectedSlots[0])}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Time</span>
                        <span className="text-white">
                          {selectedSlots[0].getHours()}:00 - {selectedSlots[selectedSlots.length - 1].getHours() + 1}:00
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Duration</span>
                        <span className="text-white">{selectedSlots.length} hours</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Rate</span>
                        <span className="text-white">{formatCurrency(unit.hourly_rate)}/hour</span>
                      </div>
                      <div className="border-t border-gray-700 pt-2 flex justify-between font-medium">
                        <span className="text-gray-400">Total</span>
                        <span className="text-cyan-400">
                          {formatCurrency(unit.hourly_rate * selectedSlots.length)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1 border-gray-600"
                      onClick={() => {
                        setStep('select')
                        if (sessionId) {
                          releaseLock(sessionId)
                        }
                      }}
                    >
                      Back
                    </Button>
                    <Button
                      className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white"
                      disabled={loading}
                      onClick={handleConfirm}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Confirm Booking
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
