-- ============================================================================
-- VeyraOS Migration: 20261013000006_expenses.sql
-- Description: Operational expenses tracking table.
-- Dependencies: 20261013000001_extensions_and_core.sql (businesses, update_updated_at_column)
-- ============================================================================

-- 1. EXPENSES TABLE (Buku Catatan Beban Operasional)
CREATE TABLE public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    expense_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    category VARCHAR(50) NOT NULL CHECK (char_length(trim(category)) >= 2),
    amount BIGINT NOT NULL CHECK (amount > 0),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX idx_expenses_business_date ON public.expenses(business_id, expense_date DESC);
CREATE INDEX idx_expenses_category ON public.expenses(business_id, category);

-- Trigger for auto updated_at
CREATE TRIGGER trg_expenses_updated_at
BEFORE UPDATE ON public.expenses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
