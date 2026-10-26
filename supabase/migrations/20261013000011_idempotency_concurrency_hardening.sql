-- ============================================================================
-- VeyraOS Migration: 20261013000011_idempotency_concurrency_hardening.sql
-- Status: PROPOSED FORWARD-ONLY MIGRATION (UNEXECUTED / BELUM DIJALANKAN)
-- Phase: Phase 4, Substage 3.2.1
-- Description:
--   Pengerasan konkurensi idempotensi pada tiga stored procedure transaksi atomik:
--   1. public.record_sale_transaction
--   2. public.record_purchase_transaction
--   3. public.void_sale_transaction
--
--   Peningkatan Kritis:
--   a. Transaction-scoped Advisory Lock (pg_advisory_xact_lock) berbasis hash
--      (business_id + idempotency_key) untuk men-serialize request yang tiba
--      pada milidetik yang sama sebelum melakukan pemeriksaan idempotency_keys.
--      Mencegah eksekusi ganda dan menghindari unhandled error 23505 pada klien kedua.
--   b. User Binding Validation: Memverifikasi auth.uid() = user_id pemilik kunci.
--      Jika pengguna lain mencoba menggunakan kunci yang sama, transaksi ditolak
--      dengan error IDEMPOTENCY_KEY_REUSED_BY_DIFFERENT_USER.
--
-- Dependencies: 20261013000009_stored_procedures.sql, 20261013000010_reconcile_discount_allocation.sql
-- Catatan Arsitektur:
--   File migrasi ini dibuat HANYA sebagai draf usulan forward-only.
--   File ini TIDAK DIJALANKAN pada database dan database TIDAK DI-RESET pada Substage 3.2.1.
-- ============================================================================

-- 1. REVISE: record_sale_transaction WITH ADVISORY LOCKING & USER BINDING
CREATE OR REPLACE FUNCTION public.record_sale_transaction(
    p_business_id UUID,
    p_invoice_number TEXT,
    p_payment_method VARCHAR(20),
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
    v_total_gross_subtotal BIGINT := 0;
    v_total_amount BIGINT;
    v_unassigned_remainders BIGINT := 0;
    v_base_quota_sum BIGINT := 0;
    v_has_duplicates BOOLEAN := FALSE;
    v_line_count INTEGER := 0;
    v_sub_quota_sum BIGINT := 0;
    v_sub_unassigned BIGINT := 0;
    v_prev_stock INTEGER := 0;

    v_item RECORD;
    v_prod RECORD;
    v_prod_disc RECORD;
    v_item_gross BIGINT;
    v_line_total_discount BIGINT;

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

    -- 3. Concurrent Idempotency Guard with Transaction-Scoped Advisory Locking
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

        -- Serialize concurrent executions with identical (business_id, key)
        PERFORM pg_catalog.pg_advisory_xact_lock(
            pg_catalog.hashtext(p_business_id::pg_catalog.text || ':' || pg_catalog.trim(p_idempotency_key))
        );

        SELECT action_type, user_id, request_payload, response_payload
        INTO v_idem_action, v_idem_user, v_idem_req, v_idem_resp
        FROM public.idempotency_keys
        WHERE business_id = p_business_id AND key = pg_catalog.trim(p_idempotency_key);

        IF FOUND THEN
            -- User binding check: must be used by the same authenticated user
            IF v_idem_user IS NOT NULL AND v_idem_user <> auth.uid() THEN
                RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED_BY_DIFFERENT_USER';
            END IF;
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

    -- 5. Pass 1: Agregasi kuantitas per produk dan validasi ketersediaan stok fisik
    FOR v_item IN 
        SELECT 
            (COALESCE(item->>'product_id', item->>'productId'))::UUID AS product_id,
            SUM((item->>'quantity')::INTEGER) AS total_qty
        FROM jsonb_array_elements(p_items) AS item
        GROUP BY 1
    LOOP
        SELECT id, name, selling_price, cost_price, stock_quantity
        INTO v_prod
        FROM public.products
        WHERE id = v_item.product_id AND business_id = p_business_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'PRODUCT_NOT_FOUND: %', v_item.product_id;
        END IF;

        IF v_prod.stock_quantity < v_item.total_qty THEN
            RAISE EXCEPTION 'STOCK_INSUFFICIENT: Produk "%" sisa %, diminta total %',
                v_prod.name, v_prod.stock_quantity, v_item.total_qty;
        END IF;
    END LOOP;

    -- 6. Pass 2: Validasi tiap baris dan hitung subtotal bruto
    CREATE TEMPORARY TABLE temp_sale_lines (
        line_idx INTEGER PRIMARY KEY,
        product_id UUID NOT NULL,
        quantity INTEGER NOT NULL,
        unit_selling_price BIGINT NOT NULL,
        unit_cost_price BIGINT NOT NULL,
        product_name TEXT NOT NULL,
        item_discount BIGINT NOT NULL,
        item_gross BIGINT NOT NULL,
        base_quota BIGINT DEFAULT 0,
        fractional_remainder BIGINT DEFAULT 0,
        allocated_discount BIGINT DEFAULT 0,
        net_subtotal BIGINT DEFAULT 0
    ) ON COMMIT DROP;

    FOR v_item IN 
        SELECT 
            ordinality::INTEGER AS line_idx,
            (COALESCE(value->>'product_id', value->>'productId'))::UUID AS product_id,
            (value->>'quantity')::INTEGER AS quantity,
            COALESCE((COALESCE(value->>'item_discount', value->>'itemDiscount'))::BIGINT, 0) AS item_discount
        FROM jsonb_array_elements(p_items) WITH ORDINALITY
    LOOP
        IF v_item.quantity <= 0 THEN
            RAISE EXCEPTION 'INVALID_QUANTITY: item quantity must be greater than 0';
        END IF;

        SELECT id, name, selling_price, cost_price INTO v_prod
        FROM public.products
        WHERE id = v_item.product_id AND business_id = p_business_id;

        IF v_item.item_discount < 0 OR v_item.item_discount > (v_item.quantity::BIGINT * v_prod.selling_price) THEN
            RAISE EXCEPTION 'INVALID_DISCOUNT: item discount exceeds item gross amount';
        END IF;

        v_item_gross := (v_item.quantity::BIGINT * v_prod.selling_price) - v_item_discount;
        v_total_gross_subtotal := v_total_gross_subtotal + v_item_gross;

        INSERT INTO temp_sale_lines (
            line_idx, product_id, quantity, unit_selling_price, unit_cost_price,
            product_name, item_discount, item_gross
        ) VALUES (
            v_item.line_idx, v_prod.id, v_item.quantity, v_prod.selling_price, v_prod.cost_price,
            v_prod.name, v_item.item_discount, v_item_gross
        );
    END LOOP;

    IF p_discount_amount > v_total_gross_subtotal THEN
        RAISE EXCEPTION 'INVALID_DISCOUNT: transaction discount cannot exceed subtotal';
    END IF;

    -- 7. Pass 3: Hamilton Method Calculation dengan Product Aggregation
    IF v_total_gross_subtotal > 0 AND p_discount_amount > 0 THEN
        SELECT (COUNT(DISTINCT product_id) < COUNT(*)) INTO v_has_duplicates FROM temp_sale_lines;

        IF NOT v_has_duplicates THEN
            UPDATE temp_sale_lines
            SET 
                base_quota = pg_catalog.floor((p_discount_amount::NUMERIC * item_gross::NUMERIC) / v_total_gross_subtotal::NUMERIC)::BIGINT,
                fractional_remainder = (p_discount_amount * item_gross) % v_total_gross_subtotal;

            SELECT COALESCE(SUM(base_quota), 0) INTO v_base_quota_sum FROM temp_sale_lines;
            v_unassigned_remainders := p_discount_amount - v_base_quota_sum;

            IF v_unassigned_remainders > 0 THEN
                WITH bonus_recipients AS (
                    SELECT line_idx
                    FROM temp_sale_lines
                    WHERE fractional_remainder > 0
                    ORDER BY fractional_remainder DESC, product_id ASC, line_idx ASC
                    LIMIT v_unassigned_remainders
                )
                UPDATE temp_sale_lines
                SET allocated_discount = base_quota + 1
                WHERE line_idx IN (SELECT line_idx FROM bonus_recipients);

                UPDATE temp_sale_lines
                SET allocated_discount = base_quota
                WHERE allocated_discount = 0;
            ELSE
                UPDATE temp_sale_lines SET allocated_discount = base_quota;
            END IF;
        ELSE
            CREATE TEMPORARY TABLE temp_product_discounts (
                product_id UUID PRIMARY KEY,
                total_gross BIGINT NOT NULL,
                base_quota BIGINT DEFAULT 0,
                fractional_remainder BIGINT DEFAULT 0,
                allocated_discount BIGINT DEFAULT 0
            ) ON COMMIT DROP;

            INSERT INTO temp_product_discounts (product_id, total_gross)
            SELECT product_id, SUM(item_gross)
            FROM temp_sale_lines
            GROUP BY product_id;

            UPDATE temp_product_discounts
            SET 
                base_quota = pg_catalog.floor((p_discount_amount::NUMERIC * total_gross::NUMERIC) / v_total_gross_subtotal::NUMERIC)::BIGINT,
                fractional_remainder = (p_discount_amount * total_gross) % v_total_gross_subtotal;

            SELECT COALESCE(SUM(base_quota), 0) INTO v_base_quota_sum FROM temp_product_discounts;
            v_unassigned_remainders := p_discount_amount - v_base_quota_sum;

            IF v_unassigned_remainders > 0 THEN
                WITH bonus_prods AS (
                    SELECT product_id
                    FROM temp_product_discounts
                    WHERE fractional_remainder > 0
                    ORDER BY fractional_remainder DESC, product_id ASC
                    LIMIT v_unassigned_remainders
                )
                UPDATE temp_product_discounts
                SET allocated_discount = base_quota + 1
                WHERE product_id IN (SELECT product_id FROM bonus_prods);

                UPDATE temp_product_discounts
                SET allocated_discount = base_quota
                WHERE allocated_discount = 0;
            ELSE
                UPDATE temp_product_discounts SET allocated_discount = base_quota;
            END IF;

            FOR v_prod_disc IN SELECT * FROM temp_product_discounts LOOP
                SELECT COUNT(*) INTO v_line_count 
                FROM temp_sale_lines 
                WHERE product_id = v_prod_disc.product_id;

                IF v_line_count = 1 THEN
                    UPDATE temp_sale_lines
                    SET allocated_discount = v_prod_disc.allocated_discount
                    WHERE product_id = v_prod_disc.product_id;
                ELSE
                    IF v_prod_disc.allocated_discount > 0 AND v_prod_disc.total_gross > 0 THEN
                        UPDATE temp_sale_lines
                        SET 
                            base_quota = pg_catalog.floor((v_prod_disc.allocated_discount::NUMERIC * item_gross::NUMERIC) / v_prod_disc.total_gross::NUMERIC)::BIGINT,
                            fractional_remainder = (v_prod_disc.allocated_discount * item_gross) % v_prod_disc.total_gross
                        WHERE product_id = v_prod_disc.product_id;

                        SELECT COALESCE(SUM(base_quota), 0) INTO v_sub_quota_sum 
                        FROM temp_sale_lines WHERE product_id = v_prod_disc.product_id;

                        v_sub_unassigned := v_prod_disc.allocated_discount - v_sub_quota_sum;

                        IF v_sub_unassigned > 0 THEN
                            WITH sub_bonus AS (
                                SELECT line_idx
                                FROM temp_sale_lines
                                WHERE product_id = v_prod_disc.product_id AND fractional_remainder > 0
                                ORDER BY fractional_remainder DESC, line_idx ASC
                                LIMIT v_sub_unassigned
                            )
                            UPDATE temp_sale_lines
                            SET allocated_discount = base_quota + 1
                            WHERE line_idx IN (SELECT line_idx FROM sub_bonus);

                            UPDATE temp_sale_lines
                            SET allocated_discount = base_quota
                            WHERE product_id = v_prod_disc.product_id AND allocated_discount = 0;
                        ELSE
                            UPDATE temp_sale_lines
                            SET allocated_discount = base_quota
                            WHERE product_id = v_prod_disc.product_id;
                        END IF;
                    ELSE
                        UPDATE temp_sale_lines
                        SET allocated_discount = 0
                        WHERE product_id = v_prod_disc.product_id;
                    END IF;
                END IF;
            END LOOP;
        END IF;
    ELSE
        UPDATE temp_sale_lines SET allocated_discount = 0;
    END IF;

    UPDATE temp_sale_lines
    SET net_subtotal = item_gross - allocated_discount;

    -- 8. Create Sales Header
    v_total_amount := v_total_gross_subtotal - p_discount_amount;

    INSERT INTO public.sales (
        business_id, invoice_number, subtotal_amount, discount_amount,
        total_amount, payment_method, status, notes
    ) VALUES (
        p_business_id, pg_catalog.trim(p_invoice_number), v_total_gross_subtotal, p_discount_amount,
        v_total_amount, p_payment_method, 'COMPLETED', p_notes
    ) RETURNING id, transaction_date INTO v_sale_id, v_tx_date;

    -- 9. Pass 4: Insert Line Items, Decrement Physical Stock, Record Stock Ledger
    FOR v_item IN SELECT * FROM temp_sale_lines ORDER BY line_idx ASC LOOP
        v_line_total_discount := v_item.item_discount + v_item.allocated_discount;

        INSERT INTO public.sale_items (
            sale_id, business_id, product_id, product_name_snapshot,
            unit_selling_price, unit_cost_price, quantity, discount_amount, subtotal_amount
        ) VALUES (
            v_sale_id, p_business_id, v_item.product_id, v_item.product_name,
            v_item.unit_selling_price, v_item.unit_cost_price, v_item.quantity,
            v_line_total_discount, v_item.net_subtotal
        );

        SELECT stock_quantity INTO v_prev_stock 
        FROM public.products 
        WHERE id = v_item.product_id;

        UPDATE public.products
        SET stock_quantity = stock_quantity - v_item.quantity,
            updated_at = pg_catalog.timezone('utc'::pg_catalog.text, pg_catalog.now())
        WHERE id = v_item.product_id;

        INSERT INTO public.stock_movements (
            business_id, product_id, movement_type, quantity_delta,
            previous_quantity, new_quantity, reference_id
        ) VALUES (
            p_business_id, v_item.product_id, 'SALE', -v_item.quantity,
            v_prev_stock, v_prev_stock - v_item.quantity, v_sale_id
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

-- 2. REVISE: record_purchase_transaction WITH ADVISORY LOCKING & USER BINDING
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
    v_prod_id UUID;
    v_qty INTEGER;
    v_cost BIGINT;
    v_line_cost BIGINT;
    v_total_cost BIGINT := 0;
    v_new_avg_cost BIGINT;

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

    -- 3. Concurrent Idempotency Guard with Transaction-Scoped Advisory Locking
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

        PERFORM pg_catalog.pg_advisory_xact_lock(
            pg_catalog.hashtext(p_business_id::pg_catalog.text || ':' || pg_catalog.trim(p_idempotency_key))
        );

        SELECT action_type, user_id, request_payload, response_payload
        INTO v_idem_action, v_idem_user, v_idem_req, v_idem_resp
        FROM public.idempotency_keys
        WHERE business_id = p_business_id AND key = pg_catalog.trim(p_idempotency_key);

        IF FOUND THEN
            IF v_idem_user IS NOT NULL AND v_idem_user <> auth.uid() THEN
                RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED_BY_DIFFERENT_USER';
            END IF;
            IF v_idem_action <> 'RECORD_PURCHASE' THEN
                RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_ACTION';
            END IF;
            IF v_idem_req IS DISTINCT FROM v_req_payload THEN
                RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD';
            END IF;
            RETURN v_idem_resp;
        END IF;
    END IF;

    -- 4. Deterministic Row Locking (Ascending by Product ID)
    PERFORM id FROM public.products
    WHERE business_id = p_business_id
      AND id IN (
          SELECT (COALESCE(item->>'product_id', item->>'productId'))::UUID
          FROM jsonb_array_elements(p_items) AS item
      )
    ORDER BY id ASC
    FOR UPDATE;

    -- 5. Calculate Total Cost
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_prod_id := (COALESCE(v_item->>'product_id', v_item->>'productId'))::UUID;
        v_qty := (v_item->>'quantity')::INTEGER;
        v_cost := (COALESCE(v_item->>'unit_purchase_cost', v_item->>'unitPurchaseCost'))::BIGINT;

        IF v_qty <= 0 THEN
            RAISE EXCEPTION 'INVALID_QUANTITY: purchase quantity must be greater than 0';
        END IF;
        IF v_cost < 0 THEN
            RAISE EXCEPTION 'INVALID_PURCHASE_COST: unit_purchase_cost cannot be negative';
        END IF;

        SELECT id, name, selling_price, cost_price, stock_quantity
        INTO v_prod
        FROM public.products
        WHERE id = v_prod_id AND business_id = p_business_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'PRODUCT_NOT_FOUND: %', v_prod_id;
        END IF;

        v_line_cost := v_qty::BIGINT * v_cost;
        v_total_cost := v_total_cost + v_line_cost;
    END LOOP;

    -- 6. Insert Inventory Purchase Header
    INSERT INTO public.inventory_purchases (
        business_id, invoice_number, supplier_name, total_cost, notes
    ) VALUES (
        p_business_id, pg_catalog.trim(p_invoice_number), p_supplier_name, v_total_cost, p_notes
    ) RETURNING id, purchase_date INTO v_purchase_id, v_purchase_date;

    -- 7. Insert Purchase Items & Recalculate MWAC
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_prod_id := (COALESCE(v_item->>'product_id', v_item->>'productId'))::UUID;
        v_qty := (v_item->>'quantity')::INTEGER;
        v_cost := (COALESCE(v_item->>'unit_purchase_cost', v_item->>'unitPurchaseCost'))::BIGINT;

        SELECT id, name, selling_price, cost_price, stock_quantity
        INTO v_prod
        FROM public.products
        WHERE id = v_prod_id AND business_id = p_business_id;

        v_line_cost := v_qty::BIGINT * v_cost;

        IF v_prod.stock_quantity <= 0 THEN
            v_new_avg_cost := v_cost;
        ELSE
            v_new_avg_cost := pg_catalog.round(
                ((v_prod.stock_quantity::BIGINT * v_prod.cost_price::BIGINT + v_qty::BIGINT * v_cost)::NUMERIC) /
                (v_prod.stock_quantity + v_qty)::NUMERIC
            )::BIGINT;
        END IF;

        INSERT INTO public.purchase_items (
            purchase_id, business_id, product_id, product_name_snapshot,
            quantity, unit_purchase_cost, subtotal_cost
        ) VALUES (
            v_purchase_id, p_business_id, v_prod.id, v_prod.name,
            v_qty, v_cost, v_line_cost
        );

        UPDATE public.products
        SET stock_quantity = stock_quantity + v_qty,
            cost_price = v_new_avg_cost,
            updated_at = pg_catalog.timezone('utc'::pg_catalog.text, pg_catalog.now())
        WHERE id = v_prod.id;

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

-- 3. REVISE: void_sale_transaction WITH ADVISORY LOCKING & USER BINDING
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

    IF p_sale_id IS NULL THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT: sale_id is required';
    END IF;

    IF p_void_reason IS NULL OR pg_catalog.char_length(pg_catalog.trim(p_void_reason)) < 5 THEN
        RAISE EXCEPTION 'INVALID_VOID_REASON: void_reason must be at least 5 characters';
    END IF;

    -- 3. Concurrent Idempotency Guard with Transaction-Scoped Advisory Locking
    v_req_payload := jsonb_build_object(
        'sale_id', p_sale_id,
        'void_reason', pg_catalog.trim(p_void_reason)
    );

    IF p_idempotency_key IS NOT NULL AND pg_catalog.trim(p_idempotency_key) <> '' THEN
        IF pg_catalog.char_length(pg_catalog.trim(p_idempotency_key)) < 8 OR pg_catalog.char_length(p_idempotency_key) > 128 THEN
            RAISE EXCEPTION 'INVALID_IDEMPOTENCY_KEY: key length must be between 8 and 128 characters';
        END IF;

        PERFORM pg_catalog.pg_advisory_xact_lock(
            pg_catalog.hashtext(p_business_id::pg_catalog.text || ':' || pg_catalog.trim(p_idempotency_key))
        );

        SELECT action_type, user_id, request_payload, response_payload
        INTO v_idem_action, v_idem_user, v_idem_req, v_idem_resp
        FROM public.idempotency_keys
        WHERE business_id = p_business_id AND key = pg_catalog.trim(p_idempotency_key);

        IF FOUND THEN
            IF v_idem_user IS NOT NULL AND v_idem_user <> auth.uid() THEN
                RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED_BY_DIFFERENT_USER';
            END IF;
            IF v_idem_action <> 'VOID_SALE' THEN
                RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_ACTION';
            END IF;
            IF v_idem_req IS DISTINCT FROM v_req_payload THEN
                RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD';
            END IF;
            RETURN v_idem_resp;
        END IF;
    END IF;

    -- 4. Lock Sales Header (FOR UPDATE) & Validate Status
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

    -- 5. Deterministic Row Locking on Products involved
    PERFORM id FROM public.products
    WHERE business_id = p_business_id
      AND id IN (
          SELECT product_id FROM public.sale_items WHERE sale_id = p_sale_id
      )
    ORDER BY id ASC
    FOR UPDATE;

    -- 6. Mark Sales Header as VOIDED
    v_voided_at := pg_catalog.timezone('utc'::pg_catalog.text, pg_catalog.now());

    UPDATE public.sales
    SET status = 'VOIDED',
        void_reason = pg_catalog.trim(p_void_reason),
        voided_at = v_voided_at
    WHERE id = p_sale_id;

    -- 7. Restore Stock Exactly Once & Log Reversal Stock Movement
    FOR v_item IN SELECT * FROM public.sale_items WHERE sale_id = p_sale_id LOOP
        SELECT id, stock_quantity INTO v_prod
        FROM public.products
        WHERE id = v_item.product_id AND business_id = p_business_id;

        UPDATE public.products
        SET stock_quantity = stock_quantity + v_item.quantity,
            updated_at = v_voided_at
        WHERE id = v_item.product_id;

        INSERT INTO public.stock_movements (
            business_id, product_id, movement_type, quantity_delta,
            previous_quantity, new_quantity, reference_id
        ) VALUES (
            p_business_id, v_item.product_id, 'VOID_SALE', v_item.quantity,
            v_prod.stock_quantity, v_prod.stock_quantity + v_item.quantity, p_sale_id
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

REVOKE EXECUTE ON FUNCTION public.record_sale_transaction(UUID, TEXT, VARCHAR(20), BIGINT, TEXT, JSONB, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_sale_transaction(UUID, TEXT, VARCHAR(20), BIGINT, TEXT, JSONB, TEXT) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.record_purchase_transaction(UUID, TEXT, TEXT, TEXT, JSONB, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_purchase_transaction(UUID, TEXT, TEXT, TEXT, JSONB, TEXT) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.void_sale_transaction(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.void_sale_transaction(UUID, UUID, TEXT, TEXT) TO authenticated, service_role;
