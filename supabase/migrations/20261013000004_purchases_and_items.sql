-- ============================================================================
-- VeyraOS Migration: 20261013000004_purchases_and_items.sql
-- Description: Inventory purchases header and line items for restock tracking.
-- Dependencies: 20261013000001_extensions_and_core.sql (businesses), 20261013000002_products_and_inventory.sql (products)
-- ============================================================================

-- 1. INVENTORY_PURCHASES TABLE (Header Pembelian Stok)
CREATE TABLE public.inventory_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    invoice_number VARCHAR(50) NOT NULL CHECK (char_length(trim(invoice_number)) >= 3),
    purchase_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    supplier_name TEXT,
    total_cost BIGINT NOT NULL CHECK (total_cost >= 0),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_purchases_invoice UNIQUE (business_id, invoice_number)
);

CREATE INDEX idx_purchases_business_date ON public.inventory_purchases(business_id, purchase_date DESC);

-- 2. PURCHASE_ITEMS TABLE (Rincian Item Pembelian Stok)
CREATE TABLE public.purchase_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id UUID NOT NULL REFERENCES public.inventory_purchases(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    product_id UUID NOT NULL,
    product_name_snapshot TEXT NOT NULL CHECK (char_length(trim(product_name_snapshot)) >= 1),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_purchase_cost BIGINT NOT NULL CHECK (unit_purchase_cost >= 0),
    subtotal_cost BIGINT NOT NULL CHECK (subtotal_cost >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    -- Arithmetic check: subtotal must equal quantity * unit_purchase_cost
    CONSTRAINT chk_purchase_items_subtotal CHECK (subtotal_cost = quantity::BIGINT * unit_purchase_cost),
    -- Tenant isolation & composite foreign key:
    -- Prevents restock line items from referencing products of other businesses.
    -- ON DELETE RESTRICT prevents deleting products with purchase history.
    CONSTRAINT fk_purchase_items_product_same_tenant 
        FOREIGN KEY (business_id, product_id) 
        REFERENCES public.products(business_id, id) 
        ON DELETE RESTRICT
);

CREATE INDEX idx_purchase_items_purchase ON public.purchase_items(purchase_id);
CREATE INDEX idx_purchase_items_business ON public.purchase_items(business_id);
CREATE INDEX idx_purchase_items_product ON public.purchase_items(product_id);
