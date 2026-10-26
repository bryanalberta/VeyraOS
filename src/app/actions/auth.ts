"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { signUpSchema, signInSchema } from "@/lib/validations/auth";
import { formatZodErrorDetails } from "@/services/transactions/error-mapper";
import {
  updateUserProfile,
  type BusinessServiceOptions,
} from "@/services/business/business.service";
import type {
  ApiResponse,
  AuthResponseData,
  UserProfileResponseData,
  UpdateProfileInput,
} from "@/types/api";
import type { SignUpFormValues, SignInFormValues } from "@/lib/validations/auth";
import { TENANT_COOKIE_NAME } from "@/lib/constants/tenant-cookie";

export interface AuthActionOptions {
  supabase?: Awaited<ReturnType<typeof createClient>>;
}

/**
 * 1. Pendaftaran Pengguna Baru (signUpAction)
 *
 * Menerima form values, memvalidasi dengan Zod signUpSchema,
 * mendaftarkan akun di Supabase Auth, dan mengembalikan AuthResponseData.
 */
export async function signUpAction(
  input: SignUpFormValues,
  options?: AuthActionOptions
): Promise<ApiResponse<AuthResponseData>> {
  const validationResult = signUpSchema.safeParse(input);
  if (!validationResult.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Format data pendaftaran akun tidak valid",
        details: formatZodErrorDetails(validationResult.error),
      },
    };
  }

  const validated = validationResult.data;

  try {
    const supabase = options?.supabase ?? (await createClient());

    const { data, error } = await supabase.auth.signUp({
      email: validated.email,
      password: validated.password,
      options: {
        data: {
          full_name: validated.fullName,
        },
      },
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (
        msg.includes("already registered") ||
        msg.includes("already exists") ||
        msg.includes("user_already_exists") ||
        error.status === 422
      ) {
        return {
          success: false,
          error: {
            code: "AUTH_EMAIL_EXISTS",
            message:
              "Email sudah terdaftar. Silakan gunakan email lain atau masuk ke akun Anda.",
          },
        };
      }

      if (msg.includes("rate limit") || error.status === 429) {
        return {
          success: false,
          error: {
            code: "AUTH_RATE_LIMITED",
            message:
              "Terlalu banyak permintaan pendaftaran. Silakan tunggu beberapa saat.",
          },
        };
      }

      return {
        success: false,
        error: {
          code: "AUTH_SIGN_UP_FAILED",
          message: "Gagal mendaftarkan akun baru. Silakan coba kembali.",
        },
      };
    }

    if (!data || !data.user || !data.user.id) {
      return {
        success: false,
        error: {
          code: "AUTH_SIGN_UP_FAILED",
          message: "Pendaftaran akun tidak menghasilkan data pengguna yang valid",
        },
      };
    }

    // Deteksi mitigasi enumerasi Supabase: jika email sudah terdaftar,
    // Supabase mengembalikan data.user dengan identities kosong tanpa error
    if (data.user.identities && data.user.identities.length === 0) {
      return {
        success: false,
        error: {
          code: "AUTH_EMAIL_EXISTS",
          message:
            "Email sudah terdaftar. Silakan gunakan email lain atau masuk ke akun Anda.",
        },
      };
    }

    // 1. Evaluasi apakah email pengguna sudah terkonfirmasi secara definitif
    const isEmailConfirmed = Boolean(
      data.user.email_confirmed_at || data.user.confirmed_at
    );

    // 2. Evaluasi apakah sesi login aktif telah dibentuk
    const sessionEstablished = Boolean(data.session);

    // 3. Evaluasi apakah konfirmasi email masih diwajibkan:
    // Hanya bernilai true jika email belum terkonfirmasi DAN terdapat indikator
    // eksplisit dari GoTrue bahwa email konfirmasi telah dikirim (confirmation_sent_at).
    // Jika field konfirmasi tidak tersedia, sistem tidak menyimpulkan kewajiban konfirmasi
    // semata-mata dari ketiadaan sesi (session === null) demi mencegah instruksi palsu.
    const requiresEmailConfirmation =
      !isEmailConfirmed && Boolean(data.user.confirmation_sent_at);

    return {
      success: true,
      data: {
        userId: data.user.id,
        email: data.user.email ?? validated.email,
        fullName:
          (data.user.user_metadata?.full_name as string) || validated.fullName,
        sessionEstablished,
        requiresEmailConfirmation,
      },
    };
  } catch {
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Terjadi kesalahan sistem saat mendaftarkan akun",
      },
    };
  }
}

/**
 * 2. Masuk / Login Pengguna (signInAction)
 *
 * Menerima form values, memvalidasi dengan Zod signInSchema,
 * mengautentikasi kredensial via Supabase Auth, dan mengembalikan AuthResponseData.
 */
export async function signInAction(
  input: SignInFormValues,
  options?: AuthActionOptions
): Promise<ApiResponse<AuthResponseData>> {
  const validationResult = signInSchema.safeParse(input);
  if (!validationResult.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Format data masuk tidak valid",
        details: formatZodErrorDetails(validationResult.error),
      },
    };
  }

  const validated = validationResult.data;

  try {
    const supabase = options?.supabase ?? (await createClient());

    const { data, error } = await supabase.auth.signInWithPassword({
      email: validated.email,
      password: validated.password,
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (
        msg.includes("not confirmed") ||
        msg.includes("email not confirmed")
      ) {
        return {
          success: false,
          error: {
            code: "AUTH_EMAIL_NOT_CONFIRMED",
            message:
              "Email belum diverifikasi. Silakan periksa tautan konfirmasi di email Anda.",
          },
        };
      }

      if (
        msg.includes("invalid login credentials") ||
        msg.includes("invalid_credentials") ||
        error.status === 400
      ) {
        return {
          success: false,
          error: {
            code: "AUTH_INVALID_CREDENTIALS",
            message: "Email atau kata sandi yang Anda masukkan salah",
          },
        };
      }

      if (msg.includes("rate limit") || error.status === 429) {
        return {
          success: false,
          error: {
            code: "AUTH_RATE_LIMITED",
            message:
              "Terlalu banyak percobaan masuk. Silakan tunggu beberapa saat.",
          },
        };
      }

      return {
        success: false,
        error: {
          code: "AUTH_SIGN_IN_FAILED",
          message:
            "Gagal masuk ke sistem. Silakan coba kembali beberapa saat lagi.",
        },
      };
    }

    if (!data || !data.user || !data.user.id) {
      return {
        success: false,
        error: {
          code: "AUTH_SIGN_IN_FAILED",
          message: "Otentikasi berhasil tetapi data pengguna tidak tersedia",
        },
      };
    }

    return {
      success: true,
      data: {
        userId: data.user.id,
        email: data.user.email ?? validated.email,
        fullName:
          (data.user.user_metadata?.full_name as string) || "",
        sessionEstablished: true,
        requiresEmailConfirmation: false,
      },
    };
  } catch {
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Terjadi kesalahan sistem saat masuk ke akun",
      },
    };
  }
}

/**
 * 3. Keluar / Logout Pengguna (signOutAction)
 *
 * Menghancurkan sesi Supabase Auth dan membersihkan cookie konteks tenant aktif.
 */
export async function signOutAction(
  options?: AuthActionOptions
): Promise<ApiResponse<{ message: string }>> {
  try {
    const supabase = options?.supabase ?? (await createClient());
    const { error } = await supabase.auth.signOut();
    if (error) {
      return {
        success: false,
        error: {
          code: "AUTH_SIGN_OUT_FAILED",
          message: "Gagal keluar dari sesi login",
        },
      };
    }

    try {
      const cookieStore = await cookies();
      cookieStore.delete(TENANT_COOKIE_NAME);
    } catch {
      // Safe cleanup, non-blocking
    }

    return {
      success: true,
      data: {
        message: "Berhasil keluar dari sistem",
      },
    };
  } catch {
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Terjadi kesalahan sistem saat keluar",
      },
    };
  }
}

/**
 * 4. Pembaruan Profil Pengguna (updateUserProfileAction)
 *
 * Menerima UpdateProfileInput, mendelegasikan ke service layer updateUserProfile,
 * yang memvalidasi whitelist fullName dan memperbarui database.
 */
export async function updateUserProfileAction(
  input: UpdateProfileInput,
  options?: BusinessServiceOptions
): Promise<ApiResponse<UserProfileResponseData>> {
  return updateUserProfile(input, options);
}
