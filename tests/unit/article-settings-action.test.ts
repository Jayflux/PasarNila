/**
 * Inti Server Action artikel & nama usaha (PRD AC-37–AC-41, AC-45–AC-52; ARCHITECTURE §5.4, §5.6, §10.4).
 */
import { describe, expect, it, vi } from "vitest";

import { recheckArticle, saveArticle, type ArticleDb } from "@/lib/actions/core/article";
import {
  CACHE_REFRESH_WARNING,
  recheckBusinessName,
  saveBusinessName,
  type BusinessNameDb,
} from "@/lib/actions/core/site-settings";

import { fail, failingGate, form, NETWORK_ERROR, noWait, ok, partnerGate } from "./support/action-fakes";

const T0 = "2026-11-18T07:00:00+00:00";
const T1 = "2026-11-18T07:05:00.5+00:00";

describe("artikel", () => {
  const article = (title: string, body: string, at: string) => ({ slug: "artikel-1", title, body, updated_at: at });
  const input = (overrides: Record<string, string> = {}) =>
    form({ slug: "artikel-1", title: "  Judul Baru  ", body: "Isi **baru**", baselineUpdatedAt: T0, ...overrides });

  function db(update: () => Promise<unknown>, read: () => Promise<unknown> = async () => ok(article("Lama", "Lama", T0))) {
    return { update: vi.fn(update), read: vi.fn(read) } as unknown as ArticleDb & {
      update: ReturnType<typeof vi.fn>;
      read: ReturnType<typeof vi.fn>;
    };
  }

  it("hanya judul & isi (sudah di-trim) yang dikirim", async () => {
    const fake = db(async () => ok([article("Judul Baru", "Isi **baru**", T1)]));
    const result = await saveArticle(input(), { gate: partnerGate(fake), wait: noWait });
    expect(result.state).toBe("saved");
    expect(fake.update).toHaveBeenCalledWith({ slug: "artikel-1", title: "Judul Baru", body: "Isi **baru**" });
    expect(result.saved?.updatedAt).toBe(T1);
  });

  it("0 baris (ditolak RLS) → gagal PASTI, bukan berhasil", async () => {
    const result = await saveArticle(input(), { gate: partnerGate(db(async () => ok([]))), wait: noWait });
    expect(result.state).toBe("not_found");
  });

  it("panjang dihitung per karakter Unicode (emoji = 1), sama seperti char_length", async () => {
    const fake = db(async () => ok([article("🐟".repeat(150), "x", T1)]));
    const okResult = await saveArticle(input({ title: "🐟".repeat(150) }), { gate: partnerGate(fake), wait: noWait });
    expect(okResult.state).toBe("saved");
    const tooLong = await saveArticle(input({ title: "🐟".repeat(151) }), { gate: partnerGate(fake), wait: noWait });
    expect(tooLong.state).toBe("invalid");
  });

  it("koneksi putus + artikel lama masih terbaca → belum pasti (tidak mengklaim gagal)", async () => {
    const result = await saveArticle(input(), { gate: partnerGate(db(async () => fail(NETWORK_ERROR))), wait: noWait });
    expect(result).toMatchObject({ state: "uncertain", canRecheck: true });
  });

  it("periksa ulang menemukan isian tersimpan → terverifikasi", async () => {
    const fake = db(async () => ok([]), async () => ok(article("Judul Baru", "Isi **baru**", T1)));
    const result = await recheckArticle(input(), { gate: partnerGate(fake), wait: noWait });
    expect(result.state).toBe("verified");
    expect(fake.update).not.toHaveBeenCalled();
  });

  it("sesi berakhir → pesan sesi, tanpa menulis", async () => {
    const fake = db(async () => ok([]));
    const result = await saveArticle(input(), { gate: failingGate("session_expired"), wait: noWait });
    expect(result.state).toBe("session_expired");
    expect(fake.update).not.toHaveBeenCalled();
  });
});

describe("nama usaha", () => {
  const settings = (name: string, at: string) => ({ business_name: name, updated_at: at });
  const input = (name = "  Juki   Fish Farm  ") => form({ businessName: name, baselineUpdatedAt: T0 });

  function db(update: () => Promise<unknown>, read: () => Promise<unknown> = async () => ok(settings("Lama", T0))) {
    return { update: vi.fn(update), read: vi.fn(read) } as unknown as BusinessNameDb & {
      update: ReturnType<typeof vi.fn>;
      read: ReturnType<typeof vi.fn>;
    };
  }

  it("nama dirapikan, disimpan, dan cache dibersihkan", async () => {
    const fake = db(async () => ok([settings("Juki Fish Farm", T1)]));
    const invalidate = vi.fn();
    const result = await saveBusinessName(input(), { gate: partnerGate(fake), wait: noWait, invalidate });
    expect(fake.update).toHaveBeenCalledWith("Juki Fish Farm");
    expect(result).toMatchObject({ state: "saved", message: "Nama usaha disimpan: “Juki Fish Farm”." });
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(result.warning).toBeUndefined();
  });

  it("simpan berhasil tetapi invalidasi cache gagal → TETAP tersimpan + peringatan", async () => {
    const fake = db(async () => ok([settings("Juki Fish Farm", T1)]));
    const result = await saveBusinessName(input(), {
      gate: partnerGate(fake),
      wait: noWait,
      invalidate: () => {
        throw new Error("updateTag gagal");
      },
    });
    expect(result.state).toBe("saved");
    expect(result.warning).toBe(CACHE_REFRESH_WARNING);
    expect(result.message).not.toMatch(/gagal menyimpan|tidak berubah/i);
  });

  it("pemeriksaan ulang SELALU membersihkan cache, juga saat masih belum pasti", async () => {
    const invalidate = vi.fn();
    const fake = db(async () => ok([]));
    const result = await recheckBusinessName(input(), { gate: partnerGate(fake), wait: noWait, invalidate });
    expect(result.state).toBe("uncertain");
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it("hasil belum pasti lalu nama baru terbaca → terverifikasi + cache dibersihkan", async () => {
    const invalidate = vi.fn();
    const fake = db(async () => fail(NETWORK_ERROR), async () => ok(settings("Juki Fish Farm", T1)));
    const result = await saveBusinessName(input(), { gate: partnerGate(fake), wait: noWait, invalidate });
    expect(result.state).toBe("verified");
    expect(invalidate).toHaveBeenCalled();
  });

  it.each(["A", " ", "Baris\nBaru", "x".repeat(81)])("nama tidak valid %j ditolak tanpa menulis", async (bad) => {
    const fake = db(async () => ok([]));
    const result = await saveBusinessName(input(bad), { gate: partnerGate(fake), wait: noWait, invalidate: vi.fn() });
    expect(result.state).toBe("invalid");
    expect(fake.update).not.toHaveBeenCalled();
  });

  it("bukan mitra → ditolak dengan pesan akses", async () => {
    const result = await saveBusinessName(input(), { gate: failingGate("forbidden"), wait: noWait, invalidate: vi.fn() });
    expect(result.state).toBe("forbidden");
  });
});
