import { describe, expect, it } from "vitest";
import {
  canPerformDirectClientAction,
  CLIENT_PERMITTED_ACTIONS,
  isUserBusinessMember,
  validateRoleAssignment,
  validateTenantRelationship,
  type Action,
  type BusinessMembership,
  type TableName,
} from "./security";

describe("Layer 2 Multi-Tenant Authorization Guards (src/lib/security.ts)", () => {
  const userA = "user-uuid-1111-aaaa";
  const userB = "user-uuid-2222-bbbb";
  const nonMember = "user-uuid-9999-xxxx";

  const businessA = "biz-uuid-aaaa-1111";
  const businessB = "biz-uuid-bbbb-2222";

  const activeMemberships: BusinessMembership[] = [
    { businessId: businessA, userId: userA, role: "OWNER" },
    { businessId: businessB, userId: userB, role: "OWNER" },
  ];

  describe("1. Business Membership Validation (isUserBusinessMember)", () => {
    it("SEC-UNIT-01: mengizinkan anggota bisnis yang sah untuk mengakses bisnisnya", () => {
      const isMemberA = isUserBusinessMember(activeMemberships, businessA, userA);
      const isMemberB = isUserBusinessMember(activeMemberships, businessB, userB);

      expect(isMemberA).toBe(true);
      expect(isMemberB).toBe(true);
    });

    it("SEC-UNIT-02: menolak pengguna nonanggota", () => {
      const isMember = isUserBusinessMember(activeMemberships, businessA, nonMember);
      expect(isMember).toBe(false);
    });

    it("SEC-UNIT-03: menolak akses silang tenant saat user A mencoba mengakses bisnis B", () => {
      // User A adalah pemilik sah bisnis A, tetapi BUKAN anggota bisnis B
      const canAccessTenantB = isUserBusinessMember(activeMemberships, businessB, userA);
      expect(canAccessTenantB).toBe(false);
    });

    it("SEC-UNIT-04: aman secara default terhadap input kosong, undefined, atau null", () => {
      expect(isUserBusinessMember([], businessA, userA)).toBe(false);
      expect(isUserBusinessMember(activeMemberships, "", userA)).toBe(false);
      expect(isUserBusinessMember(activeMemberships, businessA, "")).toBe(false);
      expect(isUserBusinessMember(activeMemberships, "invalid-uuid", userA)).toBe(false);
    });
  });

  describe("2. Cross-Tenant ID Tampering Prevention (validateTenantRelationship)", () => {
    it("SEC-UNIT-05: menyetujui transaksi jika header dan line item memiliki business_id yang sama", () => {
      const isValid = validateTenantRelationship(businessA, businessA);
      expect(isValid).toBe(true);
    });

    it("SEC-UNIT-06: menolak serangan manipulasi ID jika header bisnis A dipasangkan dengan produk bisnis B", () => {
      const isCrossTenantAttempt = validateTenantRelationship(businessA, businessB);
      expect(isCrossTenantAttempt).toBe(false);
    });

    it("SEC-UNIT-07: menolak jika salah satu business_id kosong atau tidak terdefinisi", () => {
      expect(validateTenantRelationship("", businessA)).toBe(false);
      expect(validateTenantRelationship(businessA, "")).toBe(false);
    });
  });

  describe("3. Role Escalation Protection (validateRoleAssignment)", () => {
    it("SEC-UNIT-08: menolak upaya klien langsung untuk menetapkan role", () => {
      // Klien (isServerTrigger = false) dilarang menetapkan role apa pun
      const clientAssignment = validateRoleAssignment("OWNER", false);
      expect(clientAssignment).toBe(false);
    });

    it("SEC-UNIT-09: mengizinkan trigger server internal untuk menetapkan role OWNER", () => {
      // Trigger internal pendaftaran owner (isServerTrigger = true) diizinkan
      const triggerAssignment = validateRoleAssignment("OWNER", true);
      expect(triggerAssignment).toBe(true);
    });

    it("SEC-UNIT-10: menolak penetapan role tidak sah meskipun dipanggil oleh server", () => {
      const invalidRole = validateRoleAssignment("SUPERADMIN", true);
      expect(invalidRole).toBe(false);
    });
  });

  describe("4. Direct Client Table Mutation Matrix (canPerformDirectClientAction)", () => {
    const protectedLedgerTables: TableName[] = [
      "business_members",
      "sales",
      "sale_items",
      "inventory_purchases",
      "purchase_items",
      "stock_movements",
      "idempotency_keys",
    ];

    it.each(protectedLedgerTables)(
      "SEC-UNIT-11: menolak penulisan langsung (INSERT) klien pada tabel terproteksi %s",
      (table) => {
        const canInsert = canPerformDirectClientAction(table, "INSERT");
        expect(canInsert).toBe(false);
      }
    );

    it.each(protectedLedgerTables)(
      "SEC-UNIT-12: menolak perubahan langsung (UPDATE) klien pada tabel terproteksi %s",
      (table) => {
        const canUpdate = canPerformDirectClientAction(table, "UPDATE");
        expect(canUpdate).toBe(false);
      }
    );

    it.each(protectedLedgerTables)(
      "SEC-UNIT-13: menolak penghapusan langsung (DELETE) klien pada tabel terproteksi %s",
      (table) => {
        const canDelete = canPerformDirectClientAction(table, "DELETE");
        expect(canDelete).toBe(false);
      }
    );

    it("SEC-UNIT-14: mengizinkan pembacaan (SELECT) pada seluruh tabel yang terdefinisi", () => {
      const allTables = Object.keys(CLIENT_PERMITTED_ACTIONS) as TableName[];
      for (const table of allTables) {
        expect(canPerformDirectClientAction(table, "SELECT")).toBe(true);
      }
    });

    it("SEC-UNIT-15: mengizinkan penulisan pada tabel operasional bisnis yang sah (expenses)", () => {
      expect(canPerformDirectClientAction("expenses", "INSERT")).toBe(true);
      expect(canPerformDirectClientAction("expenses", "UPDATE")).toBe(true);
      expect(canPerformDirectClientAction("expenses", "DELETE")).toBe(true);
    });

    it("SEC-UNIT-16: melarang hard DELETE pada produk (hanya soft-archiving)", () => {
      expect(canPerformDirectClientAction("products", "DELETE")).toBe(false);
      expect(canPerformDirectClientAction("products", "UPDATE")).toBe(true);
    });

    it("SEC-UNIT-17: menolak aksi yang tidak dikenali atau tabel tidak terdaftar secara default", () => {
      expect(canPerformDirectClientAction("products", "EXECUTE" as unknown as Action)).toBe(false);
      expect(canPerformDirectClientAction("unknown_table" as unknown as TableName, "SELECT")).toBe(false);
    });
  });
});
