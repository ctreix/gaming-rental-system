export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      units: {
        Row: {
          id: string
          name: string
          type: 'PC' | 'PS5' | 'VIP'
          specifications: {
            cpu?: string
            gpu?: string
            ram?: string
            storage?: string
            monitor?: string
            peripherals?: string[]
            internet?: string
            [key: string]: any
          }
          hourly_rate: number
          status: 'AVAILABLE' | 'LOCKED' | 'BOOKED' | 'MAINTENANCE' | 'OFFLINE'
          locked_until: string | null
          locked_by: string | null
          image_url: string | null
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          type: 'PC' | 'PS5' | 'VIP'
          specifications?: Json
          hourly_rate: number
          status?: 'AVAILABLE' | 'LOCKED' | 'BOOKED' | 'MAINTENANCE' | 'OFFLINE'
          locked_until?: string | null
          locked_by?: string | null
          image_url?: string | null
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          type?: 'PC' | 'PS5' | 'VIP'
          specifications?: Json
          hourly_rate?: number
          status?: 'AVAILABLE' | 'LOCKED' | 'BOOKED' | 'MAINTENANCE' | 'OFFLINE'
          locked_until?: string | null
          locked_by?: string | null
          image_url?: string | null
          description?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          full_name: string | null
          phone_number: string | null
          avatar_url: string | null
          role: 'CUSTOMER' | 'ADMIN'
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          phone_number?: string | null
          avatar_url?: string | null
          role?: 'CUSTOMER' | 'ADMIN'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          phone_number?: string | null
          avatar_url?: string | null
          role?: 'CUSTOMER' | 'ADMIN'
          created_at?: string
          updated_at?: string
        }
      }
      reservations: {
        Row: {
          id: string
          user_id: string
          unit_id: string
          status: 'PENDING' | 'CONFIRMED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW'
          payment_status: 'PENDING' | 'PAID' | 'REFUNDED' | 'FAILED'
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
        Insert: {
          id?: string
          user_id: string
          unit_id: string
          status?: 'PENDING' | 'CONFIRMED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW'
          payment_status?: 'PENDING' | 'PAID' | 'REFUNDED' | 'FAILED'
          start_time: string
          end_time: string
          hourly_rate: number
          total_hours: number
          total_amount: number
          payment_proof_url?: string | null
          payment_verified_at?: string | null
          payment_verified_by?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          unit_id?: string
          status?: 'PENDING' | 'CONFIRMED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW'
          payment_status?: 'PENDING' | 'PAID' | 'REFUNDED' | 'FAILED'
          start_time?: string
          end_time?: string
          hourly_rate?: number
          total_hours?: number
          total_amount?: number
          payment_proof_url?: string | null
          payment_verified_at?: string | null
          payment_verified_by?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      reservation_locks: {
        Row: {
          id: string
          unit_id: string
          user_id: string
          start_time: string
          end_time: string
          expires_at: string
          session_id: string
          created_at: string
        }
        Insert: {
          id?: string
          unit_id: string
          user_id: string
          start_time: string
          end_time: string
          expires_at: string
          session_id?: string
          created_at?: string
        }
        Update: {
          id?: string
          unit_id?: string
          user_id?: string
          start_time?: string
          end_time?: string
          expires_at?: string
          session_id?: string
          created_at?: string
        }
      }
    }
    Functions: {
      clean_expired_locks: {
        Args: Record<string, never>
        Returns: void
      }
      acquire_unit_lock: {
        Args: {
          p_unit_id: string
          p_user_id: string
          p_start_time: string
          p_end_time: string
          p_duration_minutes?: number
        }
        Returns: {
          success: boolean
          session_id: string
          message: string
        }
      }
      release_unit_lock: {
        Args: {
          p_session_id: string
          p_user_id: string
        }
        Returns: boolean
      }
      mask_username: {
        Args: {
          p_full_name: string
        }
        Returns: string
      }
    }
  }
}
