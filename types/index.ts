// Hand-written types matching the JSON returned by the API route handlers.
// Field names are snake_case and date fields are ISO strings, because the
// route handlers serialize Prisma rows to JSON. These replace the earlier
// generated database types that used to live in ./database (now deleted).

export type UnitType = 'PC' | 'PS5' | 'VIP'
export type UnitStatus = 'AVAILABLE' | 'LOCKED' | 'BOOKED' | 'MAINTENANCE' | 'OFFLINE'
export type ReservationStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW'
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
  [key: string]: unknown
}

export interface Unit {
  id: string
  name: string
  type: UnitType
  // `serializeUnit()` parses the stored TEXT into an object before responding.
  specifications: UnitSpecifications
  hourly_rate: number
  status: UnitStatus
  locked_until: string | null
  locked_by: string | null
  image_url: string | null
  description: string | null
  created_at: string
  updated_at: string
}

// Shape returned by GET /api/auth/me (`user`) and nested under a reservation.
export interface Profile {
  id: string
  full_name: string | null
  phone_number: string | null
  role: UserRole
  created_at?: string
  updated_at?: string
}

export interface Reservation {
  id: string
  user_id: string
  unit_id: string
  status: ReservationStatus
  payment_status: PaymentStatus
  start_time: string
  end_time: string
  hourly_rate: number
  total_hours: number
  total_amount: number
  payment_proof_url: string | null
  payment_verified_at: string | null
  payment_verified_by: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ReservationLock {
  id: string
  unit_id: string
  user_id: string
  start_time: string
  end_time: string
  expires_at: string
  session_id: string
  created_at: string
}

export interface TimeSlot {
  startTime: Date
  endTime: Date
  available: boolean
  lockedByMe?: boolean
}

export interface ReservationWithDetails extends Reservation {
  unit?: Unit
  user?: Pick<Profile, 'id' | 'full_name' | 'phone_number' | 'role'> | null
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
