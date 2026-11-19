import { createClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadPublishedCatalog } from "@/lib/data/packages";
import type { Database } from "@/types/database";

const { request } = vi.hoisted(() => ({ request: vi.fn<typeof fetch>() }));
vi.mock("next/server", () => ({ connection: async () => undefined }));
vi.mock("@/lib/data/log", () => ({ logReadError: vi.fn() }));
vi.mock("@/lib/supabase/public-client", () => ({
  getPublicSupabaseClient: () => createClient<Database>("https://catalog.example.test", "fake-key", {
    global: { fetch: request }, auth: { persistSession: false, autoRefreshToken: false },
  }),
  publicReadSignal: () => AbortSignal.timeout(1000),
}));

const product = {
  id: "11111111-1111-4111-8111-111111111111", slug: "ikan-nila", name: "Ikan Nila",
  short_description: null, stock_kg: 12.34, price_per_kg_idr: 34000, stock_price_confirmed_at: "2026-11-19T00:00:00Z",
};

describe("pembacaan katalog lewat Data API", () => {
  beforeEach(() => request.mockReset());

  it("mengambil produk dan paket terurut lewat satu permintaan; [] benar-benar berarti kosong", async () => {
    request.mockResolvedValueOnce(Response.json([{ ...product, product_packages: [] }]));
    expect(await loadPublishedCatalog("ikan-nila")).toMatchObject({
      product: { status: "ok", product: { stockPrice: { stockKg: 12.34 } } },
      packages: { status: "ok", packages: [] },
    });
    expect(request).toHaveBeenCalledTimes(1);
    const url = new URL(String(request.mock.calls[0]?.[0]));
    expect(url.searchParams.get("product_packages.order")).toBe("weight_kg.asc,price_total_idr.asc,created_at.asc,id.asc");
    expect(url.searchParams.get("is_published")).toBe("eq.true");
  });

  it("masih menampilkan stok/harga ketika embed ditolak tetapi produk dapat dibaca", async () => {
    request.mockResolvedValueOnce(Response.json({ code: "42501", message: "permission denied" }, { status: 403 }));
    request.mockResolvedValueOnce(Response.json([product]));
    expect(await loadPublishedCatalog("ikan-nila")).toMatchObject({ product: { status: "ok" }, packages: { status: "error" } });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("tidak menyamakan relasi rusak dengan daftar paket kosong", async () => {
    request.mockResolvedValueOnce(Response.json([{ ...product, product_packages: null }]));
    expect(await loadPublishedCatalog("ikan-nila")).toMatchObject({ product: { status: "ok" }, packages: { status: "error" } });
  });
});
