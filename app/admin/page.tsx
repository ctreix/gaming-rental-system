'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useUnits } from '@/hooks/useUnits'
import { useAllReservations } from '@/hooks/useReservations'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Monitor, 
  Users, 
  Calendar, 
  DollarSign, 
  Activity,
  Plus,
  Settings,
  LogOut
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { formatCurrency, formatDate, maskUsername } from '@/lib/utils'

export default function AdminDashboard() {
  const { units, loading: unitsLoading } = useUnits()
  const { reservations, loading: reservationsLoading } = useAllReservations()
  const router = useRouter()
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState('overview')

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const stats = {
    totalUnits: units.length,
    availableUnits: units.filter(u => u.status === 'AVAILABLE').length,
    lockedUnits: units.filter(u => u.status === 'LOCKED').length,
    maintenanceUnits: units.filter(u => u.status === 'MAINTENANCE').length,
    totalReservations: reservations.length,
    pendingReservations: reservations.filter(r => r.status === 'PENDING').length,
    confirmedReservations: reservations.filter(r => r.status === 'CONFIRMED').length,
    totalRevenue: reservations
      .filter(r => r.payment_status === 'PAID')
      .reduce((sum, r) => sum + r.total_amount, 0),
  }

  if (unitsLoading || reservationsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-cyan-400">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white glow-text mb-2">
              Admin Dashboard
            </h1>
            <p className="text-gray-400">Manage units, reservations, and monitor activity</p>
          </div>
          <div className="flex gap-3">
            <Link href="/admin/units/new">
              <Button className="bg-cyan-500 hover:bg-cyan-600 text-white">
                <Plus className="h-4 w-4 mr-2" />
                Add Unit
              </Button>
            </Link>
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

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-gaming-card border border-cyan-500/20">
            <TabsTrigger value="overview" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
              <Activity className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="units" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
              <Monitor className="h-4 w-4 mr-2" />
              Units
            </TabsTrigger>
            <TabsTrigger value="reservations" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
              <Calendar className="h-4 w-4 mr-2" />
              Reservations
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-gaming-card border-cyan-500/20">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400">Total Units</p>
                      <p className="text-2xl font-bold text-white">{stats.totalUnits}</p>
                    </div>
                    <Monitor className="h-8 w-8 text-cyan-400" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gaming-card border-cyan-500/20">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400">Available</p>
                      <p className="text-2xl font-bold text-green-400">{stats.availableUnits}</p>
                    </div>
                    <div className="h-8 w-8 rounded-full bg-green-500/20 flex items-center justify-center">
                      <div className="h-3 w-3 rounded-full bg-green-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gaming-card border-cyan-500/20">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400">Pending</p>
                      <p className="text-2xl font-bold text-yellow-400">{stats.pendingReservations}</p>
                    </div>
                    <Calendar className="h-8 w-8 text-yellow-400" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gaming-card border-cyan-500/20">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400">Revenue</p>
                      <p className="text-2xl font-bold text-cyan-400">
                        {formatCurrency(stats.totalRevenue)}
                      </p>
                    </div>
                    <DollarSign className="h-8 w-8 text-cyan-400" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity */}
            <Card className="bg-gaming-card border-cyan-500/20">
              <CardHeader>
                <CardTitle className="text-white">Recent Reservations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left py-3 text-gray-400 font-medium">Unit</th>
                        <th className="text-left py-3 text-gray-400 font-medium">User</th>
                        <th className="text-left py-3 text-gray-400 font-medium">Date</th>
                        <th className="text-left py-3 text-gray-400 font-medium">Amount</th>
                        <th className="text-left py-3 text-gray-400 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reservations.slice(0, 5).map((reservation) => (
                        <tr key={reservation.id} className="border-b border-gray-800">
                          <td className="py-3 text-white">{reservation.unit?.name || 'Unknown'}</td>
                          <td className="py-3 text-gray-400">
                            {maskUsername(reservation.user?.full_name || 'Anonymous')}
                          </td>
                          <td className="py-3 text-gray-400">{formatDate(reservation.start_time)}</td>
                          <td className="py-3 text-cyan-400">{formatCurrency(reservation.total_amount)}</td>
                          <td className="py-3">
                            <Badge className={
                              reservation.status === 'CONFIRMED' ? 'status-available' :
                              reservation.status === 'PENDING' ? 'status-locked' :
                              'status-booked'
                            }>
                              {reservation.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="units" className="space-y-6">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {units.map((unit) => (
                <Card key={unit.id} className="bg-gaming-card border-cyan-500/20">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg text-white">{unit.name}</CardTitle>
                      <Badge className={
                        unit.status === 'AVAILABLE' ? 'status-available' :
                        unit.status === 'LOCKED' ? 'status-locked' :
                        unit.status === 'BOOKED' ? 'status-booked' :
                        'status-maintenance'
                      }>
                        {unit.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-cyan-400 font-bold">
                      {formatCurrency(unit.hourly_rate)}/hour
                    </div>
                    <div className="flex gap-2">
                      <Link href={`/admin/units/${unit.id}/edit`} className="flex-1">
                        <Button variant="outline" className="w-full border-cyan-500/50 text-cyan-400">
                          <Settings className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="reservations" className="space-y-6">
            <Card className="bg-gaming-card border-cyan-500/20">
              <CardHeader>
                <CardTitle className="text-white">All Reservations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left py-3 text-gray-400 font-medium">ID</th>
                        <th className="text-left py-3 text-gray-400 font-medium">Unit</th>
                        <th className="text-left py-3 text-gray-400 font-medium">User</th>
                        <th className="text-left py-3 text-gray-400 font-medium">Date</th>
                        <th className="text-left py-3 text-gray-400 font-medium">Duration</th>
                        <th className="text-left py-3 text-gray-400 font-medium">Amount</th>
                        <th className="text-left py-3 text-gray-400 font-medium">Status</th>
                        <th className="text-left py-3 text-gray-400 font-medium">Payment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reservations.map((reservation) => (
                        <tr key={reservation.id} className="border-b border-gray-800">
                          <td className="py-3 text-gray-400 text-sm">{reservation.id.slice(0, 8)}...</td>
                          <td className="py-3 text-white">{reservation.unit?.name || 'Unknown'}</td>
                          <td className="py-3 text-gray-400">
                            {maskUsername(reservation.user?.full_name || 'Anonymous')}
                          </td>
                          <td className="py-3 text-gray-400">{formatDate(reservation.start_time)}</td>
                          <td className="py-3 text-gray-400">{reservation.total_hours} hours</td>
                          <td className="py-3 text-cyan-400">{formatCurrency(reservation.total_amount)}</td>
                          <td className="py-3">
                            <Badge className={
                              reservation.status === 'CONFIRMED' ? 'status-available' :
                              reservation.status === 'PENDING' ? 'status-locked' :
                              reservation.status === 'ACTIVE' ? 'bg-blue-500/20 text-blue-400' :
                              'status-booked'
                            }>
                              {reservation.status}
                            </Badge>
                          </td>
                          <td className="py-3">
                            <Badge className={
                              reservation.payment_status === 'PAID' ? 'status-available' :
                              reservation.payment_status === 'PENDING' ? 'status-locked' :
                              'status-booked'
                            }>
                              {reservation.payment_status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
