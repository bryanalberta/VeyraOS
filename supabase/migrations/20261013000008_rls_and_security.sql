-- ============================================================================
-- VeyraOS Migration: 20261013000008_rls_and_security.sql
-- Description: Multi-tenant Row-Level Security (RLS) policies and least-privilege grants.
-- Dependencies: 20261013000001 through 20261013000007 (All 11 multi-tenant tables)
-- ============================================================================

-- ============================================================================
-- 1. SECURITY DEFINER HELPER FUNCTIONS
-- ============================================================================

-- Function: is_business_member(b_id UUID)
-- Purpose: Evaluates if the authenticated user is an active member of the specified business.
-- Hardening:
--   - SECURITY DEFINER allows querying business_members without triggering RLS recursion.
--   - SET search_path = '' eliminates search-path hijacking risks.
--   - STABLE allows query optimizer to cache results within the same transaction query.
--   - Explicit schema qualifications for all objects.
CREATE OR REPLACE FUNCTION public.is_business_member(b_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.business_members
    WHERE business_id = b_id
      AND user_id = auth.uid()
  );
$$;

-- Restrict execution of membership helper: only authenticated users and service_role
REVOKE EXECUTE ON FUNCTION public.is_business_member(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_business_member(UUID) TO authenticated, service_role;

-- ============================================================================
-- 2. ENABLE ROW-LEVEL SECURITY ON ALL TABLES
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. POLICIES: PROFILES TABLE
-- ============================================================================

CREATE POLICY "profiles_select_own"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- ============================================================================
-- 4. POLICIES: BUSINESSES TABLE
-- ============================================================================

CREATE POLICY "businesses_select_member"
ON public.businesses FOR SELECT
TO authenticated
USING (public.is_business_member(id));

CREATE POLICY "businesses_insert_owner"
ON public.businesses FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "businesses_update_owner"
ON public.businesses FOR UPDATE
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

-- ============================================================================
-- 5. POLICIES: BUSINESS_MEMBERS TABLE
-- ============================================================================

CREATE POLICY "business_members_select"
ON public.business_members FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_business_member(business_id));

-- Direct client INSERT, UPDATE, DELETE are forbidden.
-- Insertion is executed exclusively by the handle_new_business_owner() trigger.

-- ============================================================================
-- 6. POLICIES: PRODUCTS TABLE
-- ============================================================================

CREATE POLICY "products_select_member"
ON public.products FOR SELECT
TO authenticated
USING (public.is_business_member(business_id));

CREATE POLICY "products_insert_member"
ON public.products FOR INSERT
TO authenticated
WITH CHECK (public.is_business_member(business_id));

CREATE POLICY "products_update_member"
ON public.products FOR UPDATE
TO authenticated
USING (public.is_business_member(business_id))
WITH CHECK (public.is_business_member(business_id));

-- Direct client hard DELETE is forbidden (soft-archiving via is_archived = true).

-- ============================================================================
-- 7. POLICIES: SALES TABLE
-- ============================================================================

CREATE POLICY "sales_select_member"
ON public.sales FOR SELECT
TO authenticated
USING (public.is_business_member(business_id));

-- Direct client INSERT, UPDATE, DELETE are forbidden.
-- Sales creation is executed exclusively by the atomic RPC record_sale_transaction().
-- Sales cancellation is executed exclusively by the atomic RPC void_sale_transaction().

-- ============================================================================
-- 8. POLICIES: SALE_ITEMS TABLE
-- ============================================================================

CREATE POLICY "sale_items_select_member"
ON public.sale_items FOR SELECT
TO authenticated
USING (public.is_business_member(business_id));

-- Direct client INSERT, UPDATE, DELETE are forbidden.
-- Immutable line-item snapshots are created exclusively by the atomic RPC record_sale_transaction().

-- ============================================================================
-- 9. POLICIES: INVENTORY_PURCHASES TABLE
-- ============================================================================

CREATE POLICY "inventory_purchases_select_member"
ON public.inventory_purchases FOR SELECT
TO authenticated
USING (public.is_business_member(business_id));

-- Direct client INSERT, UPDATE, DELETE are forbidden.
-- Restock creation is executed exclusively by the atomic RPC record_purchase_transaction().

-- ============================================================================
-- 10. POLICIES: PURCHASE_ITEMS TABLE
-- ============================================================================

CREATE POLICY "purchase_items_select_member"
ON public.purchase_items FOR SELECT
TO authenticated
USING (public.is_business_member(business_id));

-- Direct client INSERT, UPDATE, DELETE are forbidden.
-- Line-item purchase snapshots are created exclusively by the atomic RPC record_purchase_transaction().

-- ============================================================================
-- 11. POLICIES: STOCK_MOVEMENTS TABLE (Immutable Audit Ledger)
-- ============================================================================

CREATE POLICY "stock_movements_select_member"
ON public.stock_movements FOR SELECT
TO authenticated
USING (public.is_business_member(business_id));

-- Direct client INSERT, UPDATE, DELETE are forbidden.
-- Audit movements are created exclusively by database triggers and atomic RPCs.

-- ============================================================================
-- 12. POLICIES: EXPENSES TABLE
-- ============================================================================

CREATE POLICY "expenses_select_member"
ON public.expenses FOR SELECT
TO authenticated
USING (public.is_business_member(business_id));

CREATE POLICY "expenses_insert_member"
ON public.expenses FOR INSERT
TO authenticated
WITH CHECK (public.is_business_member(business_id));

CREATE POLICY "expenses_update_member"
ON public.expenses FOR UPDATE
TO authenticated
USING (public.is_business_member(business_id))
WITH CHECK (public.is_business_member(business_id));

CREATE POLICY "expenses_delete_member"
ON public.expenses FOR DELETE
TO authenticated
USING (public.is_business_member(business_id));

-- ============================================================================
-- 13. POLICIES: IDEMPOTENCY_KEYS TABLE
-- ============================================================================

CREATE POLICY "idempotency_keys_select_member"
ON public.idempotency_keys FOR SELECT
TO authenticated
USING (public.is_business_member(business_id));

-- Direct client INSERT, UPDATE, DELETE are forbidden.
-- Keys and responses are recorded exclusively inside atomic RPCs.

-- ============================================================================
-- 14. SQL GRANTS & LEAST-PRIVILEGE ROLE RESTRICTIONS
-- ============================================================================

-- 14.1 Anonymous Role: Zero access to tenant data
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;

-- 14.2 Authenticated Role: Read access to all tables (filtered by RLS)
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;

-- 14.3 Authenticated Role: Allowed client-writable tables
GRANT INSERT, UPDATE ON public.profiles TO authenticated;
GRANT INSERT, UPDATE ON public.businesses TO authenticated;
GRANT INSERT, UPDATE ON public.products TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.expenses TO authenticated;

-- 14.4 Authenticated Role: Explicitly revoke writes on protected/ledger tables
REVOKE INSERT, UPDATE, DELETE ON public.business_members FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.sales FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.sale_items FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.inventory_purchases FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.purchase_items FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.stock_movements FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.idempotency_keys FROM authenticated;
