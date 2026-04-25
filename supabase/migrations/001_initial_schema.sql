-- Gaming Rental Reservation System - Database Schema
-- Based on ISO/IEC 25010 Quality Standards

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- UNITS TABLE (Gaming PCs, PS5s, VIP Rooms)
-- ============================================
CREATE TABLE units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('PC', 'PS5', 'VIP')),
    specifications JSONB NOT NULL DEFAULT '{}',
    hourly_rate DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'LOCKED', 'BOOKED', 'MAINTENANCE', 'OFFLINE')),
    locked_until TIMESTAMP WITH TIME ZONE,
    locked_by UUID REFERENCES auth.users(id),
    image_url TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- PROFILES TABLE (User Extensions)
-- ============================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR(100),
    phone_number VARCHAR(20),
    avatar_url TEXT,
    role VARCHAR(20) NOT NULL DEFAULT 'CUSTOMER' CHECK (role IN ('CUSTOMER', 'ADMIN')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- RESERVATIONS TABLE
-- ============================================
CREATE TYPE reservation_status AS ENUM ('PENDING', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'NO_SHOW');
CREATE TYPE payment_status AS ENUM ('PENDING', 'PAID', 'REFUNDED', 'FAILED');

CREATE TABLE reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
    status reservation_status NOT NULL DEFAULT 'PENDING',
    payment_status payment_status NOT NULL DEFAULT 'PENDING',
    
    -- Time slots
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Pricing
    hourly_rate DECIMAL(10,2) NOT NULL,
    total_hours INTEGER NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    
    -- Payment proof
    payment_proof_url TEXT,
    payment_verified_at TIMESTAMP WITH TIME ZONE,
    payment_verified_by UUID REFERENCES auth.users(id),
    
    -- Metadata
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_time_range CHECK (end_time > start_time),
    CONSTRAINT valid_total_hours CHECK (total_hours > 0)
);

-- ============================================
-- RESERVATION_LOCKS TABLE (15-minute lock mechanism)
-- ============================================
CREATE TABLE reservation_locks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    session_id UUID NOT NULL DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- PAYMENT_PROOFS TABLE
-- ============================================
CREATE TABLE payment_proofs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(50) NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- ACTIVITY_LOGS TABLE (for audit trail)
-- ============================================
CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id),
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX idx_units_type ON units(type);
CREATE INDEX idx_units_status ON units(status);
CREATE INDEX idx_reservations_user_id ON reservations(user_id);
CREATE INDEX idx_reservations_unit_id ON reservations(unit_id);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_reservations_time_range ON reservations(start_time, end_time);
CREATE INDEX idx_reservation_locks_expires ON reservation_locks(expires_at);
CREATE INDEX idx_reservation_locks_unit ON reservation_locks(unit_id);
CREATE INDEX idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_created ON activity_logs(created_at);

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_units_updated_at BEFORE UPDATE ON units
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reservations_updated_at BEFORE UPDATE ON reservations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to check and clean expired locks
CREATE OR REPLACE FUNCTION clean_expired_locks()
RETURNS void AS $$
BEGIN
    DELETE FROM reservation_locks WHERE expires_at < NOW();
    
    UPDATE units 
    SET status = 'AVAILABLE', 
        locked_until = NULL, 
        locked_by = NULL 
    WHERE status = 'LOCKED' 
    AND (locked_until IS NULL OR locked_until < NOW());
END;
$$ LANGUAGE plpgsql;

-- Function to acquire a lock on a unit
CREATE OR REPLACE FUNCTION acquire_unit_lock(
    p_unit_id UUID,
    p_user_id UUID,
    p_start_time TIMESTAMP WITH TIME ZONE,
    p_end_time TIMESTAMP WITH TIME ZONE,
    p_duration_minutes INTEGER DEFAULT 15
)
RETURNS TABLE(success BOOLEAN, session_id UUID, message TEXT) AS $$
DECLARE
    v_session_id UUID := uuid_generate_v4();
    v_existing_lock UUID;
    v_unit_status VARCHAR(20);
    v_overlapping_reservation INTEGER;
BEGIN
    -- Clean expired locks first
    PERFORM clean_expired_locks();
    
    -- Check if unit is available
    SELECT status INTO v_unit_status FROM units WHERE id = p_unit_id;
    
    IF v_unit_status = 'MAINTENANCE' OR v_unit_status = 'OFFLINE' THEN
        RETURN QUERY SELECT FALSE, v_session_id, 'Unit is under maintenance or offline'::TEXT;
        RETURN;
    END IF;
    
    IF v_unit_status = 'BOOKED' THEN
        RETURN QUERY SELECT FALSE, v_session_id, 'Unit is already booked'::TEXT;
        RETURN;
    END IF;
    
    -- Check for existing lock by another user
    SELECT id INTO v_existing_lock 
    FROM reservation_locks 
    WHERE unit_id = p_unit_id 
    AND expires_at > NOW()
    AND user_id != p_user_id;
    
    IF FOUND THEN
        RETURN QUERY SELECT FALSE, v_session_id, 'Unit is being booked by another user'::TEXT;
        RETURN;
    END IF;
    
    -- Check for overlapping confirmed reservations
    SELECT COUNT(*) INTO v_overlapping_reservation
    FROM reservations
    WHERE unit_id = p_unit_id
    AND status IN ('CONFIRMED', 'ACTIVE')
    AND (
        (start_time <= p_end_time AND end_time >= p_start_time)
    );
    
    IF v_overlapping_reservation > 0 THEN
        RETURN QUERY SELECT FALSE, v_session_id, 'Time slot is already booked'::TEXT;
        RETURN;
    END IF;
    
    -- Create the lock
    INSERT INTO reservation_locks (unit_id, user_id, start_time, end_time, expires_at, session_id)
    VALUES (p_unit_id, p_user_id, p_start_time, p_end_time, NOW() + (p_duration_minutes || ' minutes')::INTERVAL, v_session_id);
    
    -- Update unit status
    UPDATE units 
    SET status = 'LOCKED', 
        locked_until = NOW() + (p_duration_minutes || ' minutes')::INTERVAL,
        locked_by = p_user_id
    WHERE id = p_unit_id;
    
    RETURN QUERY SELECT TRUE, v_session_id, 'Lock acquired successfully'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Function to release a lock
CREATE OR REPLACE FUNCTION release_unit_lock(
    p_session_id UUID,
    p_user_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    DELETE FROM reservation_locks 
    WHERE session_id = p_session_id AND user_id = p_user_id;
    
    IF FOUND THEN
        UPDATE units 
        SET status = 'AVAILABLE', locked_until = NULL, locked_by = NULL 
        WHERE locked_by = p_user_id AND status = 'LOCKED';
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to mask username for privacy
CREATE OR REPLACE FUNCTION mask_username(p_full_name TEXT)
RETURNS TEXT AS $$
DECLARE
    v_length INTEGER;
BEGIN
    IF p_full_name IS NULL OR LENGTH(p_full_name) < 3 THEN
        RETURN '***';
    END IF;
    
    v_length := LENGTH(p_full_name);
    RETURN SUBSTRING(p_full_name, 1, 1) || REPEAT('*', v_length - 2) || SUBSTRING(p_full_name, v_length, 1);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservation_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Units policies
CREATE POLICY "Units are viewable by everyone" ON units
    FOR SELECT USING (true);

CREATE POLICY "Only admins can modify units" ON units
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (id = auth.uid());

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Admins can view all profiles" ON profiles
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

-- Reservations policies
CREATE POLICY "Users can view own reservations" ON reservations
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create own reservations" ON reservations
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own pending reservations" ON reservations
    FOR UPDATE USING (
        user_id = auth.uid() AND status = 'PENDING'
    );

CREATE POLICY "Admins can view all reservations" ON reservations
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

-- Reservation locks policies
CREATE POLICY "Users can view own locks" ON reservation_locks
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can manage own locks" ON reservation_locks
    FOR ALL USING (user_id = auth.uid());

-- Payment proofs policies
CREATE POLICY "Users can view own payment proofs" ON payment_proofs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM reservations 
            WHERE id = payment_proofs.reservation_id 
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage all payment proofs" ON payment_proofs
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

-- ============================================
-- REALTIME SUBSCRIPTIONS
-- ============================================
-- Enable realtime for tables
ALTER PUBLICATION supabase_realtime ADD TABLE units;
ALTER PUBLICATION supabase_realtime ADD TABLE reservations;
ALTER PUBLICATION supabase_realtime ADD TABLE reservation_locks;

-- ============================================
-- STORAGE BUCKETS
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', false)
ON CONFLICT DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('unit-images', 'unit-images', true)
ON CONFLICT DO NOTHING;

-- Storage policies
CREATE POLICY "Authenticated users can upload payment proofs" ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (bucket_id = 'payment-proofs');

CREATE POLICY "Users can view own payment proofs" ON storage.objects
    FOR SELECT TO authenticated USING (
        bucket_id = 'payment-proofs' AND 
        (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY "Public can view unit images" ON storage.objects
    FOR SELECT TO public USING (bucket_id = 'unit-images');

CREATE POLICY "Admins can manage unit images" ON storage.objects
    FOR ALL TO authenticated USING (
        bucket_id = 'unit-images' AND
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );
