/**
 * VeyraOS Service Layer — Shared Authorization & Business Membership Guard
 *
 * Menerapkan verifikasi otorisasi sesi dan keanggotaan bisnis di sisi server
 * (Layer 2 Defense-in-Depth) yang konsisten di seluruh service domain.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApiResponse } from "@/types/api";
import { mapDatabaseErrorToApiResponse } from "@/services/transactions/error-mapper";

export interface AuthVerificationResult {
  userId: string;
}

/**
 * Helper untuk verifikasi autentikasi sesi dan keanggotaan bisnis pengguna.
 *
 * Aturan Keamanan:
 * 1. Tidak mempercayai businessId dari klien sebagai bukti otorisasi mutlak.
 * 2. Memeriksa auth.getUser() untuk memastikan sesi aktif dan valid.
 * 3. Memverifikasi keanggotaan pengguna pada tabel business_members untuk businessId target.
 */
export async function verifyUserAndBusinessMembership(
  supabase: SupabaseClient,
  businessId: string,
  explicitUserId?: string
): Promise<
  | { success: true; userId: string }
  | { success: false; response: ApiResponse<never> }
> {
  let userId = explicitUserId;

  if (!userId) {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      return {
        success: false,
        response: {
          success: false,
          error: {
            code: "UNAUTHENTICATED",
            message: "Pengguna belum terautentikasi atau sesi login telah berakhir",
          },
        },
      };
    }
    userId = authData.user.id;
  }

  // Verifikasi keanggotaan bisnis pada tabel business_members
  const { data: member, error: memberError } = await supabase
    .from("business_members")
    .select("role")
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .maybeSingle();

  if (memberError) {
    return {
      success: false,
      response: mapDatabaseErrorToApiResponse(memberError),
    };
  }

  if (!member) {
    return {
      success: false,
      response: {
        success: false,
        error: {
          code: "UNAUTHORIZED_BUSINESS",
          message: "Pengguna tidak terdaftar sebagai anggota pada bisnis ini",
        },
      },
    };
  }

  return { success: true, userId };
}
