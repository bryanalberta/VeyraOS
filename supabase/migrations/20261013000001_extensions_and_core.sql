-- ============================================================================
-- VeyraOS Migration: 20261013000001_extensions_and_core.sql
-- Description: Timestamp helper, profiles, businesses, and business_members.
-- Dependencies: Supabase auth.users schema (PostgreSQL 15+ with built-in gen_random_uuid)
-- ============================================================================

-- 1. HELPER FUNCTION: AUTO UPDATE UPDATED_AT
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = pg_catalog.timezone('utc'::pg_catalog.text, pg_catalog.now());
    RETURN NEW;
END;
$$;

-- Restrict direct execution of internal trigger function via RPC
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- 2. PROFILES TABLE (1-to-1 dengan auth.users)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL CHECK (char_length(trim(full_name)) >= 2),
    email TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX idx_profiles_email ON public.profiles(email);

CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 3. BUSINESSES TABLE (Akar Multi-Tenant)
CREATE TABLE public.businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (char_length(trim(name)) >= 2),
    category TEXT,
    phone TEXT,
    address TEXT,
    currency_code VARCHAR(3) NOT NULL DEFAULT 'IDR' CHECK (currency_code = 'IDR'),
    timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta' CHECK (timezone = 'Asia/Jakarta'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX idx_businesses_owner ON public.businesses(owner_id);

CREATE TRIGGER trg_businesses_updated_at
BEFORE UPDATE ON public.businesses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 4. BUSINESS_MEMBERS TABLE (Otorisasi Tenant)
CREATE TABLE public.business_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'OWNER' CHECK (role IN ('OWNER')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_business_member UNIQUE (business_id, user_id)
);

CREATE INDEX idx_business_members_lookup ON public.business_members(user_id, business_id);

-- 5. TRIGGER: AUTO-ENROLL PEMILIK BISNIS SAAT BISNIS DIBUAT
-- Hardened SECURITY DEFINER function with empty search_path to prevent hijack
CREATE OR REPLACE FUNCTION public.handle_new_business_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.id IS NULL OR NEW.owner_id IS NULL THEN
        RAISE EXCEPTION 'business id and owner_id must not be null';
    END IF;

    INSERT INTO public.business_members (business_id, user_id, role)
    VALUES (NEW.id, NEW.owner_id, 'OWNER')
    ON CONFLICT (business_id, user_id) DO NOTHING;
    RETURN NEW;
END;
$$;

-- Restrict direct execution of internal trigger function via RPC
REVOKE EXECUTE ON FUNCTION public.handle_new_business_owner() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_after_business_insert
AFTER INSERT ON public.businesses
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_business_owner();
