/**
 * Tampilan katalog & WhatsApp paket (PRD AC-12, AC-14–AC-16, §12.8 AC-55–AC-60).
 * Komponen server dirender dengan react-dom/server; data katalog diganti tiruan (tanpa jaringan).
 */
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const catalog = vi.fn();
vi.mock("@/lib/data/packages", () => ({ loadPublishedCatalog: (...args: unknown[]) => catalog(...args) }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import { PackageOffers } from "@/components/publik/product/package-offers";
import { ProductDetail, ProductSummaryCard } from "@/components/publik/product/product-sections";
import type { CatalogPackage } from "@/lib/data/packages";

const PRODUCT = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "ikan-nila",
  name: "Ikan Nila",
  shortDescription: null,
  stockPrice: { stockKg: 50, pricePerKgIdr: 35_000, confirmedAt: "2026-11-19T01:00:00Z" },
};

const PACKAGES: CatalogPackage[] = [
  { id: "a1111111-1111-4111-8111-111111111111", name: "Paket Kecil", weightKg: 10, priceTotalIdr: 320_000, createdAt: "", updatedAt: "" },
  { id: "b1111111-1111-4111-8111-111111111111", name: "Paket Besar", weightKg: 100, priceTotalIdr: 3_100_000, createdAt: "", updatedAt: "" },
];

/** Teks pesan dari semua tautan wa.me di HTML. */
function whatsappTexts(html: string): string[] {
  return [...html.matchAll(/href="https:\/\/wa\.me\/\d+\?text=([^"]+)"/g)].map((m) =>
    decodeURIComponent((m[1] ?? "").replace(/&amp;/g, "&")),
  );
}

beforeEach(() => {
  vi.stubEnv("WHATSAPP_NUMBER", "6281575723540");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://contoh.vercel.app");
  catalog.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe("produk gagal dimuat (AC-12)", () => {
  it("ringkasan: pesan gangguan, TANPA angka rupiah atau paket; WhatsApp tetap ada", async () => {
    catalog.mockResolvedValue({ product: { status: "error" }, packages: null });
    const html = renderToStaticMarkup(await ProductSummaryCard({}));
    expect(html).toContain("Informasi stok dan harga sedang tidak dapat dimuat");
    expect(html).not.toMatch(/Rp\d/);
    expect(html).not.toContain("Pilihan paket");
    expect(html).not.toMatch(/Belum tersedia|Stok habis/);
    expect(whatsappTexts(html)[0]).toContain("menanyakan ketersediaan dan harga Ikan Nila");
  });

  it("detail: pesan gangguan dan paket TIDAK ditampilkan", async () => {
    catalog.mockResolvedValue({ product: { status: "error" }, packages: null });
    const html = renderToStaticMarkup(await ProductDetail({ params: Promise.resolve({ slug: "ikan-nila" }) }));
    expect(html).toContain("Informasi stok dan harga sedang tidak dapat dimuat");
    expect(html).toContain("Pilihan paket tidak ditampilkan karena informasi produk sedang tidak dapat dimuat");
    expect(html).not.toMatch(/Rp\d/);
  });
});

describe("paket dari database", () => {
  it("detail: kartu dari data tersimpan, badge Hemat Rp400.000, harga efektif, WhatsApp per paket", async () => {
    catalog.mockResolvedValue({ product: { status: "ok", product: PRODUCT }, packages: { status: "ok", packages: PACKAGES } });
    const html = renderToStaticMarkup(await ProductDetail({ params: Promise.resolve({ slug: "ikan-nila" }) }));
    expect(html).toContain("Paket Besar");
    expect(html).toContain("Rp3.100.000");
    expect(html).toContain("Hemat Rp400.000");
    expect(html).toContain("Setara Rp31.000/kg");
    expect(html).toContain("Hemat Rp30.000");
    const texts = whatsappTexts(html);
    expect(texts.some((t) => t.includes("Ikan Nila paket Paket Besar (100 kg) seharga Rp3.100.000"))).toBe(true);
    expect(texts.some((t) => t.includes("https://contoh.vercel.app/produk/ikan-nila"))).toBe(true);
  });

  it("gagal memuat paket → pesan gangguan paket, tanpa harga paket fiktif", async () => {
    catalog.mockResolvedValue({ product: { status: "ok", product: PRODUCT }, packages: { status: "error" } });
    const html = renderToStaticMarkup(await ProductDetail({ params: Promise.resolve({ slug: "ikan-nila" }) }));
    expect(html).toContain("Pilihan paket sedang tidak dapat dimuat");
    expect(html).not.toContain("Hemat");
  });

  it("tanpa paket → pesan wajar + jalur bertanya WhatsApp", async () => {
    catalog.mockResolvedValue({ product: { status: "ok", product: PRODUCT }, packages: { status: "ok", packages: [] } });
    const html = renderToStaticMarkup(await ProductDetail({ params: Promise.resolve({ slug: "ikan-nila" }) }));
    expect(html).toContain("Belum ada pilihan paket");
    expect(whatsappTexts(html).length).toBeGreaterThan(0);
  });

  it("produk tidak terbit → notFound()", async () => {
    catalog.mockResolvedValue({ product: { status: "not_found" }, packages: null });
    await expect(ProductDetail({ params: Promise.resolve({ slug: "ikan-nila" }) })).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("pesan WhatsApp mengikuti status stok", () => {
  const render = (stockKg: number | null, unitPrice: number | null = 35_000) =>
    renderToStaticMarkup(
      <PackageOffers
        variant="full"
        productName="Ikan Nila"
        slug="ikan-nila"
        stockKg={stockKg}
        unitPricePerKgIdr={unitPrice}
        packages={{ status: "ok", packages: PACKAGES }}
      />,
    );

  it("stok cukup untuk paket kecil, kurang untuk paket besar", () => {
    const html = render(50);
    const [small, large] = whatsappTexts(html);
    expect(small).toContain("ingin memesan Ikan Nila paket Paket Kecil (10 kg) seharga Rp320.000");
    expect(large).toContain("Apakah stok saat ini cukup untuk paket ini?");
    expect(html).toContain("Melebihi stok tercatat");
    for (const text of [small, large]) expect(text).not.toMatch(/50 kg|stok 50/);
  });

  it("stok habis → menanyakan kapan tersedia, tidak mengklaim tersedia", () => {
    const texts = whatsappTexts(render(0));
    expect(texts.every((t) => t.includes("sedang habis") && t.includes("kapan tersedia lagi"))).toBe(true);
    expect(texts.some((t) => t.includes("ingin memesan"))).toBe(false);
  });

  it("stok belum diisi → tidak menjanjikan paket tersedia", () => {
    const html = render(null);
    expect(html).toContain("Stok belum tercatat di website");
    expect(whatsappTexts(html).every((t) => t.includes("cukup untuk paket ini"))).toBe(true);
  });

  it("harga satuan belum tersedia → harga paket tampil tanpa pembanding & badge", () => {
    const html = render(50, null);
    expect(html).toContain("Rp320.000");
    expect(html).not.toContain("Hemat");
    expect(html).toContain("pembanding dan penghematan tidak ditampilkan");
  });

  it("nomor WhatsApp belum dikonfigurasi → tombol nonaktif tanpa tautan wa.me (AC-14)", () => {
    vi.stubEnv("WHATSAPP_NUMBER", "");
    const html = render(50);
    expect(html).not.toContain("wa.me");
    expect(html).toContain("Nomor WhatsApp belum tersedia");
  });
});
