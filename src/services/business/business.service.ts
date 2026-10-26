/**
 * VeyraOS Service Layer — Business Profile & Tenant Context Service
 *
 * Mengelola identitas profil pengguna, manajemen entitas bisnis, dan penyedia
 * konteks tenant server-authoritative (Layer 2 Defense-in-Depth).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  createBusinessSchema,
  updateBusinessSchema,
  updateProfileSchema,
} from "@/lib/validations";
import { uuidSchema } from "@/lib/validations/common";
import type {
  ApiResponse,
  UserProfileResponseData,
  UpdateProfileInput,
  CreateBusinessInput,
  UpdateBusinessInput,
  BusinessResponseData,
  TenantContextResponse,
} from "@/types/api";
import type { ProfileRow, BusinessRow } from "@/types/database";
import { mapDatabaseErrorToApiResponse } from "@/services/transactions/error-mapper";
import { verifyUserAndBusinessMembership } from "@/services/common/auth-guard";

export interface BusinessServiceOptions {
  supabase?: SupabaseClient;
  userId?: string;
}

const PROFILE_SELECT_COLUMNS = "id, full_name, email, created_at, updated_at";
const BUSINESS_SELECT_COLUMNS =
  "id, owner_id, name, category, phone, address, currency_code, timezone, created_at, updated_at";

export function mapProfileRowToResponse(
  row: ProfileRow
): UserProfileResponseData {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapBusinessRowToResponse(
  row: BusinessRow
): BusinessResponseData {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    category: row.category,
    phone: row.phone,
    address: row.address,
    currencyCode: row.currency_code,
    timezone: row.timezone,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * 1. Mengambil Profil Pengguna yang Terautentikasi (getUserProfile)
 */
export async function getUserProfile(
  options?: BusinessServiceOptions
): Promise<ApiResponse<UserProfileResponseData>> {
  const supabase = options?.supabase ?? (await createClient());

  let userId = options?.userId;
  if (!userId) {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      return {
        success: false,
        error: {
          code: "UNAUTHENTICATED",
          message: "Pengguna belum terautentikasi atau sesi login telah berakhir",
        },
      };
    }
    userId = authData.user.id;
  }

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select(PROFILE_SELECT_COLUMNS)
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      return mapDatabaseErrorToApiResponse(error);
    }

    if (!data) {
      return {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Profil pengguna tidak ditemukan",
        },
      };
    }

    return {
      success: true,
      data: mapProfileRowToResponse(data as unknown as ProfileRow),
    };
  } catch (err) {
    return mapDatabaseErrorToApiResponse(err);
  }
}

/**
 * 2. Memperbarui Profil Pengguna dengan Whitelist fullName (updateUserProfile)
 *
 * Field id, email, created_at, updated_at bersifat immutable dan dilindungi.
 */
export async function updateUserProfile(
  input: UpdateProfileInput,
  options?: BusinessServiceOptions
): Promise<ApiResponse<UserProfileResponseData>> {
  const validationResult = updateProfileSchema.safeParse(input);
  if (!validationResult.success) {
    const errorDetails: Record<string, string[]> = {};
    for (const issue of validationResult.error.issues) {
      const field = issue.path.join(".") || "fullName";
      if (!errorDetails[field]) errorDetails[field] = [];
      errorDetails[field].push(issue.message);
    }
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Format data pembaruan profil tidak valid",
        details: errorDetails,
      },
    };
  }

  const validated = validationResult.data;
  const supabase = options?.supabase ?? (await createClient());

  let userId = options?.userId;
  if (!userId) {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      return {
        success: false,
        error: {
          code: "UNAUTHENTICATED",
          message: "Pengguna belum terautentikasi atau sesi login telah berakhir",
        },
      };
    }
    userId = authData.user.id;
  }

  try {
    // Whitelist ketat: Hanya mengizinkan pembaruan full_name
    const { data, error } = await supabase
      .from("profiles")
      .update({ full_name: validated.fullName })
      .eq("id", userId)
      .select(PROFILE_SELECT_COLUMNS)
      .maybeSingle();

    if (error) {
      return mapDatabaseErrorToApiResponse(error);
    }

    if (!data) {
      return {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Profil pengguna tidak ditemukan saat memperbarui data",
        },
      };
    }

    return {
      success: true,
      data: mapProfileRowToResponse(data as unknown as ProfileRow),
    };
  } catch (err) {
    return mapDatabaseErrorToApiResponse(err);
  }
}

/**
 * 3. Membuat Bisnis Baru dengan Validasi Awal Batas 5 Bisnis (createBusiness)
 *
 * Catatan Keamanan: Pemeriksaan count < 5 adalah validasi awal Lapis 2 di service layer.
 * Konsistensi konkurensi mutlak di tingkat database merupakan readiness gate terpisah.
 */
export async function createBusiness(
  input: CreateBusinessInput,
  options?: BusinessServiceOptions
): Promise<ApiResponse<BusinessResponseData>> {
  const validationResult = createBusinessSchema.safeParse(input);
  if (!validationResult.success) {
    const errorDetails: Record<string, string[]> = {};
    for (const issue of validationResult.error.issues) {
      const field = issue.path.join(".") || "business";
      if (!errorDetails[field]) errorDetails[field] = [];
      errorDetails[field].push(issue.message);
    }
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Format data pembuatan bisnis tidak valid",
        details: errorDetails,
      },
    };
  }

  const validated = validationResult.data;
  const supabase = options?.supabase ?? (await createClient());

  let userId = options?.userId;
  if (!userId) {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      return {
        success: false,
        error: {
          code: "UNAUTHENTICATED",
          message: "Pengguna belum terautentikasi atau sesi login telah berakhir",
        },
      };
    }
    userId = authData.user.id;
  }

  try {
    // Pemeriksaan awal kuota bisnis (maksimal 5 bisnis per pengguna pada MVP)
    const { count, error: countError } = await supabase
      .from("businesses")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId);

    if (countError) {
      return mapDatabaseErrorToApiResponse(countError);
    }

    if ((count ?? 0) >= 5) {
      return {
        success: false,
        error: {
          code: "BUSINESS_LIMIT_REACHED",
          message:
            "Batas maksimal bisnis untuk akun MVP telah tercapai (maksimal 5 bisnis)",
        },
      };
    }

    // Whitelist insert data: owner_id disematkan secara server-authoritative
    const insertPayload = {
      owner_id: userId,
      name: validated.name,
      category: validated.category ?? null,
      phone: validated.phone ?? null,
      address: validated.address ?? null,
    };

    const { data, error } = await supabase
      .from("businesses")
      .insert(insertPayload)
      .select(BUSINESS_SELECT_COLUMNS)
      .single();

    if (error) {
      return mapDatabaseErrorToApiResponse(error);
    }

    return {
      success: true,
      data: mapBusinessRowToResponse(data as unknown as BusinessRow),
    };
  } catch (err) {
    return mapDatabaseErrorToApiResponse(err);
  }
}

/**
 * 4. Mengambil Daftar Bisnis yang Dapat Diakses Pengguna (getMyBusinesses)
 *
 * Mengambil seluruh bisnis di mana pengguna terdaftar di business_members
 * dengan urutan deterministik (created_at ASC, id ASC).
 */
export async function getMyBusinesses(
  options?: BusinessServiceOptions
): Promise<ApiResponse<BusinessResponseData[]>> {
  const supabase = options?.supabase ?? (await createClient());

  let userId = options?.userId;
  if (!userId) {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      return {
        success: false,
        error: {
          code: "UNAUTHENTICATED",
          message: "Pengguna belum terautentikasi atau sesi login telah berakhir",
        },
      };
    }
    userId = authData.user.id;
  }

  try {
    // 1. Ambil daftar keanggotaan pengguna dari business_members
    const { data: memberships, error: memberError } = await supabase
      .from("business_members")
      .select("business_id")
      .eq("user_id", userId);

    if (memberError) {
      return mapDatabaseErrorToApiResponse(memberError);
    }

    if (!memberships || memberships.length === 0) {
      return {
        success: true,
        data: [],
      };
    }

    const businessIds = memberships.map((m) => m.business_id);

    // 2. Ambil data bisnis dengan urutan deterministik ganda
    const { data: businesses, error: bizError } = await supabase
      .from("businesses")
      .select(BUSINESS_SELECT_COLUMNS)
      .in("id", businessIds)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });

    if (bizError) {
      return mapDatabaseErrorToApiResponse(bizError);
    }

    const rows = (businesses || []) as unknown as BusinessRow[];
    return {
      success: true,
      data: rows.map(mapBusinessRowToResponse),
    };
  } catch (err) {
    return mapDatabaseErrorToApiResponse(err);
  }
}

/**
 * 5. Mengambil Detail Bisnis Berdasarkan ID dengan Otorisasi Tenant (getBusinessById)
 *
 * Mencegah IDOR: Memverifikasi keanggotaan pengguna pada bisnis target.
 */
export async function getBusinessById(
  businessId: string,
  options?: BusinessServiceOptions
): Promise<ApiResponse<BusinessResponseData>> {
  const idValidation = uuidSchema.safeParse(businessId);
  if (!idValidation.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Format ID bisnis tidak valid",
        details: { businessId: idValidation.error.issues.map((i) => i.message) },
      },
    };
  }

  const supabase = options?.supabase ?? (await createClient());

  // Verifikasi keanggotaan tenant server-side
  const authResult = await verifyUserAndBusinessMembership(
    supabase,
    businessId,
    options?.userId
  );
  if (!authResult.success) {
    return authResult.response;
  }

  try {
    const { data, error } = await supabase
      .from("businesses")
      .select(BUSINESS_SELECT_COLUMNS)
      .eq("id", businessId)
      .maybeSingle();

    if (error) {
      return mapDatabaseErrorToApiResponse(error);
    }

    if (!data) {
      return {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Data bisnis tidak ditemukan",
        },
      };
    }

    return {
      success: true,
      data: mapBusinessRowToResponse(data as unknown as BusinessRow),
    };
  } catch (err) {
    return mapDatabaseErrorToApiResponse(err);
  }
}

/**
 * 6. Memperbarui Metadata Bisnis Khusus Oleh Pemilik (updateBusiness)
 *
 * Memeriksa bahwa auth.uid() === business.owner_id (FORBIDDEN_NOT_OWNER jika bukan pemilik).
 * Membuang dan menolak mutasi pada field sistem immutable (id, owner_id, currency_code, timezone, created_at, updated_at).
 */
export async function updateBusiness(
  id: string,
  input: UpdateBusinessInput,
  options?: BusinessServiceOptions
): Promise<ApiResponse<BusinessResponseData>> {
  const idValidation = uuidSchema.safeParse(id);
  if (!idValidation.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Format ID bisnis pada argumen tidak valid",
        details: { id: idValidation.error.issues.map((i) => i.message) },
      },
    };
  }

  const validationResult = updateBusinessSchema.safeParse(input);
  if (!validationResult.success) {
    const errorDetails: Record<string, string[]> = {};
    for (const issue of validationResult.error.issues) {
      const field = issue.path.join(".") || "business";
      if (!errorDetails[field]) errorDetails[field] = [];
      errorDetails[field].push(issue.message);
    }
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Format data pembaruan bisnis tidak valid",
        details: errorDetails,
      },
    };
  }

  const validated = validationResult.data;
  if (validated.businessId && validated.businessId !== id) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message:
          "ID bisnis pada argumen URL tidak cocok dengan ID pada payload body",
      },
    };
  }

  const supabase = options?.supabase ?? (await createClient());

  let userId = options?.userId;
  if (!userId) {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      return {
        success: false,
        error: {
          code: "UNAUTHENTICATED",
          message: "Pengguna belum terautentikasi atau sesi login telah berakhir",
        },
      };
    }
    userId = authData.user.id;
  }

  try {
    // 1. Ambil data bisnis saat ini untuk verifikasi kepemilikan yuridis
    const { data: currentBiz, error: fetchError } = await supabase
      .from("businesses")
      .select("id, owner_id")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) {
      return mapDatabaseErrorToApiResponse(fetchError);
    }

    if (!currentBiz) {
      return {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Data bisnis tidak ditemukan",
        },
      };
    }

    // 2. Otorisasi Pemilik Mutlak: Hanya pemilik (owner_id) yang berhak mengubah metadata
    if (currentBiz.owner_id !== userId) {
      return {
        success: false,
        error: {
          code: "FORBIDDEN_NOT_OWNER",
          message:
            "Hanya pemilik bisnis yang memiliki izin untuk mengubah informasi bisnis ini",
        },
      };
    }

    // 3. Bangun payload pembaruan dengan WHITELIST KETAT
    const updatePayload: Partial<{
      name: string;
      category: string | null;
      phone: string | null;
      address: string | null;
    }> = {};

    if (validated.name !== undefined) updatePayload.name = validated.name;
    if (validated.category !== undefined)
      updatePayload.category = validated.category;
    if (validated.phone !== undefined) updatePayload.phone = validated.phone;
    if (validated.address !== undefined)
      updatePayload.address = validated.address;

    // 4. Eksekusi pembaruan pada database
    const { data, error } = await supabase
      .from("businesses")
      .update(updatePayload)
      .eq("id", id)
      .eq("owner_id", userId)
      .select(BUSINESS_SELECT_COLUMNS)
      .maybeSingle();

    if (error) {
      return mapDatabaseErrorToApiResponse(error);
    }

    if (!data) {
      return {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Data bisnis tidak ditemukan saat memperbarui",
        },
      };
    }

    return {
      success: true,
      data: mapBusinessRowToResponse(data as unknown as BusinessRow),
    };
  } catch (err) {
    return mapDatabaseErrorToApiResponse(err);
  }
}

/**
 * 7. Resolusi Konteks Tenant Server-Authoritative (resolveTenantContext)
 *
 * Menangani kasus 0, 1, dan multi-bisnis tanpa mempercayai ID klien secara buta.
 * Mencegah silent fallback: Jika requestedBusinessId tidak sah, langsung tolak
 * dengan UNAUTHORIZED_BUSINESS.
 * Jika requestedBusinessId ditiadakan (omitted), memilih bisnis pertama secara
 * deterministik (ORDER BY created_at ASC, id ASC).
 */
export async function resolveTenantContext(
  requestedBusinessId?: string,
  options?: BusinessServiceOptions
): Promise<ApiResponse<TenantContextResponse>> {
  if (requestedBusinessId !== undefined) {
    const idValidation = uuidSchema.safeParse(requestedBusinessId);
    if (!idValidation.success) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Format ID bisnis yang diminta tidak valid",
          details: {
            requestedBusinessId: idValidation.error.issues.map((i) => i.message),
          },
        },
      };
    }
  }

  const supabase = options?.supabase ?? (await createClient());

  let userId = options?.userId;
  if (!userId) {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      return {
        success: false,
        error: {
          code: "UNAUTHENTICATED",
          message: "Pengguna belum terautentikasi atau sesi login telah berakhir",
        },
      };
    }
    userId = authData.user.id;
  }

  // 1. Ambil seluruh bisnis yang dapat diakses pengguna
  const businessesResult = await getMyBusinesses({ supabase, userId });
  if (!businessesResult.success) {
    return businessesResult;
  }

  const availableBusinesses = businessesResult.data;

  // Kasus A: Pengguna belum memiliki bisnis (0 Bisnis)
  if (availableBusinesses.length === 0) {
    if (requestedBusinessId) {
      return {
        success: false,
        error: {
          code: "UNAUTHORIZED_BUSINESS",
          message: "Pengguna tidak terdaftar sebagai anggota pada bisnis yang diminta",
        },
      };
    }

    return {
      success: true,
      data: {
        hasBusiness: false,
        activeBusiness: null,
        role: null,
        availableBusinesses: [],
      },
    };
  }

  // Kasus B: requestedBusinessId diberikan oleh pemanggil
  if (requestedBusinessId) {
    const matched = availableBusinesses.find((b) => b.id === requestedBusinessId);

    // Prinsip Fail-Closed: Tolak seketika tanpa silent fallback
    if (!matched) {
      return {
        success: false,
        error: {
          code: "UNAUTHORIZED_BUSINESS",
          message: "Pengguna tidak terdaftar sebagai anggota pada bisnis yang diminta",
        },
      };
    }

    return {
      success: true,
      data: {
        hasBusiness: true,
        activeBusiness: matched,
        role: "OWNER",
        availableBusinesses,
      },
    };
  }

  // Kasus C: requestedBusinessId ditiadakan (omitted) -> Pilih default pertama secara deterministik
  const defaultBusiness = availableBusinesses[0];

  return {
    success: true,
    data: {
      hasBusiness: true,
      activeBusiness: defaultBusiness,
      role: "OWNER",
      availableBusinesses,
    },
  };
}
