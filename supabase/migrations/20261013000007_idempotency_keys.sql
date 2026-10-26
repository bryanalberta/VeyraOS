-- ============================================================================
-- VeyraOS Migration: 20261013000007_idempotency_keys.sql
-- Description: Persistent idempotency records for preventing duplicate transactions.
-- Dependencies: 20261013000001_extensions_and_core.sql (businesses)
-- ============================================================================

-- 1. IDEMPOTENCY_KEYS TABLE
CREATE TABLE public.idempotency_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    key TEXT NOT NULL CHECK (char_length(trim(key)) >= 8 AND char_length(key) <= 128),
    action_type VARCHAR(30) NOT NULL CHECK (action_type IN ('RECORD_SALE', 'RECORD_PURCHASE', 'VOID_SALE')),
    response_payload JSONB NOT NULL CHECK (jsonb_typeof(response_payload) = 'object'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    -- Guarantees uniqueness per business tenant (also creates unique index on (business_id, key))
    CONSTRAINT uq_idempotency_key UNIQUE (business_id, key)
);

-- Index for maintenance and retention policies
CREATE INDEX idx_idempotency_created ON public.idempotency_keys(created_at DESC);
