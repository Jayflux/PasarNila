/**
 * Inti Server Action paket (PRD §12.8, AC-53–AC-60; ARCHITECTURE §5.7, §10.4).
 */
import { describe, expect, it, vi } from "vitest";

import { createPackage, deletePackage, recheckPackage, updatePackage, type PackageDb } from "@/lib/actions/core/packages";
import { MESSAGES } from "@/lib/write/action-result";

import { fail, failingGate, form, NETWORK_ERROR, noWait, ok, partnerGate } from "./support/action-fakes";

const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";
const REQUEST_ID = "77777777-7777-4777-8777-777777777777";
const T0 = "2026-11-19T01:00:00+00:00";
const T1 = "2026-11-19T01:05:00.25+00:00";

const row = (overrides: Partial<{ name: string; weight_kg: number; price_total_idr: number; updated_at: string }> = {}) => ({
  id: REQUEST_ID,
  name: "Paket Hemat",
  weight_kg: 100,
  price_total_idr: 3_100_000,
  updated_at: T1,
  ...overrides,
});

function fakeDb(overrides: Partial<Record<keyof PackageDb, () => Promise<unknown>>> = {}) {
  return {
    create: vi.fn(overrides.create ?? (async () => ok(row()))),
    update: vi.fn(overrides.update ?? (async () => ok(row()))),
    remove: vi.fn(overrides.remove ?? (async () => ok(row()))),
    read: vi.fn(overrides.read ?? (async () => ok(null))),
  } as unknown as PackageDb & Record<keyof PackageDb, ReturnType<typeof vi.fn>>;
}

const createForm = (overrides: Record<string, string> = {}) =>
  form({
    operation: "create",
    requestId: REQUEST_ID,
    productId: PRODUCT_ID,
    name: "  Paket   Hemat ",
    weightKg: "100",
    priceTotalIdr: "3.100.000",
    ...overrides,
  });

const updateForm = (overrides: Record<string, string> = {}) =>
  form({
    operation: "update",
    packageId: REQUEST_ID,
    name: "Paket Hemat",
    weightKg: "100",
    priceTotalIdr: "3100000",
    baselineUpdatedAt: T0,
    ...overrides,
  });

describe("tambah paket", () => {
  it("berhasil: nilai kanonik dikirim ke RPC, pesan menyebut paket", async () => {
    const db = fakeDb();
    const afterSave = vi.fn();
    const result = await createPackage(createForm(), { gate: partnerGate(db), wait: noWait, afterSave });
    expect(result).toMatchObject({ operation: "create", state: "saved" });
    expect(result.message).toContain("“Paket Hemat” (100 kg, Rp3.100.000)");
    expect(db.create).toHaveBeenCalledWith({
      id: REQUEST_ID,
      productId: PRODUCT_ID,
      name: "Paket Hemat",
      weightCanonical: "100",
      priceIdr: 3_100_000,
    });
    expect(afterSave).toHaveBeenCalledOnce();
  });

  it("ID permintaan wajib (pencegah paket ganda); tanpa ID tidak ada penulisan", async () => {
    const db = fakeDb();
    const result = await createPackage(createForm({ requestId: "" }), { gate: partnerGate(db), wait: noWait });
    expect(result.state).toBe("invalid");
    expect(db.create).not.toHaveBeenCalled();
  });

  it("koneksi putus, paket belum terlihat → tetap belum pasti; simpan lagi aman (ID sama)", async () => {
    const db = fakeDb({ create: async () => fail(NETWORK_ERROR), read: async () => ok(null) });
    const result = await createPackage(createForm(), { gate: partnerGate(db), wait: noWait });
    expect(result).toMatchObject({ state: "uncertain", canRecheck: true });
    expect(result.detail).toContain("tidak membuat paket ganda");
    expect(db.create).toHaveBeenCalledTimes(1);
  });

  it("koneksi putus, paket sudah tersimpan → terverifikasi", async () => {
    const db = fakeDb({ create: async () => fail(NETWORK_ERROR), read: async () => ok(row()) });
    const result = await createPackage(createForm(), { gate: partnerGate(db), wait: noWait });
    expect(result.state).toBe("verified");
  });

  it("ID dipakai paket lain (23505) → ditolak pasti dengan arahan muat ulang", async () => {
    const db = fakeDb({ create: async () => fail({ code: "23505", message: "package_id_conflict" }, 409) });
    const result = await createPackage(createForm(), { gate: partnerGate(db), wait: noWait });
    expect(result.state).toBe("rejected");
    expect(result.message).toContain("Muat ulang halaman");
  });

  it("kunci validasi database dipetakan ke kolom", async () => {
    const db = fakeDb({ create: async () => fail({ code: "22023", message: "package_weight_too_many_decimals" }, 400) });
    const result = await createPackage(createForm(), { gate: partnerGate(db), wait: noWait });
    expect(result.fieldErrors?.weight).toBeTruthy();
  });

  it("isian tidak valid ditolak di server tanpa memanggil database", async () => {
    const db = fakeDb();
    const result = await createPackage(createForm({ name: " ", weightKg: "0", priceTotalIdr: "35.50" }), {
      gate: partnerGate(db),
      wait: noWait,
    });
    expect(result.state).toBe("invalid");
    expect(Object.keys(result.fieldErrors ?? {}).sort()).toEqual(["name", "price", "weight"]);
    expect(db.create).not.toHaveBeenCalled();
  });

  it("sesi berakhir → hasil sesi, tidak menulis (isian tetap di browser)", async () => {
    const db = fakeDb();
    const result = await createPackage(createForm(), { gate: failingGate("session_expired"), wait: noWait });
    expect(result).toMatchObject({ operation: "create", state: "session_expired" });
    expect(db.create).not.toHaveBeenCalled();
  });

  it("gangguan pemeriksaan akses → ditolak, bukan 'bukan mitra'", async () => {
    const result = await createPackage(createForm(), { gate: failingGate("access_check_failed"), wait: noWait });
    expect(result.state).toBe("access_check_failed");
  });
});

describe("ubah paket", () => {
  it("berhasil", async () => {
    const result = await updatePackage(updateForm(), { gate: partnerGate(fakeDb()), wait: noWait });
    expect(result).toMatchObject({ operation: "update", state: "saved" });
    expect(result.saved?.updatedAt).toBe(T1);
  });

  it("belum pasti + updated_at masih baseline → TETAP belum pasti (data lama bukan bukti gagal)", async () => {
    const db = fakeDb({ update: async () => fail(NETWORK_ERROR), read: async () => ok(row({ updated_at: T0, price_total_idr: 1 })) });
    const result = await updatePackage(updateForm(), { gate: partnerGate(db), wait: noWait });
    expect(result).toMatchObject({ state: "uncertain", detail: MESSAGES.uncertainNotYetVisible });
  });

  it("belum pasti + data baru cocok → terverifikasi", async () => {
    const db = fakeDb({ update: async () => fail(NETWORK_ERROR), read: async () => ok(row()) });
    const result = await updatePackage(updateForm(), { gate: partnerGate(db), wait: noWait });
    expect(result.state).toBe("verified");
  });

  it("paket sudah tidak ada → not_found pasti", async () => {
    const db = fakeDb({ update: async () => fail({ code: "P0002", message: "package_not_found" }, 400) });
    const result = await updatePackage(updateForm(), { gate: partnerGate(db), wait: noWait });
    expect(result.state).toBe("not_found");
  });
});

describe("hapus paket", () => {
  const deleteForm = form({ operation: "delete", packageId: REQUEST_ID, name: "Paket Hemat" });

  it("berhasil → deletedId", async () => {
    const result = await deletePackage(deleteForm, { gate: partnerGate(fakeDb()), wait: noWait });
    expect(result).toMatchObject({ state: "saved", deletedId: REQUEST_ID });
    expect(result.message).toContain("Paket Hemat");
  });

  it("sudah tidak ada (P0002) → tujuan tercapai", async () => {
    const db = fakeDb({ remove: async () => fail({ code: "P0002", message: "package_not_found" }, 400) });
    const result = await deletePackage(deleteForm, { gate: partnerGate(db), wait: noWait });
    expect(result).toMatchObject({ state: "verified", deletedId: REQUEST_ID });
  });

  it("belum pasti dan paket masih terlihat → belum pasti, dapat diperiksa ulang", async () => {
    const db = fakeDb({ remove: async () => fail(NETWORK_ERROR), read: async () => ok(row()) });
    const result = await deletePackage(deleteForm, { gate: partnerGate(db), wait: noWait });
    expect(result).toMatchObject({ state: "uncertain", canRecheck: true });
    expect(result.deletedId).toBeUndefined();
  });

  it("periksa ulang: paket tidak ada lagi → terhapus terverifikasi, tanpa menulis", async () => {
    const db = fakeDb({ read: async () => ok(null) });
    const result = await recheckPackage(deleteForm, { gate: partnerGate(db), wait: noWait });
    expect(result).toMatchObject({ state: "verified", deletedId: REQUEST_ID });
    expect(db.remove).not.toHaveBeenCalled();
  });
});
