-- ============================================================================
-- VeyraOS Migration: 20261013000005_stock_movements.sql
-- Description: Immutable stock movements audit ledger.
-- Dependencies: 20261013000001_extensions_and_core.sql (businesses), 20261013000002_products_and_inventory.sql (products)
-- ============================================================================

-- 1. STOCK_MOVEMENTS TABLE (Buku Besar Mutasi Stok Fisik Abadi)
CREATE TABLE public.stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    product_id UUID NOT NULL,
    movement_type VARCHAR(30) NOT NULL CHECK (movement_type IN ('INITIAL', 'SALE', 'PURCHASE', 'VOID_SALE', 'ADJUSTMENT')),
    quantity_delta INTEGER NOT NULL CHECK (quantity_delta <> 0),
    previous_quantity INTEGER NOT NULL CHECK (previous_quantity >= 0),
    new_quantity INTEGER NOT NULL CHECK (new_quantity >= 0),
    reference_id UUID,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    -- Balance invariant: new_quantity must equal previous_quantity + quantity_delta
    CONSTRAINT chk_stock_movements_balance CHECK (new_quantity = previous_quantity + quantity_delta),
    -- Delta direction invariant per movement type:
    -- SALE must decrease inventory, PURCHASE / VOID_SALE / INITIAL must increase inventory
    CONSTRAINT chk_stock_movements_delta_direction CHECK (
        (movement_type = 'SALE' AND quantity_delta < 0) OR
        (movement_type = 'PURCHASE' AND quantity_delta > 0) OR
        (movement_type = 'VOID_SALE' AND quantity_delta > 0) OR
        (movement_type = 'INITIAL' AND quantity_delta > 0) OR
        (movement_type = 'ADJUSTMENT' AND quantity_delta <> 0)
    ),
    -- Transactional movements must supply reference_id to the source invoice
    CONSTRAINT chk_stock_movements_reference CHECK (
        (movement_type IN ('SALE', 'PURCHASE', 'VOID_SALE') AND reference_id IS NOT NULL) OR
        (movement_type IN ('INITIAL', 'ADJUSTMENT'))
    ),
    -- Tenant isolation & composite foreign key:
    -- Guarantees the moved product strictly belongs to the same business.
    -- ON DELETE RESTRICT prevents deleting products with audit trail.
    CONSTRAINT fk_stock_movements_product_same_tenant 
        FOREIGN KEY (business_id, product_id) 
        REFERENCES public.products(business_id, id) 
        ON DELETE RESTRICT
);

CREATE INDEX idx_stock_movements_product ON public.stock_movements(product_id, created_at DESC);
CREATE INDEX idx_stock_movements_business ON public.stock_movements(business_id, created_at DESC);
CREATE INDEX idx_stock_movements_ref ON public.stock_movements(reference_id) WHERE reference_id IS NOT NULL;
