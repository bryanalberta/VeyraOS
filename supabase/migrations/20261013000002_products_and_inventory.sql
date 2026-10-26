-- ============================================================================
-- VeyraOS Migration: 20261013000002_products_and_inventory.sql
-- Description: Master catalog products table, inventory bounds, and composite tenant unique key.
-- Dependencies: 20261013000001_extensions_and_core.sql (businesses, update_updated_at_column)
-- ============================================================================

-- 1. PRODUCTS TABLE
CREATE TABLE public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (char_length(trim(name)) >= 1),
    sku TEXT,
    category TEXT,
    selling_price BIGINT NOT NULL CHECK (selling_price > 0),
    cost_price BIGINT NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
    stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    min_stock_alert INTEGER NOT NULL DEFAULT 5 CHECK (min_stock_alert >= 0),
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    -- Fundamental multi-tenant composite unique constraint:
    -- Enables child tables (sale_items, purchase_items, stock_movements) to enforce
    -- composite foreign keys (business_id, product_id) matching the same business.
    CONSTRAINT uq_products_business_id UNIQUE (business_id, id)
);

-- 2. PARTIAL UNIQUE INDEX FOR SKU PER BUSINESS
-- SKU must be unique within an active business if specified and non-empty.
CREATE UNIQUE INDEX uq_products_sku_per_business 
ON public.products(business_id, sku) 
WHERE sku IS NOT NULL AND sku <> '' AND is_archived = FALSE;

-- 3. OPERATIONAL INDEXES
-- Filtered index for listing active products within a tenant
CREATE INDEX idx_products_business_active 
ON public.products(business_id) 
WHERE is_archived = FALSE;

-- Index for low-stock alerting and inventory valuation queries
CREATE INDEX idx_products_stock_alert 
ON public.products(business_id, stock_quantity);

-- 4. TRIGGER: AUTO UPDATE UPDATED_AT
CREATE TRIGGER trg_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
