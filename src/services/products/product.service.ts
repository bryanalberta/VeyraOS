/**
 * VeyraOS Product Catalog & Master Inventory Service Layer
 *
 * Sesuai spesifikasi Phase 4, Substage 3.2.2A:
 * - Terpisah dari UI dan Server Actions.
 * - Menggunakan Supabase server client resmi.
 * - Memeriksa otorisasi sesi pengguna & keanggotaan bisnis di sisi server (Defense-in-Depth).
 * - Tidak mempercayai businessId dari klien tanpa verifikasi server.
 * - Memvalidasi seluruh input menggunakan skema Zod (createProductSchema, updateProductSchema, getProductsQuerySchema, uuidSchema).
 * - Menjaga isolasi multi-tenant pada seluruh operasi baca dan tulis (business_id).
 * - updateProduct hanya mengizinkan modifikasi metadata (nama, SKU, kategori, harga jual, arsip).
 *   Mutasi langsung pada stock_quantity atau cost_price DITOLAK (FORBIDDEN_FIELD_MUTATION).
 * - archiveProduct hanya melakukan soft-delete (is_archived = true) dan menolak hard-delete.
 * - Integritas Stok Awal: Karena mekanisme Stored Procedure (RPC) pencatatan stok awal atomik
 *   bersama entri stock_movements belum tersedia pada skema migrasi database saat ini,
 *   createProduct mengizinkan stockQuantity = 0 secara aman, dan menolak stockQuantity > 0
 *   dengan error ATOMIC_INITIAL_STOCK_UNAVAILABLE guna mencegah rekonsiliasi parsial/desinkronisasi ledger.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  createProductSchema,
  updateProductSchema,
  getProductsQuerySchema,
  uuidSchema,
} from "@/lib/validations";
import {
  mapDatabaseErrorToApiResponse,
  formatZodErrorDetails,
} from "@/services/transactions/error-mapper";
import { verifyUserAndBusinessMembership } from "@/services/common/auth-guard";
import type {
  ApiResponse,
  CreateProductInput,
  UpdateProductInput,
  GetProductsQuery,
  ProductItemResponse,
} from "@/types/api";

export interface ProductServiceOptions {
  /**
   * Klien Supabase opsional untuk Dependency Injection / Unit Testing dengan Mock.
   * Jika tidak disediakan, memanggil createClient() dari @/lib/supabase/server.
   */
  supabase?: SupabaseClient;

  /**
   * User ID opsional untuk pengujian mock terisolasi.
   */
  userId?: string;
}

interface ProductRow {
  id: string;
  business_id: string;
  name: string;
  sku: string | null;
  category: string | null;
  selling_price: number | string;
  cost_price: number | string;
  stock_quantity: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

const PRODUCT_SELECT_COLUMNS =
  "id, business_id, name, sku, category, selling_price, cost_price, stock_quantity, is_archived, created_at, updated_at";

/**
 * Memetakan baris database produk ke DTO ProductItemResponse bertipe aman
 */
function mapProductRowToItemResponse(row: ProductRow): ProductItemResponse {
  return {
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    sku: row.sku,
    category: row.category,
    sellingPrice: Number(row.selling_price),
    costPrice: Number(row.cost_price),
    stockQuantity: Number(row.stock_quantity),
    isArchived: Boolean(row.is_archived),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * 1. Membuat Produk Baru pada Katalog Bisnis (createProduct)
 */
export async function createProduct(
  input: CreateProductInput,
  options?: ProductServiceOptions
): Promise<ApiResponse<ProductItemResponse>> {
  // 1. Validasi input menggunakan Zod
  const validationResult = createProductSchema.safeParse(input);
  if (!validationResult.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Data produk yang dikirimkan tidak valid",
        details: formatZodErrorDetails(validationResult.error),
      },
    };
  }

  const validated = validationResult.data;

  // 2. Peroleh instance Supabase Client
  const supabase = options?.supabase ?? (await createClient());

  // 3. Verifikasi autentikasi sesi dan keanggotaan bisnis di sisi server
  const authResult = await verifyUserAndBusinessMembership(
    supabase,
    validated.businessId,
    options?.userId
  );
  if (!authResult.success) {
    return authResult.response;
  }

  // 4. Integritas Ledger Stok Awal (Section 3 & 4)
  // Jika stok awal > 0, operasi memerlukan pembuatan baris produk DAN entri stock_movements
  // secara atomik di dalam satu transaksi database. Karena Stored Procedure pencatatan produk
  // awal belum tersedia pada migrasi saat ini, penulisan multi-tabel terpisah dicegah
  // demi melindungi integritas finansial dan aturan audit stok.
  if (validated.stockQuantity > 0) {
    return {
      success: false,
      error: {
        code: "ATOMIC_INITIAL_STOCK_UNAVAILABLE",
        message:
          "Pencatatan produk dengan stok awal > 0 memerlukan mekanisme transaksi atomik database (RPC) yang belum tersedia pada skema migrasi saat ini. Buat produk dengan stok 0 lalu lakukan restock melalui transaksi pembelian, atau tunggu migrasi Stored Procedure pencatatan stok awal.",
      },
    };
  }

  // 5. Simpan produk ke tabel products (stok awal = 0)
  try {
    const { data, error } = await supabase
      .from("products")
      .insert({
        business_id: validated.businessId,
        name: validated.name,
        sku: validated.sku ? validated.sku : null,
        category: validated.category ? validated.category : null,
        selling_price: validated.sellingPrice,
        cost_price: validated.costPrice,
        stock_quantity: 0,
        is_archived: false,
      })
      .select(PRODUCT_SELECT_COLUMNS)
      .single();

    if (error) {
      return mapDatabaseErrorToApiResponse(error);
    }

    if (!data) {
      return {
        success: false,
        error: {
          code: "DATABASE_ERROR",
          message: "Gagal menyimpan produk baru ke basis data",
        },
      };
    }

    return {
      success: true,
      data: mapProductRowToItemResponse(data as unknown as ProductRow),
    };
  } catch (err) {
    return mapDatabaseErrorToApiResponse(err);
  }
}

/**
 * 2. Membaca Daftar Produk dengan Filter dan Pencarian (getProducts)
 */
export async function getProducts(
  params: GetProductsQuery,
  options?: ProductServiceOptions
): Promise<ApiResponse<ProductItemResponse[]>> {
  // 1. Validasi parameter query
  const validationResult = getProductsQuerySchema.safeParse(params);
  if (!validationResult.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Parameter pencarian produk tidak valid",
        details: formatZodErrorDetails(validationResult.error),
      },
    };
  }

  const validated = validationResult.data;

  // 2. Peroleh instance Supabase Client
  const supabase = options?.supabase ?? (await createClient());

  // 3. Verifikasi autentikasi sesi dan keanggotaan bisnis
  const authResult = await verifyUserAndBusinessMembership(
    supabase,
    validated.businessId,
    options?.userId
  );
  if (!authResult.success) {
    return authResult.response;
  }

  // 4. Eksekusi query dengan isolasi multi-tenant yang ketat
  try {
    let query = supabase
      .from("products")
      .select(PRODUCT_SELECT_COLUMNS)
      .eq("business_id", validated.businessId);

    // Filter arsip: default hanya produk aktif kecuali includeArchived bernilai true
    if (!validated.includeArchived) {
      query = query.eq("is_archived", false);
    }

    // Filter kategori jika diberikan
    if (validated.category) {
      query = query.eq("category", validated.category);
    }

    // Filter pencarian nama / SKU
    if (validated.query) {
      const sanitized = validated.query.replace(/[%_,]/g, "\\$&");
      query = query.or(`name.ilike.%${sanitized}%,sku.ilike.%${sanitized}%`);
    }

    // Filter stok menipis (stock_quantity <= 5) sesuai default min_stock_alert & indeks database
    if (validated.lowStockOnly) {
      query = query.lte("stock_quantity", 5);
    }

    // Urutkan secara alfabetis berdasarkan nama produk
    query = query.order("name", { ascending: true });

    const { data, error } = await query;

    if (error) {
      return mapDatabaseErrorToApiResponse(error);
    }

    const rows = (data || []) as unknown as ProductRow[];
    return {
      success: true,
      data: rows.map(mapProductRowToItemResponse),
    };
  } catch (err) {
    return mapDatabaseErrorToApiResponse(err);
  }
}

/**
 * 3. Mengambil Detail Satu Produk Berdasarkan ID (getProductById)
 */
export async function getProductById(
  id: string,
  businessId: string,
  options?: ProductServiceOptions
): Promise<ApiResponse<ProductItemResponse>> {
  // 1. Validasi ID dan businessId
  const idValidation = uuidSchema.safeParse(id);
  const businessIdValidation = uuidSchema.safeParse(businessId);

  if (!idValidation.success || !businessIdValidation.success) {
    const errorDetails: Record<string, string[]> = {};
    if (!idValidation.success) {
      errorDetails.id = idValidation.error.issues.map((i) => i.message);
    }
    if (!businessIdValidation.success) {
      errorDetails.businessId = businessIdValidation.error.issues.map((i) => i.message);
    }

    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Format ID produk atau ID bisnis tidak valid",
        details: errorDetails,
      },
    };
  }

  // 2. Peroleh instance Supabase Client
  const supabase = options?.supabase ?? (await createClient());

  // 3. Verifikasi autentikasi sesi dan keanggotaan bisnis
  const authResult = await verifyUserAndBusinessMembership(
    supabase,
    businessId,
    options?.userId
  );
  if (!authResult.success) {
    return authResult.response;
  }

  // 4. Ambil produk dengan filter business_id wajib (mencegah kebocoran lintas tenant)
  try {
    const { data, error } = await supabase
      .from("products")
      .select(PRODUCT_SELECT_COLUMNS)
      .eq("id", id)
      .eq("business_id", businessId)
      .maybeSingle();

    if (error) {
      return mapDatabaseErrorToApiResponse(error);
    }

    if (!data) {
      return {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Produk tidak ditemukan dalam katalog bisnis ini",
        },
      };
    }

    return {
      success: true,
      data: mapProductRowToItemResponse(data as unknown as ProductRow),
    };
  } catch (err) {
    return mapDatabaseErrorToApiResponse(err);
  }
}

/**
 * 4. Memperbarui Metadata Produk (updateProduct)
 *
 * Catatan Penting Integritas Keuangan & Stok:
 * - Hanya mengizinkan pembaruan metadata (nama, SKU, kategori, harga jual, status arsip).
 * - DILARANG mengubah stock_quantity atau cost_price secara langsung melalui fungsi ini.
 * - Mutasi stok fisik wajib tercatat di Stored Procedure / alur mutasi persediaan resmi.
 */
export async function updateProduct(
  id: string,
  input: UpdateProductInput,
  options?: ProductServiceOptions
): Promise<ApiResponse<ProductItemResponse>> {
  // 1. Perlindungan Integritas Finansial: Tolak mutasi langsung stok dan HPP
  if (input.stockQuantity !== undefined || input.costPrice !== undefined) {
    return {
      success: false,
      error: {
        code: "FORBIDDEN_FIELD_MUTATION",
        message:
          "Perubahan stock_quantity dan cost_price tidak diizinkan melalui updateProduct. Mutasi persediaan fisik dan HPP harus dicatat melalui transaksi pembelian (restock), penjualan, void, atau penyesuaian persediaan teraudit.",
      },
    };
  }

  // 2. Validasi ID produk dan payload
  const idValidation = uuidSchema.safeParse(id);
  if (!idValidation.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Format ID produk tidak valid",
        details: { id: idValidation.error.issues.map((i) => i.message) },
      },
    };
  }

  const payloadToValidate = {
    ...input,
    productId: id,
  };

  const validationResult = updateProductSchema.safeParse(payloadToValidate);
  if (!validationResult.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Data pembaruan produk tidak valid",
        details: formatZodErrorDetails(validationResult.error),
      },
    };
  }

  const validated = validationResult.data;

  // 3. Peroleh instance Supabase Client
  const supabase = options?.supabase ?? (await createClient());

  // 4. Verifikasi autentikasi sesi dan keanggotaan bisnis
  const authResult = await verifyUserAndBusinessMembership(
    supabase,
    validated.businessId,
    options?.userId
  );
  if (!authResult.success) {
    return authResult.response;
  }

  // 5. Susun hanya field metadata yang diizinkan untuk di-update
  const updateData: Record<string, unknown> = {};
  if (validated.name !== undefined) updateData.name = validated.name;
  if (validated.sku !== undefined) updateData.sku = validated.sku ? validated.sku : null;
  if (validated.category !== undefined)
    updateData.category = validated.category ? validated.category : null;
  if (validated.sellingPrice !== undefined)
    updateData.selling_price = validated.sellingPrice;
  if (validated.isArchived !== undefined)
    updateData.is_archived = validated.isArchived;

  // Jika tidak ada perubahan field yang dikirim, kembalikan data saat ini
  if (Object.keys(updateData).length === 0) {
    return getProductById(id, validated.businessId, options);
  }

  // 6. Eksekusi pembaruan dengan batasan tenant wajib (business_id)
  try {
    const { data, error } = await supabase
      .from("products")
      .update(updateData)
      .eq("id", id)
      .eq("business_id", validated.businessId)
      .select(PRODUCT_SELECT_COLUMNS)
      .maybeSingle();

    if (error) {
      return mapDatabaseErrorToApiResponse(error);
    }

    if (!data) {
      return {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Produk tidak ditemukan dalam katalog bisnis ini",
        },
      };
    }

    return {
      success: true,
      data: mapProductRowToItemResponse(data as unknown as ProductRow),
    };
  } catch (err) {
    return mapDatabaseErrorToApiResponse(err);
  }
}

/**
 * 5. Mengarsipkan Produk (archiveProduct)
 *
 * Menerapkan Soft-Delete (is_archived = true).
 * DILARANG melakukan hard-delete karena produk yang sudah memiliki riwayat penjualan,
 * pembelian, atau pergerakan stok terikat batasan relasional RESTRICT pada database.
 */
export async function archiveProduct(
  id: string,
  businessId: string,
  options?: ProductServiceOptions
): Promise<ApiResponse<ProductItemResponse>> {
  // 1. Validasi ID produk dan ID bisnis
  const idValidation = uuidSchema.safeParse(id);
  const businessIdValidation = uuidSchema.safeParse(businessId);

  if (!idValidation.success || !businessIdValidation.success) {
    const errorDetails: Record<string, string[]> = {};
    if (!idValidation.success) {
      errorDetails.id = idValidation.error.issues.map((i) => i.message);
    }
    if (!businessIdValidation.success) {
      errorDetails.businessId = businessIdValidation.error.issues.map((i) => i.message);
    }

    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Format ID produk atau ID bisnis tidak valid",
        details: errorDetails,
      },
    };
  }

  // 2. Peroleh instance Supabase Client
  const supabase = options?.supabase ?? (await createClient());

  // 3. Verifikasi autentikasi sesi dan keanggotaan bisnis
  const authResult = await verifyUserAndBusinessMembership(
    supabase,
    businessId,
    options?.userId
  );
  if (!authResult.success) {
    return authResult.response;
  }

  // 4. Eksekusi soft-delete dengan mengeset is_archived = true
  try {
    const { data, error } = await supabase
      .from("products")
      .update({ is_archived: true })
      .eq("id", id)
      .eq("business_id", businessId)
      .select(PRODUCT_SELECT_COLUMNS)
      .maybeSingle();

    if (error) {
      return mapDatabaseErrorToApiResponse(error);
    }

    if (!data) {
      return {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Produk tidak ditemukan dalam katalog bisnis ini",
        },
      };
    }

    return {
      success: true,
      data: mapProductRowToItemResponse(data as unknown as ProductRow),
    };
  } catch (err) {
    return mapDatabaseErrorToApiResponse(err);
  }
}
