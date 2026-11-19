/**
 * Formulir & halaman panel (PRD FR-27, AC-38, AC-40, AC-45, BR-P6).
 * Dirender di server dengan react-dom/server (tanpa jaringan). Server Action & klien Supabase diganti
 * tiruan.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/actions/article", () => ({ updateArticleAction: vi.fn(), recheckArticleAction: vi.fn() }));
vi.mock("@/lib/actions/stock-price", () => ({ saveStockPriceAction: vi.fn(), recheckStockPriceAction: vi.fn() }));
vi.mock("@/lib/actions/site-settings", () => ({
  updateBusinessNameAction: vi.fn(),
  recheckBusinessNameAction: vi.fn(),
  refreshBusinessNameCacheAction: vi.fn(),
}));
vi.mock("next/server", () => ({ connection: async () => {} }));

const settingsQuery = vi.fn();
vi.mock("@/lib/supabase/server-client", () => ({
  createServerSupabaseClient: async () => ({
    from: () => ({
      select: () => ({ eq: () => ({ abortSignal: () => ({ maybeSingle: settingsQuery }) }) }),
    }),
  }),
}));

import { ArticleMarkdown } from "@/components/content/article-markdown";
import { ArticleForm } from "@/components/panel/article-form";
import { StockPriceForm } from "@/components/panel/stock-price-form";
import PanelPengaturanPage from "@/app/mitra/(terlindungi)/pengaturan/page";
import { loadSiteSettingsForPartner } from "@/lib/data/site-settings";

describe("editor artikel", () => {
  it("tab Pratinjau tetap memuat input judul & isi di dalam formulir (tidak hilang saat simpan)", () => {
    const html = renderToStaticMarkup(
      <ArticleForm
        slug="artikel-1"
        initialTitle="Judul Uji"
        initialBody="Isi **uji**"
        initialUpdatedAt="2026-11-18T07:00:00+00:00"
        initialTab="preview"
      />,
    );
    const formHtml = html.slice(html.indexOf("<form"), html.indexOf("</form>"));
    expect(formHtml).toMatch(/<input[^>]*name="title"[^>]*value="Judul Uji"/);
    expect(formHtml).toMatch(/<textarea[^>]*name="body"[^>]*>Isi \*\*uji\*\*<\/textarea>/);
    expect(formHtml).toContain('name="baselineUpdatedAt" value="2026-11-18T07:00:00+00:00"');
    // Pratinjau merender Markdown.
    expect(html).toContain("<strong>uji</strong>");
  });

  it("tidak ada tombol tambah/hapus artikel (AC-39)", () => {
    const html = renderToStaticMarkup(
      <ArticleForm slug="artikel-1" initialTitle="J" initialBody="I" initialUpdatedAt={null} />,
    );
    expect(html).not.toMatch(/hapus|tambah artikel/i);
  });
});

describe("render Markdown artikel aman (AC-40)", () => {
  it("HTML mentah tampil sebagai teks; tidak ada elemen script", () => {
    const html = renderToStaticMarkup(<ArticleMarkdown source={"Halo <script>alert(1)</script> <b>tebal</b>"} />);
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("format dasar dirender; tautan javascript: dibuang; tautan luar diberi rel aman", () => {
    const html = renderToStaticMarkup(
      <ArticleMarkdown source={"## Sub\n\n**tebal** *miring*\n\n- satu\n\n[jahat](javascript:alert(1)) [luar](https://contoh.test)"} />,
    );
    expect(html).toContain("<h3");
    expect(html).toContain("<strong>tebal</strong>");
    expect(html).toContain("<em>miring</em>");
    expect(html).toContain("<li>satu</li>");
    expect(html).not.toContain("javascript:");
    expect(html).toMatch(/href="https:\/\/contoh\.test"[^>]*target="_blank"[^>]*rel="nofollow noopener noreferrer"/);
  });

  it("gambar tidak didukung (BR-A7)", () => {
    const html = renderToStaticMarkup(<ArticleMarkdown source={"![foto](https://contoh.test/a.jpg)"} />);
    expect(html).not.toContain("<img");
  });
});

describe("pengaturan nama usaha: gagal baca TIDAK memakai nama cadangan", () => {
  beforeEach(() => settingsQuery.mockReset());

  it("loader mengembalikan error, bukan nama cadangan", async () => {
    settingsQuery.mockResolvedValue({ data: null, error: { code: "", message: "TypeError: fetch failed" } });
    expect(await loadSiteSettingsForPartner()).toEqual({ status: "error" });
  });

  it("halaman tidak menampilkan formulir bila nama gagal dibaca (tidak bisa menimpa nama asli)", async () => {
    settingsQuery.mockResolvedValue({ data: null, error: { code: "", message: "TypeError: fetch failed" } });
    const html = renderToStaticMarkup(await PanelPengaturanPage());
    expect(html).not.toContain('name="businessName"');
    expect(html).not.toContain("Ikan Nila");
    expect(html).toContain("Gagal memuat nama usaha tersimpan");
  });

  it("nama tersimpan + updated_at mentah mengisi formulir", async () => {
    settingsQuery.mockResolvedValue({
      data: { business_name: "Juki Fish Farm", updated_at: "2026-11-18T07:00:00+00:00" },
      error: null,
    });
    const html = renderToStaticMarkup(await PanelPengaturanPage());
    expect(html).toMatch(/name="businessName"[^>]*value="Juki Fish Farm"/);
    expect(html).toContain('value="2026-11-18T07:00:00+00:00"');
  });
});

describe("formulir stok & harga: struktur pratinjau", () => {
  it("peringatan harga Rp0 berada di dalam <dd> (regresi axe definition-list, fase 9)", () => {
    const html = renderToStaticMarkup(
      <StockPriceForm
        productId="11111111-1111-4111-8111-111111111111"
        productName="Ikan Nila"
        initialStockKg={10}
        initialPriceIdr={0}
        initialConfirmedAt="2026-11-18T07:00:00+00:00"
        initialConfirmedAtLabel="18 November 2026 pukul 14.00 WIB"
      />,
    );
    const dl = html.slice(html.indexOf("<dl"), html.indexOf("</dl>"));
    expect(dl).toMatch(/<dd[^>]*>Rp0 \/ kg<span[^>]*>Harga Rp0 akan diminta konfirmasi<\/span><\/dd>/);
    // Setiap anak langsung <div> di dalam <dl> hanya berisi <dt>/<dd>.
    for (const group of dl.split(/<div class="[^"]*">/).slice(1)) {
      expect(group.trimStart().startsWith("<dt")).toBe(true);
      expect(group).not.toMatch(/<\/dd><p/);
    }
  });
});
