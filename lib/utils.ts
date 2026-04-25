import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date))
}

export function formatTime(date: string | Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeStyle: 'short',
  }).format(new Date(date))
}

export function addHours(date: Date, hours: number): Date {
  const result = new Date(date)
  result.setHours(result.getHours() + hours)
  return result
}

export function getTimeSlots(
  startHour: number = 8,
  endHour: number = 24,
  intervalMinutes: number = 60
): Date[] {
  const slots: Date[] = []
  const now = new Date()
  const start = new Date(now)
  start.setHours(startHour, 0, 0, 0)
  
  const end = new Date(now)
  end.setHours(endHour, 0, 0, 0)
  
  let current = new Date(start)
  while (current < end) {
    slots.push(new Date(current))
    current.setMinutes(current.getMinutes() + intervalMinutes)
  }
  
  return slots
}

export function maskUsername(name: string | null | undefined): string {
  if (!name || name.length < 3) return '***'
  const length = name.length
  return name.charAt(0) + '*'.repeat(length - 2) + name.charAt(length - 1)
}

export function calculateDurationHours(start: Date, end: Date): number {
  const diffMs = end.getTime() - start.getTime()
  return Math.ceil(diffMs / (1000 * 60 * 60))
}

export function isTimeSlotAvailable(
  slotStart: Date,
  slotEnd: Date,
  reservations: { start_time: string; end_time: string; status: string }[]
): boolean {
  return !reservations.some(
    (res) =>
      res.status !== 'CANCELLED' &&
      new Date(res.start_time) < slotEnd &&
      new Date(res.end_time) > slotStart
  )
}

export function generateTimeSlots(
  date: Date,
  startHour: number = 8,
  endHour: number = 24
): { start: Date; end: Date }[] {
  const slots: { start: Date; end: Date }[] = []
  const baseDate = new Date(date)
  
  for (let hour = startHour; hour < endHour; hour++) {
    const start = new Date(baseDate)
    start.setHours(hour, 0, 0, 0)
    
    const end = new Date(baseDate)
    end.setHours(hour + 1, 0, 0, 0)
    
    slots.push({ start, end })
  }
  
  return slots
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    AVAILABLE: 'bg-green-500',
    LOCKED: 'bg-yellow-500',
    BOOKED: 'bg-red-500',
    MAINTENANCE: 'bg-gray-500',
    OFFLINE: 'bg-gray-700',
    PENDING: 'bg-yellow-500',
    CONFIRMED: 'bg-blue-500',
    ACTIVE: 'bg-green-500',
    COMPLETED: 'bg-gray-500',
    CANCELLED: 'bg-red-500',
    NO_SHOW: 'bg-red-700',
  }
  return colors[status] || 'bg-gray-500'
}

export function getStatusBadgeVariant(
  status: string
): 'default' | 'secondary' | 'destructive' | 'outline' {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    AVAILABLE: 'default',
    LOCKED: 'secondary',
    BOOKED: 'destructive',
    MAINTENANCE: 'secondary',
    OFFLINE: 'secondary',
    PENDING: 'secondary',
    CONFIRMED: 'default',
    ACTIVE: 'default',
    COMPLETED: 'outline',
    CANCELLED: 'destructive',
    NO_SHOW: 'destructive',
  }
  return variants[status] || 'default'
}
