/**
 * Inti Server Action stok & harga (PRD AC-24, AC-26, AC-28, AC-29, AC-31, AC-51; ARCHITECTURE §5.3, §10.4).
 */
import { describe, expect, it, vi } from "vitest";

import { recheckStockPrice, saveStockPrice, type StockPriceDb } from "@/lib/actions/core/stock-price";
import { MESSAGES } from "@/lib/write/action-result";

import { fail, failingGate, form, NETWORK_ERROR, noWait, ok, partnerGate } from "./support/action-fakes";

const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";
const T0 = "2026-11-18T07:00:00.000000+00:00";
const T1 = "2026-11-18T07:05:00.123456+00:00";

function submission(overrides: Record<string, string> = {}) {
  return form({
    productId: PRODUCT_ID,
    stockKg: "12,5",
    pricePerKgIdr: "35.000",
    baselineConfirmedAt: T0,
    baselineStock: "10",
    baselinePrice: "32000",
    ...overrides,
  });
}

function row(stock: number, price: number, at: string | null) {
  return { stock_kg: stock, price_per_kg_idr: price, stock_price_confirmed_at: at };
}

function fakeDb(responses: { confirm?: () => Promise<unknown>; read?: () => Promise<unknown> }): StockPriceDb & {
  confirm: ReturnType<typeof vi.fn>;
  read: ReturnType<typeof vi.fn>;
} {
  return {
    confirm: vi.fn(responses.confirm ?? (async () => ok(row(12.5, 35000, T1)))),
    read: vi.fn(responses.read ?? (async () => ok(row(10, 32000, T0)))),
  } as never;
}

describe("simpan berhasil: pesan memuat angka & waktu dari database", () => {
  it("angka berubah → dilaporkan sebagai PEMBARUAN (bukan konfirmasi ulang)", async () => {
    const db = fakeDb({});
    const result = await saveStockPrice(submission(), { gate: partnerGate(db), wait: noWait });
    expect(result.state).toBe("saved");
    expect(result.message).toContain("Data diperbarui");
    expect(result.message).toContain("12,5 kg");
    expect(result.message).toContain("Rp35.000 / kg");
    expect(result.message).toContain("18 November 2026 pukul 14.05 WIB");
    expect(db.confirm).toHaveBeenCalledWith({ productId: PRODUCT_ID, stockCanonical: "12.5", priceIdr: 35000 });
  });

  it("angka sama dengan baseline → konfirmasi ulang (AC-31)", async () => {
    const db = fakeDb({ confirm: async () => ok(row(10, 32000, T1)) });
    const result = await saveStockPrice(submission({ stockKg: "10", pricePerKgIdr: "32000" }), {
      gate: partnerGate(db),
      wait: noWait,
    });
    expect(result.message).toContain("Data dikonfirmasi ulang (tidak ada perubahan angka)");
    expect(result.message).toContain("10 kg");
  });

  it("belum pernah dikonfirmasi → tersimpan & dikonfirmasi", async () => {
    const db = fakeDb({});
    const result = await saveStockPrice(submission({ baselineConfirmedAt: "", baselineStock: "", baselinePrice: "" }), {
      gate: partnerGate(db),
      wait: noWait,
    });
    expect(result.message).toContain("Data tersimpan dan dikonfirmasi");
  });

  it("baseline berikutnya adalah waktu MENTAH dari database, bukan label WIB", async () => {
    const result = await saveStockPrice(submission(), { gate: partnerGate(fakeDb({})), wait: noWait });
    expect(result.saved?.confirmedAt).toBe(T1);
    expect(result.saved?.confirmedAtLabel).toBe("18 November 2026 pukul 14.05 WIB");
    expect(result.saved?.stockCanonical).toBe("12.5");
  });

  it("baseline berupa label WIB diabaikan (dianggap tidak ada), tidak dipakai sebagai bukti", async () => {
    const db = fakeDb({ confirm: async () => ok(row(10, 32000, T1)) });
    const result = await saveStockPrice(
      submission({ stockKg: "10", pricePerKgIdr: "32000", baselineConfirmedAt: "18 November 2026 pukul 14.00 WIB" }),
      { gate: partnerGate(db), wait: noWait },
    );
    expect(result.message).toContain("Data tersimpan dan dikonfirmasi");
  });

  it("revalidasi gagal tidak mengubah status tersimpan", async () => {
    const result = await saveStockPrice(submission(), {
      gate: partnerGate(fakeDb({})),
      wait: noWait,
      afterSave: () => {
        throw new Error("revalidate gagal");
      },
    });
    expect(result.state).toBe("saved");
  });
});

describe("gagal yang PASTI", () => {
  it("input tidak valid: tidak ada pemanggilan database", async () => {
    const db = fakeDb({});
    const result = await saveStockPrice(submission({ stockKg: "1,255", pricePerKgIdr: "35.50" }), {
      gate: partnerGate(db),
      wait: noWait,
    });
    expect(result.state).toBe("invalid");
    expect(result.fieldErrors?.stock).toBeTruthy();
    expect(result.fieldErrors?.price).toBeTruthy();
    expect(db.confirm).not.toHaveBeenCalled();
  });

  it("kunci validasi database dipetakan ke kolom", async () => {
    const db = fakeDb({ confirm: async () => fail({ code: "22023", message: "price_not_whole" }, 400) });
    const result = await saveStockPrice(submission(), { gate: partnerGate(db), wait: noWait });
    expect(result).toMatchObject({ state: "invalid", fieldErrors: { price: "Harga harus dalam rupiah bulat." } });
  });

  it("error terstruktur lain → 'Data sebelumnya tidak berubah' (AC-29)", async () => {
    const db = fakeDb({ confirm: async () => fail({ code: "57014", message: "canceling statement" }, 500) });
    const result = await saveStockPrice(submission(), { gate: partnerGate(db), wait: noWait });
    expect(result).toMatchObject({ state: "rejected", message: MESSAGES.rejected });
    expect(db.read).not.toHaveBeenCalled();
  });

  it("sesi kedaluwarsa: pesan sesi, database tidak dipanggil (AC-24)", async () => {
    const db = fakeDb({});
    const result = await saveStockPrice(submission(), { gate: failingGate("session_expired"), wait: noWait });
    expect(result.state).toBe("session_expired");
    expect(result.message).toContain("Sesi Anda telah berakhir");
    expect(result.message).toContain("Isian Anda masih ada");
    expect(db.confirm).not.toHaveBeenCalled();
  });

  it("pemeriksaan akses gagal sementara: ditolak, BUKAN 'bukan mitra'", async () => {
    const result = await saveStockPrice(submission(), { gate: failingGate("access_check_failed"), wait: noWait });
    expect(result.state).toBe("access_check_failed");
    expect(result.message).not.toContain("tidak memiliki akses");
  });

  it("JWT ditolak PostgREST saat RPC → sesi berakhir", async () => {
    const db = fakeDb({ confirm: async () => fail({ code: "PGRST303", message: "JWT expired" }, 401) });
    const result = await saveStockPrice(submission(), { gate: partnerGate(db), wait: noWait });
    expect(result.state).toBe("session_expired");
  });
});

describe("hasil BELUM PASTI (AC-51)", () => {
  it("koneksi putus lalu data terbaca sesuai isian → terverifikasi, tanpa klaim 'tidak berubah'", async () => {
    const db = fakeDb({
      confirm: async () => fail(NETWORK_ERROR),
      read: async () => ok(row(12.5, 35000, T1)),
    });
    const result = await saveStockPrice(submission(), { gate: partnerGate(db), wait: noWait });
    expect(result.state).toBe("verified");
    expect(result.message).not.toContain("tidak berubah");
    expect(result.detail).toContain("12,5 kg");
    expect(result.saved?.confirmedAt).toBe(T1);
  });

  it("data lama masih terbaca → TETAP belum pasti, dengan tombol periksa ulang", async () => {
    const db = fakeDb({ confirm: async () => fail(NETWORK_ERROR), read: async () => ok(row(10, 32000, T0)) });
    const result = await saveStockPrice(submission(), { gate: partnerGate(db), wait: noWait });
    expect(result.state).toBe("uncertain");
    expect(result.canRecheck).toBe(true);
    expect(result.detail).toBe(MESSAGES.uncertainNotYetVisible);
    expect(`${result.message} ${result.detail}`).not.toContain("Data sebelumnya tidak berubah");
  });

  it("pembacaan ulang juga gagal → belum pasti + arahan muat ulang", async () => {
    const db = fakeDb({ confirm: async () => fail(NETWORK_ERROR), read: async () => fail(NETWORK_ERROR) });
    const result = await saveStockPrice(submission(), { gate: partnerGate(db), wait: noWait });
    expect(result).toMatchObject({ state: "uncertain", detail: MESSAGES.uncertainReadFailed, canRecheck: true });
  });

  it("waktu berubah tetapi angka berbeda → diubah dari tempat lain, nilai tersimpan ditampilkan", async () => {
    const db = fakeDb({ confirm: async () => fail(NETWORK_ERROR), read: async () => ok(row(8, 30000, T1)) });
    const result = await saveStockPrice(submission(), { gate: partnerGate(db), wait: noWait });
    expect(result.state).toBe("changed_elsewhere");
    expect(result.detail).toContain("8 kg");
  });

  it("gateway 502 tanpa kode → belum pasti; penulisan TIDAK diulang otomatis", async () => {
    const db = fakeDb({ confirm: async () => fail({ message: "<html>502</html>" }, 502) });
    await saveStockPrice(submission(), { gate: partnerGate(db), wait: noWait });
    expect(db.confirm).toHaveBeenCalledTimes(1);
    expect(db.read).toHaveBeenCalledTimes(1);
  });

  it("jawaban sukses tanpa isi yang terbaca → dibaca ulang, bukan dianggap berhasil", async () => {
    const db = fakeDb({ confirm: async () => ok(null), read: async () => ok(row(12.5, 35000, T1)) });
    const result = await saveStockPrice(submission(), { gate: partnerGate(db), wait: noWait });
    expect(result.state).toBe("verified");
  });

  it("'Periksa ulang' memakai isian yang dikirim dan tidak menulis", async () => {
    const db = fakeDb({ read: async () => ok(row(12.5, 35000, T1)) });
    const result = await recheckStockPrice(submission(), { gate: partnerGate(db), wait: noWait });
    expect(result.state).toBe("verified");
    expect(db.confirm).not.toHaveBeenCalled();
  });
});
