/**
 * VeyraOS Layer 2 Authorization Guards & Multi-Tenant Security Engine
 *
 * Implements client and server-action authorization validations matching
 * the database RLS policies defined in docs/security-and-rls.md.
 */

export type TableName =
  | "profiles"
  | "businesses"
  | "business_members"
  | "products"
  | "sales"
  | "sale_items"
  | "inventory_purchases"
  | "purchase_items"
  | "stock_movements"
  | "expenses"
  | "idempotency_keys";

export type Action = "SELECT" | "INSERT" | "UPDATE" | "DELETE";

export interface BusinessMembership {
  businessId: string;
  userId: string;
  role: "OWNER";
}

/**
 * Access control matrix matching PostgreSQL RLS & table privilege grants
 */
export const CLIENT_PERMITTED_ACTIONS: Record<TableName, ReadonlySet<Action>> = {
  profiles: new Set(["SELECT", "INSERT", "UPDATE"]),
  businesses: new Set(["SELECT", "INSERT", "UPDATE"]),
  business_members: new Set(["SELECT"]), // Direct INSERT/UPDATE/DELETE forbidden for clients
  products: new Set(["SELECT", "INSERT", "UPDATE"]), // Hard DELETE forbidden (soft-archiving)
  sales: new Set(["SELECT"]), // Write operations exclusive to atomic RPCs
  sale_items: new Set(["SELECT"]), // Write operations exclusive to atomic RPCs
  inventory_purchases: new Set(["SELECT"]), // Write operations exclusive to atomic RPCs
  purchase_items: new Set(["SELECT"]), // Write operations exclusive to atomic RPCs
  stock_movements: new Set(["SELECT"]), // Write operations exclusive to atomic RPCs
  expenses: new Set(["SELECT", "INSERT", "UPDATE", "DELETE"]),
  idempotency_keys: new Set(["SELECT"]), // Direct client write forbidden
};

/**
 * Validates whether the user is an authorized member of the target business.
 */
export function isUserBusinessMember(
  memberships: BusinessMembership[],
  businessId: string,
  userId: string
): boolean {
  if (!businessId || !userId) return false;
  return memberships.some(
    (m) => m.businessId === businessId && m.userId === userId
  );
}

/**
 * Validates whether a direct client operation is permitted on a table.
 * Protected ledger tables reject direct writes and mandate atomic RPC procedures.
 */
export function canPerformDirectClientAction(
  table: TableName,
  action: Action
): boolean {
  return CLIENT_PERMITTED_ACTIONS[table]?.has(action) ?? false;
}

/**
 * Validates that an operation payload does not inject a cross-tenant business ID.
 */
export function validateTenantRelationship(
  headerBusinessId: string,
  itemBusinessId: string
): boolean {
  if (!headerBusinessId || !itemBusinessId) return false;
  return headerBusinessId === itemBusinessId;
}

/**
 * Enforces role elevation protection: regular clients cannot assign or modify membership roles.
 */
export function validateRoleAssignment(
  newRole: string,
  isServerTrigger: boolean
): boolean {
  if (!isServerTrigger) {
    // Clients cannot directly assign or elevate roles
    return false;
  }
  return newRole === "OWNER";
}
