'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/useSupabase'
import { useUserReservations } from '@/hooks/useReservations'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Calendar, Clock, Gamepad2, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { formatCurrency, formatDate, formatTime } from '@/lib/utils'

export default function MyReservations() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const { reservations, loading } = useUserReservations()
  const supabase = createClient()

  useEffect(() => {
    if (!user && !userLoading) {
      router.push('/auth/login')
    }
  }, [user, userLoading, router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (userLoading || (!user && !userLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="animate-pulse text-cyan-400">Loading...</div>
      </div>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CONFIRMED': return 'bg-green-500/20 text-green-400 border-green-500/50'
      case 'PENDING': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50'
      case 'COMPLETED': return 'bg-blue-500/20 text-blue-400 border-blue-500/50'
      case 'CANCELLED': return 'bg-red-500/20 text-red-400 border-red-500/50'
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/50'
    }
  }

  return (
    <div className="min-h-screen py-8 px-4 bg-[#0a0a0f]">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
          <div>
            <Link href="/customer">
              <Button variant="ghost" className="text-gray-400 mb-2 -ml-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Gaming Stations
              </Button>
            </Link>
            <h1 className="text-3xl font-bold text-white glow-text mb-2">
              My Reservations
            </h1>
            <p className="text-gray-400">
              Manage your gaming bookings
            </p>
          </div>
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              className="border-red-500/50 text-red-400"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        {/* Reservations List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-pulse text-cyan-400">Loading reservations...</div>
          </div>
        ) : reservations.length === 0 ? (
          <Card className="bg-gaming-card border-cyan-500/20">
            <CardContent className="py-12 text-center">
              <Gamepad2 className="h-12 w-12 text-gray-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No Reservations Yet</h3>
              <p className="text-gray-400 mb-4">Book your first gaming session today!</p>
              <Link href="/customer">
                <Button className="bg-cyan-500 hover:bg-cyan-600 text-white">
                  Browse Gaming Stations
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {reservations.map((reservation) => (
              <Card key={reservation.id} className="bg-gaming-card border-cyan-500/20">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-white text-lg">
                        {reservation.unit?.name || 'Unknown Unit'}
                      </CardTitle>
                      <CardDescription className="text-gray-400">
                        {reservation.unit?.type} • {reservation.unit?.description}
                      </CardDescription>
                    </div>
                    <Badge className={`${getStatusColor(reservation.status)} capitalize`}>
                      {reservation.status.toLowerCase()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-5 w-5 text-cyan-400" />
                      <div>
                        <p className="text-sm text-gray-400">Date</p>
                        <p className="text-white">{formatDate(reservation.start_time)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-cyan-400" />
                      <div>
                        <p className="text-sm text-gray-400">Time</p>
                        <p className="text-white">
                          {formatTime(reservation.start_time)} - {formatTime(reservation.end_time)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-5 w-5 rounded-full bg-gradient-to-br from-cyan-400 to-purple-500" />
                      <div>
                        <p className="text-sm text-gray-400">Total</p>
                        <p className="text-white font-semibold">
                          {formatCurrency(reservation.total_amount)}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
