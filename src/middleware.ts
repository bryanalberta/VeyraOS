import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicEnv, hasPublicSupabaseEnv } from "@/lib/env";

/**
 * Next.js Edge/Server Middleware for Session Token Refreshing and Route Protection.
 *
 * Security & Design Principles:
 * 1. Sesi otentikasi diverifikasi langsung ke Supabase Auth server melalui `supabase.auth.getUser()`,
 *    bukan sekadar membaca JWT yang berpotensi kadaluarsa atau termanipulasi.
 * 2. Rute terproteksi (/dashboard, /sales, /products, /purchases, /expenses, /reports, /settings, /onboarding)
 *    hanya dapat diakses oleh sesi terotentikasi; pengguna anonim dialihkan ke /login dengan parameter redirectTo.
 * 3. Pengguna yang sudah masuk dialihkan dari halaman publik /login dan /register ke /dashboard.
 * 4. Mode Demo (/demo/*) dan file statis dikecualikan dari middleware ini guna menjamin isolasi penuh.
 */
export async function middleware(request: NextRequest) {
  // Jika variabel lingkungan Supabase belum dikonfigurasi (misal saat build), lewati secara aman
  if (!hasPublicSupabaseEnv()) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } =
    getPublicEnv();

  const supabase = createServerClient(
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Ambil dan segarkan token sesi autentikasi Supabase secara aman
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const isAuthRoute = pathname === "/login" || pathname === "/register";
  const isProtectedRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/sales") ||
    pathname.startsWith("/products") ||
    pathname.startsWith("/purchases") ||
    pathname.startsWith("/expenses") ||
    pathname.startsWith("/reports") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/onboarding");

  // Kasus 1: Pengguna tanpa sesi mengakses rute terlindungi
  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  // Kasus 2: Pengguna dengan sesi valid mengakses /login atau /register
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Mengecualikan file statis, aset Next.js, dan rute demo yang terisolasi di klien:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - demo (rute mode demo mandiri di browser)
     * - api (route handlers menangani autentikasi sendiri)
     */
    "/((?!_next/static|_next/image|favicon.ico|demo|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
