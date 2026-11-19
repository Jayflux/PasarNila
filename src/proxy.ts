import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { NextResponse, type NextRequest } from "next/server";

import { checkDetailRoute } from "@/config/known-slugs";
import { getSupabasePublicEnv } from "@/lib/env";

/**
 * Proxy Next.js 16 (ARCHITECTURE.md §7, §9.8, §10.3).
 *
 * 1. `/produk/:slug` & `/artikel/:slug`: slug yang tidak dikenal langsung dijawab 404 SEBELUM render.
 *    Dengan Cache Components, `notFound()` saat permintaan hanya menghasilkan status 200 + `noindex`;
 *    pemeriksaan di Proxy adalah cara yang dianjurkan dokumentasi Next.js 16.4.6 untuk status 404.
 *    Tidak ada akses database di sini.
 * 2. `/mitra/*`: menyegarkan sesi Supabase Auth (cookie). Pemeriksaan hak akses tetap di layout dan di
 *    setiap Server Action; Proxy bukan lapisan otorisasi.
 */
export async function proxy(request: NextRequest) {
  if (checkDetailRoute(request.nextUrl.pathname) === "unknown") {
    return notFoundResponse();
  }
  if (!request.nextUrl.pathname.startsWith("/mitra")) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request: { headers: request.headers } });
  try {
    const { url, publishableKey } = getSupabasePublicEnv();
    const supabase = createServerClient<Database>(url, publishableKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });
    // Menyegarkan token yang kedaluwarsa. Hasilnya tidak dipakai untuk otorisasi.
    await supabase.auth.getUser();
  } catch {
    // Konfigurasi/jaringan bermasalah: biarkan layout panel yang menampilkan keadaan yang sesuai.
  }
  return response;
}

const NOT_FOUND_HTML = `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Halaman tidak ditemukan</title>
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f7f5ef;color:#10292a;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;padding:1rem}
main{max-width:28rem;text-align:center}
h1{font-size:1.5rem;margin:0 0 .75rem}
p{color:#4a6463;line-height:1.6;margin:0 0 1.5rem}
a{display:inline-flex;min-height:44px;align-items:center;padding:0 1.25rem;border-radius:999px;background:#0b4446;color:#fff;font-weight:600;text-decoration:none}
a:focus-visible{outline:3px solid #0f766e;outline-offset:3px}
</style>
</head>
<body>
<main>
<h1>Halaman tidak ditemukan</h1>
<p>Alamat yang Anda buka tidak tersedia. Silakan kembali ke beranda untuk melihat produk dan artikel.</p>
<a href="/">Kembali ke beranda</a>
</main>
</body>
</html>`;

function notFoundResponse(): NextResponse {
  return new NextResponse(NOT_FOUND_HTML, {
    status: 404,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

export const config = {
  matcher: ["/mitra/:path*", "/produk/:slug", "/artikel/:slug"],
};
