'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useUnits } from '@/hooks/useUnits'
import { useUser } from '@/hooks/useSupabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Gamepad2, 
  Monitor, 
  Users, 
  ArrowRight, 
  Clock, 
  CheckCircle,
  Lock,
  LogOut
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { UnitType, UnitStatus } from '@/types'

const unitTypeIcons: Record<UnitType, React.ReactNode> = {
  PC: <Monitor className="h-6 w-6" />,
  PS5: <Gamepad2 className="h-6 w-6" />,
  VIP: <Users className="h-6 w-6" />,
}

const statusConfig: Record<UnitStatus, { label: string; className: string; icon: React.ReactNode }> = {
  AVAILABLE: { 
    label: 'Available', 
    className: 'status-available', 
    icon: <CheckCircle className="h-4 w-4" /> 
  },
  LOCKED: { 
    label: 'Being Booked', 
    className: 'status-locked', 
    icon: <Lock className="h-4 w-4" /> 
  },
  BOOKED: { 
    label: 'Booked', 
    className: 'status-booked', 
    icon: <Clock className="h-4 w-4" /> 
  },
  MAINTENANCE: { 
    label: 'Maintenance', 
    className: 'status-maintenance', 
    icon: <Clock className="h-4 w-4" /> 
  },
  OFFLINE: { 
    label: 'Offline', 
    className: 'status-maintenance', 
    icon: <Clock className="h-4 w-4" /> 
  },
}

export default function CustomerPortal() {
  const { units, loading } = useUnits()
  const { user } = useUser()
  const router = useRouter()
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState('all')

  useEffect(() => {
    if (!user && !loading) {
      router.push('/auth/login')
    }
  }, [user, loading, router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const filteredUnits = activeTab === 'all' 
    ? units 
    : units.filter(unit => unit.type.toLowerCase() === activeTab)

  const availableCount = units.filter(u => u.status === 'AVAILABLE').length
  const pcCount = units.filter(u => u.type === 'PC').length
  const ps5Count = units.filter(u => u.type === 'PS5').length
  const vipCount = units.filter(u => u.type === 'VIP').length

  if (loading || (!user && !loading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-cyan-400">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-8 px-4 bg-[#0a0a0f]">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white glow-text mb-2">
              Gaming Stations
            </h1>
            <p className="text-gray-400">
              Welcome back, {user?.email?.split('@')[0] || 'Gamer'}
            </p>
          </div>
          <div className="flex gap-3">
            {user && (
              <>
                <Link href="/customer/reservations">
                  <Button variant="outline" className="border-cyan-500/50 text-cyan-400">
                    My Reservations
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
              </>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-gaming-card border-cyan-500/20">
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-cyan-400">{availableCount}</div>
              <div className="text-sm text-gray-400">Available Now</div>
            </CardContent>
          </Card>
          <Card className="bg-gaming-card border-cyan-500/20">
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-blue-400">{pcCount}</div>
              <div className="text-sm text-gray-400">Gaming PCs</div>
            </CardContent>
          </Card>
          <Card className="bg-gaming-card border-cyan-500/20">
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-purple-400">{ps5Count}</div>
              <div className="text-sm text-gray-400">PS5 Consoles</div>
            </CardContent>
          </Card>
          <Card className="bg-gaming-card border-cyan-500/20">
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-pink-400">{vipCount}</div>
              <div className="text-sm text-gray-400">VIP Rooms</div>
            </CardContent>
          </Card>
        </div>

        {/* Units Grid with Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-gaming-card border border-cyan-500/20">
            <TabsTrigger value="all" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
              All Units
            </TabsTrigger>
            <TabsTrigger value="pc" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
              <Monitor className="h-4 w-4 mr-2" />
              PC
            </TabsTrigger>
            <TabsTrigger value="ps5" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
              <Gamepad2 className="h-4 w-4 mr-2" />
              PS5
            </TabsTrigger>
            <TabsTrigger value="vip" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
              <Users className="h-4 w-4 mr-2" />
              VIP
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredUnits.map((unit) => {
                const status = statusConfig[unit.status]
                return (
                  <Card 
                    key={unit.id} 
                    className="bg-gaming-card border-cyan-500/20 glow-border hover:border-cyan-500/40 transition-all"
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${
                            unit.type === 'PC' ? 'bg-blue-500/20 text-blue-400' :
                            unit.type === 'PS5' ? 'bg-purple-500/20 text-purple-400' :
                            'bg-pink-500/20 text-pink-400'
                          }`}>
                            {unitTypeIcons[unit.type]}
                          </div>
                          <div>
                            <CardTitle className="text-lg text-white">{unit.name}</CardTitle>
                            <CardDescription className="text-gray-400">
                              {unit.type} Gaming Station
                            </CardDescription>
                          </div>
                        </div>
                        <Badge className={status.className}>
                          <span className="flex items-center gap-1">
                            {status.icon}
                            {status.label}
                          </span>
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-gray-400 line-clamp-2">
                        {unit.description || 'Premium gaming station with high-end specifications.'}
                      </p>
                      
                      <div className="flex items-center justify-between">
                        <div className="text-cyan-400 font-bold text-xl">
                          Rp {unit.hourly_rate.toLocaleString('id-ID')}
                          <span className="text-gray-400 text-sm font-normal">/hour</span>
                        </div>
                        <Link href={`/customer/book/${unit.id}`}>
                          <Button 
                            className="bg-cyan-500 hover:bg-cyan-600 text-white"
                            disabled={unit.status !== 'AVAILABLE'}
                          >
                            Book Now
                            <ArrowRight className="h-4 w-4 ml-2" />
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
