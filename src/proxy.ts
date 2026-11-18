import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabasePublicEnv } from "@/lib/env";

/**
 * Proxy Next.js 16 (ARCHITECTURE.md §7, §9.8).
 * Menjaga dan menyegarkan sesi Supabase Auth hanya untuk rute /mitra/:path*.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  try {
    const { url, publishableKey } = getSupabasePublicEnv();

    const supabase = createServerClient(url, publishableKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    });

    // Refresh sesi auth
    await supabase.auth.getUser();
  } catch {
    // Jangan gagalkan request bila env belum lengkap saat runtime tertentu
  }

  return response;
}

export const config = {
  matcher: ["/mitra/:path*"],
};
