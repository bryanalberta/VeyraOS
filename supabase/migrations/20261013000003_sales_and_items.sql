-- ============================================================================
-- VeyraOS Migration: 20261013000003_sales_and_items.sql
-- Description: Sales transactions header and line items with immutable price/HPP snapshots.
-- Dependencies: 20261013000001_extensions_and_core.sql (businesses), 20261013000002_products_and_inventory.sql (products)
-- ============================================================================

-- 1. SALES TABLE (Header Transaksi Penjualan)
CREATE TABLE public.sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    invoice_number VARCHAR(50) NOT NULL CHECK (char_length(trim(invoice_number)) >= 3),
    transaction_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    subtotal_amount BIGINT NOT NULL CHECK (subtotal_amount >= 0),
    discount_amount BIGINT NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    total_amount BIGINT NOT NULL CHECK (total_amount >= 0),
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('CASH', 'BANK_TRANSFER')),
    status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('COMPLETED', 'VOIDED')),
    void_reason TEXT,
    voided_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_sales_invoice UNIQUE (business_id, invoice_number),
    -- Header discount bound:
    CONSTRAINT chk_sales_discount_limit CHECK (discount_amount <= subtotal_amount),
    -- Arithmetic consistency check between total, subtotal, and discount:
    CONSTRAINT chk_sales_total_calculation CHECK (total_amount = subtotal_amount - discount_amount),
    -- Ensure void reason and void timestamp are present when voided:
    CONSTRAINT chk_sales_void_metadata CHECK (
        (status = 'COMPLETED' AND void_reason IS NULL AND voided_at IS NULL) OR
        (status = 'VOIDED' AND void_reason IS NOT NULL AND char_length(trim(void_reason)) >= 5 AND voided_at IS NOT NULL)
    )
);

CREATE INDEX idx_sales_business_date ON public.sales(business_id, transaction_date DESC);
CREATE INDEX idx_sales_business_status ON public.sales(business_id, status);

-- 2. SALE_ITEMS TABLE (Rincian Item Penjualan dengan Snapshot Harga Abadi)
CREATE TABLE public.sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    product_id UUID NOT NULL,
    product_name_snapshot TEXT NOT NULL CHECK (char_length(trim(product_name_snapshot)) >= 1),
    unit_selling_price BIGINT NOT NULL CHECK (unit_selling_price >= 0),
    unit_cost_price BIGINT NOT NULL CHECK (unit_cost_price >= 0),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    discount_amount BIGINT NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    subtotal_amount BIGINT NOT NULL CHECK (subtotal_amount >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    -- Item discount bound: line discount cannot exceed gross line amount
    CONSTRAINT chk_sale_items_discount_limit CHECK (discount_amount <= quantity::BIGINT * unit_selling_price),
    -- Arithmetic integrity: net subtotal must equal gross minus discount
    CONSTRAINT chk_sale_items_subtotal CHECK (subtotal_amount = (quantity::BIGINT * unit_selling_price) - discount_amount),
    -- Tenant isolation & composite foreign key:
    -- Guarantees that the referenced product strictly belongs to the same business as this line item.
    -- ON DELETE RESTRICT prevents deleting products that have transaction history.
    CONSTRAINT fk_sale_items_product_same_tenant 
        FOREIGN KEY (business_id, product_id) 
        REFERENCES public.products(business_id, id) 
        ON DELETE RESTRICT
);

CREATE INDEX idx_sale_items_sale ON public.sale_items(sale_id);
CREATE INDEX idx_sale_items_business ON public.sale_items(business_id);
CREATE INDEX idx_sale_items_product ON public.sale_items(product_id);
