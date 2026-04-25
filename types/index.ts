import { Database } from './database'

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
export type InsertTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']
export type UpdateTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']

export type Unit = Tables<'units'>
export type Profile = Tables<'profiles'>
export type Reservation = Tables<'reservations'>
export type ReservationLock = Tables<'reservation_locks'>

export type UnitType = 'PC' | 'PS5' | 'VIP'
export type UnitStatus = 'AVAILABLE' | 'LOCKED' | 'BOOKED' | 'MAINTENANCE' | 'OFFLINE'
export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW'
export type PaymentStatus = 'PENDING' | 'PAID' | 'REFUNDED' | 'FAILED'
export type UserRole = 'CUSTOMER' | 'ADMIN'

export interface UnitSpecifications {
  cpu?: string
  gpu?: string
  ram?: string
  storage?: string
  monitor?: string
  peripherals?: string[]
  internet?: string
  games?: string[]
  [key: string]: any
}

export interface TimeSlot {
  startTime: Date
  endTime: Date
  available: boolean
  lockedByMe?: boolean
}

export interface ReservationWithDetails extends Reservation {
  unit?: Unit
  user?: Profile
}

export interface UnitWithReservations extends Unit {
  reservations?: Reservation[]
}

export interface LockResult {
  success: boolean
  session_id: string
  message: string
}

export interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  status: ReservationStatus
  maskedUsername: string
  unitName: string
}

export interface PaymentProofUpload {
  file: File
  previewUrl: string
}
