-- ============================================================================
-- VeyraOS Migration: 20261013000009_stored_procedures.sql
-- Description: Atomic PostgreSQL PL/pgSQL Stored Procedures (RPC) for Sales POS,
--              Inventory Purchases (MWAC), and Sale Void with Idempotency.
-- Dependencies: 20261013000001 through 20261013000008
-- ============================================================================

-- ============================================================================
-- 1. ENHANCE IDEMPOTENCY_KEYS TABLE
-- Binds idempotency records to authenticated user and request payload
-- ============================================================================

ALTER TABLE public.idempotency_keys
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS request_payload JSONB;

-- ============================================================================
-- 2. RPC: record_sale_transaction
-- Atomically records a sale, allocates transaction discount (Largest Remainder),
-- captures immutable unit price & HPP snapshots, decrements physical stock,
-- records stock movement ledger, and saves idempotency receipt.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_sale_transaction(
    p_business_id UUID,
    p_invoice_number TEXT,
    p_payment_method TEXT,
    p_discount_amount BIGINT,
    p_notes TEXT,
    p_items JSONB,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_sale_id UUID;
    v_tx_date TIMESTAMPTZ;
    v_item JSONB;
    v_prod RECORD;
    v_prod_id_raw TEXT;
    v_prod_id UUID;
    v_qty INTEGER;
    v_item_discount BIGINT;
    v_item_gross BIGINT;
    v_total_gross_subtotal BIGINT := 0;
    v_total_amount BIGINT := 0;

    -- Largest Remainder tracking variables
    v_max_item_id UUID := NULL;
    v_max_item_gross BIGINT := -1;
    v_item_prop_disc BIGINT := 0;
    v_sum_allocated_disc BIGINT := 0;
    v_remainder BIGINT := 0;
    v_line_total_discount BIGINT := 0;
    v_line_subtotal BIGINT := 0;

    -- Idempotency variables
    v_req_payload JSONB;
    v_idem_action VARCHAR(30);
    v_idem_user UUID;
    v_idem_req JSONB;
    v_idem_resp JSONB;
    v_final_response JSONB;
BEGIN
    -- 1. Authentication & Tenant Authorization Guard
    IF auth.uid() IS NULL OR NOT public.is_business_member(p_business_id) THEN
        RAISE EXCEPTION 'UNAUTHORIZED_BUSINESS';
    END IF;

    -- 2. Input Parameter Validations
    IF p_business_id IS NULL THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT: business_id is required';
    END IF;

    IF p_invoice_number IS NULL OR pg_catalog.char_length(pg_catalog.trim(p_invoice_number)) < 3 THEN
        RAISE EXCEPTION 'INVALID_INVOICE_NUMBER: invoice_number must be at least 3 characters';
    END IF;

    IF p_payment_method IS NULL OR p_payment_method NOT IN ('CASH', 'BANK_TRANSFER') THEN
        RAISE EXCEPTION 'INVALID_PAYMENT_METHOD: payment_method must be CASH or BANK_TRANSFER';
    END IF;

    IF p_discount_amount IS NULL OR p_discount_amount < 0 THEN
        RAISE EXCEPTION 'INVALID_DISCOUNT: discount_amount cannot be negative';
    END IF;

    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'EMPTY_SALE_ITEMS: at least one item is required';
    END IF;

    -- 3. Idempotency Check
    v_req_payload := jsonb_build_object(
        'invoice_number', pg_catalog.trim(p_invoice_number),
        'payment_method', p_payment_method,
        'discount_amount', p_discount_amount,
        'notes', p_notes,
        'items', p_items
    );

    IF p_idempotency_key IS NOT NULL AND pg_catalog.trim(p_idempotency_key) <> '' THEN
        IF pg_catalog.char_length(pg_catalog.trim(p_idempotency_key)) < 8 OR pg_catalog.char_length(p_idempotency_key) > 128 THEN
            RAISE EXCEPTION 'INVALID_IDEMPOTENCY_KEY: key length must be between 8 and 128 characters';
        END IF;

        SELECT action_type, user_id, request_payload, response_payload
        INTO v_idem_action, v_idem_user, v_idem_req, v_idem_resp
        FROM public.idempotency_keys
        WHERE business_id = p_business_id AND key = pg_catalog.trim(p_idempotency_key);

        IF FOUND THEN
            IF v_idem_action <> 'RECORD_SALE' THEN
                RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_ACTION';
            END IF;
            IF v_idem_req IS DISTINCT FROM v_req_payload THEN
                RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD';
            END IF;
            RETURN v_idem_resp;
        END IF;
    END IF;

    -- 4. Deterministic Row Locking (Ascending by Product ID to prevent Deadlocks)
    PERFORM id FROM public.products
    WHERE business_id = p_business_id
      AND id IN (
          SELECT (COALESCE(item->>'product_id', item->>'productId'))::UUID
          FROM jsonb_array_elements(p_items) AS item
      )
    ORDER BY id ASC
    FOR UPDATE;

    -- 5. Pass 1: Validate items, verify tenant ownership & stock sufficiency, calculate gross subtotal
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_prod_id_raw := COALESCE(v_item->>'product_id', v_item->>'productId');
        IF v_prod_id_raw IS NULL THEN
            RAISE EXCEPTION 'INVALID_ARGUMENT: productId is required for each item';
        END IF;
        v_prod_id := v_prod_id_raw::UUID;

        v_qty := (v_item->>'quantity')::INTEGER;
        IF v_qty IS NULL OR v_qty <= 0 THEN
            RAISE EXCEPTION 'INVALID_QUANTITY: item quantity must be greater than 0';
        END IF;

        v_item_discount := COALESCE((COALESCE(v_item->>'item_discount', v_item->>'itemDiscount'))::BIGINT, 0);
        IF v_item_discount < 0 THEN
            RAISE EXCEPTION 'INVALID_DISCOUNT: item_discount cannot be negative';
        END IF;

        SELECT id, name, selling_price, cost_price, stock_quantity, is_archived
        INTO v_prod
        FROM public.products
        WHERE id = v_prod_id AND business_id = p_business_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'PRODUCT_NOT_FOUND: %', v_prod_id;
        END IF;

        IF v_prod.stock_quantity < v_qty THEN
            RAISE EXCEPTION 'STOCK_INSUFFICIENT: Produk "%" sisa %, diminta %',
                v_prod.name, v_prod.stock_quantity, v_qty;
        END IF;

        IF v_item_discount > (v_qty::BIGINT * v_prod.selling_price) THEN
            RAISE EXCEPTION 'INVALID_DISCOUNT: item discount exceeds item gross amount';
        END IF;

        v_item_gross := (v_qty::BIGINT * v_prod.selling_price) - v_item_discount;
        v_total_gross_subtotal := v_total_gross_subtotal + v_item_gross;

        -- Deterministic tracking of item with largest gross subtotal (tie-break on lowest UUID)
        IF v_max_item_id IS NULL 
           OR v_item_gross > v_max_item_gross 
           OR (v_item_gross = v_max_item_gross AND v_prod.id < v_max_item_id) THEN
            v_max_item_gross := v_item_gross;
            v_max_item_id := v_prod.id;
        END IF;
    END LOOP;

    -- 6. Validate Transaction Discount Bound
    IF p_discount_amount > v_total_gross_subtotal THEN
        RAISE EXCEPTION 'INVALID_DISCOUNT: transaction discount cannot exceed subtotal';
    END IF;

    -- 7. Pass 2: Calculate provisional Largest Remainder proportional discounts
    IF v_total_gross_subtotal > 0 AND p_discount_amount > 0 THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
            v_prod_id := (COALESCE(v_item->>'product_id', v_item->>'productId'))::UUID;
            v_qty := (v_item->>'quantity')::INTEGER;
            v_item_discount := COALESCE((COALESCE(v_item->>'item_discount', v_item->>'itemDiscount'))::BIGINT, 0);

            SELECT selling_price INTO v_prod FROM public.products WHERE id = v_prod_id AND business_id = p_business_id;
            v_item_gross := (v_qty::BIGINT * v_prod.selling_price) - v_item_discount;

            v_item_prop_disc := pg_catalog.round(
                (p_discount_amount::NUMERIC * v_item_gross::NUMERIC) / v_total_gross_subtotal::NUMERIC
            )::BIGINT;
            v_sum_allocated_disc := v_sum_allocated_disc + v_item_prop_disc;
        END LOOP;
        v_remainder := p_discount_amount - v_sum_allocated_disc;
    ELSE
        v_remainder := 0;
    END IF;

    -- 8. Create Sales Header
    v_total_amount := v_total_gross_subtotal - p_discount_amount;

    INSERT INTO public.sales (
        business_id, invoice_number, subtotal_amount, discount_amount,
        total_amount, payment_method, status, notes
    ) VALUES (
        p_business_id, pg_catalog.trim(p_invoice_number), v_total_gross_subtotal, p_discount_amount,
        v_total_amount, p_payment_method, 'COMPLETED', p_notes
    ) RETURNING id, transaction_date INTO v_sale_id, v_tx_date;

    -- 9. Pass 3: Insert Line Items, Decrement Product Stock & Record Stock Movements Ledger
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_prod_id := (COALESCE(v_item->>'product_id', v_item->>'productId'))::UUID;
        v_qty := (v_item->>'quantity')::INTEGER;
        v_item_discount := COALESCE((COALESCE(v_item->>'item_discount', v_item->>'itemDiscount'))::BIGINT, 0);

        SELECT id, name, selling_price, cost_price, stock_quantity
        INTO v_prod
        FROM public.products
        WHERE id = v_prod_id AND business_id = p_business_id;

        v_item_gross := (v_qty::BIGINT * v_prod.selling_price) - v_item_discount;

        IF v_total_gross_subtotal > 0 AND p_discount_amount > 0 THEN
            v_item_prop_disc := pg_catalog.round(
                (p_discount_amount::NUMERIC * v_item_gross::NUMERIC) / v_total_gross_subtotal::NUMERIC
            )::BIGINT;
            IF v_prod.id = v_max_item_id THEN
                v_item_prop_disc := v_item_prop_disc + v_remainder;
            END IF;
        ELSE
            v_item_prop_disc := 0;
        END IF;

        v_line_total_discount := v_item_discount + v_item_prop_disc;
        v_line_subtotal := (v_qty::BIGINT * v_prod.selling_price) - v_line_total_discount;

        -- Insert Sale Line Item with Immutable Snapshots
        INSERT INTO public.sale_items (
            sale_id, business_id, product_id, product_name_snapshot,
            unit_selling_price, unit_cost_price, quantity, discount_amount, subtotal_amount
        ) VALUES (
            v_sale_id, p_business_id, v_prod.id, v_prod.name,
            v_prod.selling_price, v_prod.cost_price, v_qty, v_line_total_discount, v_line_subtotal
        );

        -- Decrement Physical Inventory
        UPDATE public.products
        SET stock_quantity = stock_quantity - v_qty,
            updated_at = pg_catalog.timezone('utc'::pg_catalog.text, pg_catalog.now())
        WHERE id = v_prod.id;

        -- Record Audit Ledger Entry
        INSERT INTO public.stock_movements (
            business_id, product_id, movement_type, quantity_delta,
            previous_quantity, new_quantity, reference_id
        ) VALUES (
            p_business_id, v_prod.id, 'SALE', -v_qty,
            v_prod.stock_quantity, v_prod.stock_quantity - v_qty, v_sale_id
        );
    END LOOP;

    -- 10. Build Response & Save Idempotency Receipt
    v_final_response := jsonb_build_object(
        'sale_id', v_sale_id,
        'invoice_number', pg_catalog.trim(p_invoice_number),
        'subtotal_amount', v_total_gross_subtotal,
        'discount_amount', p_discount_amount,
        'total_amount', v_total_amount,
        'payment_method', p_payment_method,
        'transaction_date', v_tx_date,
        'items_count', jsonb_array_length(p_items)
    );

    IF p_idempotency_key IS NOT NULL AND pg_catalog.trim(p_idempotency_key) <> '' THEN
        INSERT INTO public.idempotency_keys (
            business_id, key, action_type, user_id, request_payload, response_payload
        ) VALUES (
            p_business_id, pg_catalog.trim(p_idempotency_key), 'RECORD_SALE', auth.uid(), v_req_payload, v_final_response
        );
    END IF;

    RETURN v_final_response;
END;
$$;

-- Restrict execution permissions to authenticated users and service_role
REVOKE EXECUTE ON FUNCTION public.record_sale_transaction(UUID, TEXT, TEXT, BIGINT, TEXT, JSONB, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_sale_transaction(UUID, TEXT, TEXT, BIGINT, TEXT, JSONB, TEXT) TO authenticated, service_role;

-- ============================================================================
-- 3. RPC: record_purchase_transaction
-- Atomically records inventory purchases restock, updates physical stock,
-- recalculates Moving Weighted Average Cost (MWAC), records immutable purchase items,
-- records stock movement ledger, and saves idempotency receipt.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_purchase_transaction(
    p_business_id UUID,
    p_invoice_number TEXT,
    p_supplier_name TEXT,
    p_notes TEXT,
    p_items JSONB,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_purchase_id UUID;
    v_purchase_date TIMESTAMPTZ;
    v_item JSONB;
    v_prod RECORD;
    v_prod_id_raw TEXT;
    v_prod_id UUID;
    v_qty INTEGER;
    v_cost BIGINT;
    v_line_cost BIGINT;
    v_total_cost BIGINT := 0;
    v_new_avg_cost BIGINT;

    -- Idempotency variables
    v_req_payload JSONB;
    v_idem_action VARCHAR(30);
    v_idem_user UUID;
    v_idem_req JSONB;
    v_idem_resp JSONB;
    v_final_response JSONB;
BEGIN
    -- 1. Authentication & Tenant Authorization Guard
    IF auth.uid() IS NULL OR NOT public.is_business_member(p_business_id) THEN
        RAISE EXCEPTION 'UNAUTHORIZED_BUSINESS';
    END IF;

    -- 2. Input Parameter Validations
    IF p_business_id IS NULL THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT: business_id is required';
    END IF;

    IF p_invoice_number IS NULL OR pg_catalog.char_length(pg_catalog.trim(p_invoice_number)) < 3 THEN
        RAISE EXCEPTION 'INVALID_INVOICE_NUMBER: invoice_number must be at least 3 characters';
    END IF;

    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'EMPTY_PURCHASE_ITEMS: at least one purchase item is required';
    END IF;

    -- 3. Idempotency Check
    v_req_payload := jsonb_build_object(
        'invoice_number', pg_catalog.trim(p_invoice_number),
        'supplier_name', p_supplier_name,
        'notes', p_notes,
        'items', p_items
    );

    IF p_idempotency_key IS NOT NULL AND pg_catalog.trim(p_idempotency_key) <> '' THEN
        IF pg_catalog.char_length(pg_catalog.trim(p_idempotency_key)) < 8 OR pg_catalog.char_length(p_idempotency_key) > 128 THEN
            RAISE EXCEPTION 'INVALID_IDEMPOTENCY_KEY: key length must be between 8 and 128 characters';
        END IF;

        SELECT action_type, user_id, request_payload, response_payload
        INTO v_idem_action, v_idem_user, v_idem_req, v_idem_resp
        FROM public.idempotency_keys
        WHERE business_id = p_business_id AND key = pg_catalog.trim(p_idempotency_key);

        IF FOUND THEN
            IF v_idem_action <> 'RECORD_PURCHASE' THEN
                RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_ACTION';
            END IF;
            IF v_idem_req IS DISTINCT FROM v_req_payload THEN
                RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD';
            END IF;
            RETURN v_idem_resp;
        END IF;
    END IF;

    -- 4. Deterministic Row Locking (Ascending by Product ID to prevent Deadlocks)
    PERFORM id FROM public.products
    WHERE business_id = p_business_id
      AND id IN (
          SELECT (COALESCE(item->>'product_id', item->>'productId'))::UUID
          FROM jsonb_array_elements(p_items) AS item
      )
    ORDER BY id ASC
    FOR UPDATE;

    -- 5. Pass 1: Validate items, verify tenant ownership, calculate total purchase cost
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_prod_id_raw := COALESCE(v_item->>'product_id', v_item->>'productId');
        IF v_prod_id_raw IS NULL THEN
            RAISE EXCEPTION 'INVALID_ARGUMENT: productId is required for each purchase item';
        END IF;
        v_prod_id := v_prod_id_raw::UUID;

        v_qty := (v_item->>'quantity')::INTEGER;
        IF v_qty IS NULL OR v_qty <= 0 THEN
            RAISE EXCEPTION 'INVALID_QUANTITY: purchase quantity must be greater than 0';
        END IF;

        v_cost := (COALESCE(v_item->>'unit_purchase_cost', v_item->>'unitPurchaseCost'))::BIGINT;
        IF v_cost IS NULL OR v_cost < 0 THEN
            RAISE EXCEPTION 'INVALID_PURCHASE_COST: unit_purchase_cost cannot be negative';
        END IF;

        SELECT id, name, stock_quantity, cost_price
        INTO v_prod
        FROM public.products
        WHERE id = v_prod_id AND business_id = p_business_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'PRODUCT_NOT_FOUND: %', v_prod_id;
        END IF;

        v_line_cost := v_qty::BIGINT * v_cost;
        v_total_cost := v_total_cost + v_line_cost;
    END LOOP;

    -- 6. Insert Purchase Header
    INSERT INTO public.inventory_purchases (
        business_id, invoice_number, supplier_name, total_cost, notes
    ) VALUES (
        p_business_id, pg_catalog.trim(p_invoice_number), p_supplier_name, v_total_cost, p_notes
    ) RETURNING id, purchase_date INTO v_purchase_id, v_purchase_date;

    -- 7. Pass 2: Insert Purchase Items, Increment Stock & Recalculate MWAC Cost Price
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_prod_id := (COALESCE(v_item->>'product_id', v_item->>'productId'))::UUID;
        v_qty := (v_item->>'quantity')::INTEGER;
        v_cost := (COALESCE(v_item->>'unit_purchase_cost', v_item->>'unitPurchaseCost'))::BIGINT;
        v_line_cost := v_qty::BIGINT * v_cost;

        SELECT id, name, stock_quantity, cost_price
        INTO v_prod
        FROM public.products
        WHERE id = v_prod_id AND business_id = p_business_id;

        -- Moving Weighted Average Cost (MWAC) Recalculation
        IF (v_prod.stock_quantity + v_qty) > 0 THEN
            v_new_avg_cost := pg_catalog.round(
                ((v_prod.stock_quantity::NUMERIC * v_prod.cost_price::NUMERIC) + (v_qty::NUMERIC * v_cost::NUMERIC))
                / (v_prod.stock_quantity + v_qty)::NUMERIC
            )::BIGINT;
        ELSE
            v_new_avg_cost := v_cost;
        END IF;

        -- Insert Purchase Line Item
        INSERT INTO public.purchase_items (
            purchase_id, business_id, product_id, product_name_snapshot,
            quantity, unit_purchase_cost, subtotal_cost
        ) VALUES (
            v_purchase_id, p_business_id, v_prod.id, v_prod.name,
            v_qty, v_cost, v_line_cost
        );

        -- Increment Physical Stock and Update Weighted Cost Price
        UPDATE public.products
        SET stock_quantity = stock_quantity + v_qty,
            cost_price = v_new_avg_cost,
            updated_at = pg_catalog.timezone('utc'::pg_catalog.text, pg_catalog.now())
        WHERE id = v_prod.id;

        -- Record Purchase Stock Movement
        INSERT INTO public.stock_movements (
            business_id, product_id, movement_type, quantity_delta,
            previous_quantity, new_quantity, reference_id
        ) VALUES (
            p_business_id, v_prod.id, 'PURCHASE', v_qty,
            v_prod.stock_quantity, v_prod.stock_quantity + v_qty, v_purchase_id
        );
    END LOOP;

    -- 8. Build Response & Save Idempotency Receipt
    v_final_response := jsonb_build_object(
        'purchase_id', v_purchase_id,
        'invoice_number', pg_catalog.trim(p_invoice_number),
        'total_cost', v_total_cost,
        'purchase_date', v_purchase_date,
        'items_count', jsonb_array_length(p_items)
    );

    IF p_idempotency_key IS NOT NULL AND pg_catalog.trim(p_idempotency_key) <> '' THEN
        INSERT INTO public.idempotency_keys (
            business_id, key, action_type, user_id, request_payload, response_payload
        ) VALUES (
            p_business_id, pg_catalog.trim(p_idempotency_key), 'RECORD_PURCHASE', auth.uid(), v_req_payload, v_final_response
        );
    END IF;

    RETURN v_final_response;
END;
$$;

-- Restrict execution permissions to authenticated users and service_role
REVOKE EXECUTE ON FUNCTION public.record_purchase_transaction(UUID, TEXT, TEXT, TEXT, JSONB, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_purchase_transaction(UUID, TEXT, TEXT, TEXT, JSONB, TEXT) TO authenticated, service_role;

-- ============================================================================
-- 4. RPC: void_sale_transaction
-- Atomically cancels a sale, validates minimum void reason length,
-- restores physical stock exactly once, records VOID_SALE stock movement,
-- retains historical unit HPP snapshot without retroactive recalculation,
-- and saves idempotency receipt.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.void_sale_transaction(
    p_business_id UUID,
    p_sale_id UUID,
    p_void_reason TEXT,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_sale RECORD;
    v_item RECORD;
    v_prod RECORD;
    v_voided_at TIMESTAMPTZ;

    -- Idempotency variables
    v_req_payload JSONB;
    v_idem_action VARCHAR(30);
    v_idem_user UUID;
    v_idem_req JSONB;
    v_idem_resp JSONB;
    v_final_response JSONB;
BEGIN
    -- 1. Authentication & Tenant Authorization Guard
    IF auth.uid() IS NULL OR NOT public.is_business_member(p_business_id) THEN
        RAISE EXCEPTION 'UNAUTHORIZED_BUSINESS';
    END IF;

    -- 2. Input Parameter Validations
    IF p_business_id IS NULL OR p_sale_id IS NULL THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT: business_id and sale_id are required';
    END IF;

    IF p_void_reason IS NULL OR pg_catalog.char_length(pg_catalog.trim(p_void_reason)) < 5 THEN
        RAISE EXCEPTION 'INVALID_VOID_REASON: void_reason must be at least 5 characters';
    END IF;

    -- 3. Idempotency Check
    v_req_payload := jsonb_build_object(
        'sale_id', p_sale_id,
        'void_reason', pg_catalog.trim(p_void_reason)
    );

    IF p_idempotency_key IS NOT NULL AND pg_catalog.trim(p_idempotency_key) <> '' THEN
        IF pg_catalog.char_length(pg_catalog.trim(p_idempotency_key)) < 8 OR pg_catalog.char_length(p_idempotency_key) > 128 THEN
            RAISE EXCEPTION 'INVALID_IDEMPOTENCY_KEY: key length must be between 8 and 128 characters';
        END IF;

        SELECT action_type, user_id, request_payload, response_payload
        INTO v_idem_action, v_idem_user, v_idem_req, v_idem_resp
        FROM public.idempotency_keys
        WHERE business_id = p_business_id AND key = pg_catalog.trim(p_idempotency_key);

        IF FOUND THEN
            IF v_idem_action <> 'VOID_SALE' THEN
                RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_ACTION';
            END IF;
            IF v_idem_req IS DISTINCT FROM v_req_payload THEN
                RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD';
            END IF;
            RETURN v_idem_resp;
        END IF;
    END IF;

    -- 4. Lock Sale Header (FOR UPDATE) & Validate Status
    SELECT * INTO v_sale
    FROM public.sales
    WHERE id = p_sale_id AND business_id = p_business_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'SALE_NOT_FOUND: %', p_sale_id;
    END IF;

    IF v_sale.status = 'VOIDED' THEN
        RAISE EXCEPTION 'SALE_ALREADY_VOIDED: sale % is already voided', p_sale_id;
    END IF;

    -- 5. Deterministic Row Locking on Related Products
    PERFORM id FROM public.products
    WHERE business_id = p_business_id
      AND id IN (
          SELECT product_id FROM public.sale_items WHERE sale_id = p_sale_id
      )
    ORDER BY id ASC
    FOR UPDATE;

    -- 6. Update Sale Header Status to VOIDED
    v_voided_at := pg_catalog.timezone('utc'::pg_catalog.text, pg_catalog.now());

    UPDATE public.sales
    SET status = 'VOIDED',
        void_reason = pg_catalog.trim(p_void_reason),
        voided_at = v_voided_at
    WHERE id = p_sale_id;

    -- 7. Restore Product Stock & Record VOID_SALE Movement Ledger
    -- Note: Products cost_price and sale_items unit_cost_price remain untouched.
    FOR v_item IN SELECT * FROM public.sale_items WHERE sale_id = p_sale_id LOOP
        SELECT id, stock_quantity
        INTO v_prod
        FROM public.products
        WHERE id = v_item.product_id AND business_id = p_business_id;

        -- Restore physical stock quantity
        UPDATE public.products
        SET stock_quantity = stock_quantity + v_item.quantity,
            updated_at = v_voided_at
        WHERE id = v_item.product_id;

        -- Record VOID_SALE Stock Movement
        INSERT INTO public.stock_movements (
            business_id, product_id, movement_type, quantity_delta,
            previous_quantity, new_quantity, reference_id, notes
        ) VALUES (
            p_business_id, v_item.product_id, 'VOID_SALE', v_item.quantity,
            v_prod.stock_quantity, v_prod.stock_quantity + v_item.quantity,
            p_sale_id, pg_catalog.trim(p_void_reason)
        );
    END LOOP;

    -- 8. Build Response & Save Idempotency Receipt
    v_final_response := jsonb_build_object(
        'sale_id', p_sale_id,
        'status', 'VOIDED',
        'voided_at', v_voided_at
    );

    IF p_idempotency_key IS NOT NULL AND pg_catalog.trim(p_idempotency_key) <> '' THEN
        INSERT INTO public.idempotency_keys (
            business_id, key, action_type, user_id, request_payload, response_payload
        ) VALUES (
            p_business_id, pg_catalog.trim(p_idempotency_key), 'VOID_SALE', auth.uid(), v_req_payload, v_final_response
        );
    END IF;

    RETURN v_final_response;
END;
$$;

-- Restrict execution permissions to authenticated users and service_role
REVOKE EXECUTE ON FUNCTION public.void_sale_transaction(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.void_sale_transaction(UUID, UUID, TEXT, TEXT) TO authenticated, service_role;
