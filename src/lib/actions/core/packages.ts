/**
 * Inti Server Action paket katalog (PRD §12.8, AC-53–AC-60; ARCHITECTURE.md §5.7, §10.4).
 *
 * - Tulis HANYA lewat RPC `create_/update_/delete_product_package` (tidak ada hak tulis langsung ke tabel).
 * - Tambah paket memakai ID dari browser (satu per isian formulir). Mengirim ulang permintaan yang sama
 *   setelah hasil belum pasti TIDAK membuat paket ganda: database mengembalikan baris yang sudah ada.
 * - CRUD paket tidak menyentuh stok, harga satuan, atau waktu konfirmasi produk.
 * - Tidak ada pengiriman ulang otomatis.
 */
import { z } from "zod";

import {
  formText,
  formTimestamp,
  formUuid,
  kgToCenti,
  numericColumn,
  RECHECK_DELAY_MS,
  runSideEffect,
  type Gate,
} from "@/lib/actions/core/shared";
import { formatWib } from "@/lib/format/datetime";
import { formatKg, formatRupiah } from "@/lib/format/number";
import {
  canonicalKgToCenti,
  PACKAGE_PRICE_ERROR_MESSAGES,
  parsePackagePriceInput,
  parsePackageWeightInput,
  WEIGHT_ERROR_MESSAGES,
} from "@/lib/validation/stock-price-input";
import { PACKAGE_NAME_MESSAGES, validatePackageName } from "@/lib/validation/text-input";
import { MESSAGES, type ActionResult } from "@/lib/write/action-result";
import { certainFailureResult, type FieldError } from "@/lib/write/map-failure";
import { classifyWriteError, judgeRecheck, type DbResponse } from "@/lib/write/outcome";

export type PackageField = "name" | "weight" | "price";
export type PackageOperation = "create" | "update" | "delete";

export type PackageSaved = {
  id: string;
  name: string;
  weightKg: number;
  weightLabel: string;
  priceTotalIdr: number;
  priceLabel: string;
  updatedAt: string;
  updatedAtLabel: string;
};

export type PackageResult = ActionResult<PackageSaved, PackageField> & {
  operation: PackageOperation;
  /** Paket yang dipastikan sudah tidak ada (hapus berhasil/terverifikasi). */
  deletedId?: string;
};

export interface PackageDb {
  create(input: { id: string; productId: string; name: string; weightCanonical: string; priceIdr: number }): Promise<DbResponse>;
  update(input: { id: string; name: string; weightCanonical: string; priceIdr: number }): Promise<DbResponse>;
  remove(id: string): Promise<DbResponse>;
  read(id: string): Promise<DbResponse>;
}

export type PackageDeps = {
  gate: Gate<PackageDb>;
  wait(ms: number): Promise<void>;
  afterSave?: () => void;
};

const packageRow = z.object({
  id: z.string(),
  name: z.string(),
  weight_kg: numericColumn,
  price_total_idr: z.number().int(),
  updated_at: z.string(),
});

type PackageRow = z.infer<typeof packageRow>;

function toSaved(row: PackageRow): PackageSaved | null {
  try {
    return {
      id: row.id,
      name: row.name,
      weightKg: row.weight_kg,
      weightLabel: formatKg(row.weight_kg),
      priceTotalIdr: row.price_total_idr,
      priceLabel: formatRupiah(row.price_total_idr),
      updatedAt: row.updated_at,
      updatedAtLabel: formatWib(row.updated_at),
    };
  } catch {
    return null;
  }
}

function describe(saved: PackageSaved): string {
  return `“${saved.name}” (${saved.weightLabel}, ${saved.priceLabel})`;
}

function fieldForKey(key: string | null): FieldError<PackageField> | null {
  switch (key) {
    case "package_name_required":
      return { field: "name", message: PACKAGE_NAME_MESSAGES.empty };
    case "package_name_too_long":
      return { field: "name", message: PACKAGE_NAME_MESSAGES.length };
    case "package_name_line_break":
      return { field: "name", message: PACKAGE_NAME_MESSAGES.lineBreak };
    case "package_weight_required":
      return { field: "weight", message: WEIGHT_ERROR_MESSAGES.empty };
    case "package_weight_out_of_range":
      return { field: "weight", message: `${WEIGHT_ERROR_MESSAGES.not_positive} ${WEIGHT_ERROR_MESSAGES.out_of_range}` };
    case "package_weight_too_many_decimals":
      return { field: "weight", message: WEIGHT_ERROR_MESSAGES.too_many_decimals };
    case "package_price_required":
      return { field: "price", message: PACKAGE_PRICE_ERROR_MESSAGES.empty };
    case "package_price_out_of_range":
      return { field: "price", message: PACKAGE_PRICE_ERROR_MESSAGES.out_of_range };
    case "package_price_not_whole":
      return { field: "price", message: PACKAGE_PRICE_ERROR_MESSAGES.not_whole };
    default:
      return null;
  }
}

const NOT_FOUND_MESSAGE = "Paket tidak ditemukan (mungkin sudah dihapus). Muat ulang daftar paket.";
const CONFLICT_MESSAGE =
  "Permintaan tambah ini bentrok dengan paket lain yang sudah tersimpan. Tidak ada yang berubah. Muat ulang halaman, lalu isi ulang formulir.";

type Values = { name: string; weightCanonical: string; weightCenti: number; priceIdr: number };

function parseValues(formData: FormData): { ok: true; values: Values } | { ok: false; result: PackageResult; } {
  const name = validatePackageName(formText(formData, "name"));
  const weight = parsePackageWeightInput(formText(formData, "weightKg"));
  const price = parsePackagePriceInput(formText(formData, "priceTotalIdr"));
  if (!name.ok || !weight.ok || !price.ok) {
    return {
      ok: false,
      result: {
        operation: "create",
        state: "invalid",
        message: MESSAGES.invalid,
        fieldErrors: {
          name: name.ok ? undefined : name.message,
          weight: weight.ok ? undefined : weight.message,
          price: price.ok ? undefined : price.message,
        },
      },
    };
  }
  return {
    ok: true,
    values: {
      name: name.value,
      weightCanonical: weight.canonical,
      weightCenti: canonicalKgToCenti(weight.canonical),
      priceIdr: price.idr,
    },
  };
}

function matches(row: PackageRow, values: Values): boolean {
  return row.name === values.name && kgToCenti(row.weight_kg) === values.weightCenti && row.price_total_idr === values.priceIdr;
}

async function readRow(db: PackageDb, id: string): Promise<{ ok: true; row: PackageRow | null } | { ok: false }> {
  const read = await db.read(id);
  if (read.error) return { ok: false };
  const parsed = packageRow.nullable().safeParse(read.data);
  return parsed.success ? { ok: true, row: parsed.data } : { ok: false };
}

function uncertain(operation: PackageOperation, detail: string): PackageResult {
  return { operation, state: "uncertain", message: MESSAGES.uncertain, detail, canRecheck: true };
}

// ---------------------------------------------------------------------------------------------
// Verifikasi setelah hasil belum pasti
// ---------------------------------------------------------------------------------------------

async function verifyCreate(db: PackageDb, id: string, values: Values): Promise<PackageResult> {
  const read = await readRow(db, id);
  if (!read.ok) return uncertain("create", MESSAGES.uncertainReadFailed);
  if (read.row === null) {
    return uncertain(
      "create",
      "Saat diperiksa, paket ini belum terlihat tersimpan. Permintaan mungkin masih diproses atau tidak sampai. Tekan “Periksa ulang” beberapa saat lagi. Menekan Simpan lagi aman: permintaan yang sama tidak membuat paket ganda.",
    );
  }
  const saved = toSaved(read.row);
  if (!saved) return uncertain("create", MESSAGES.uncertainReadFailed);
  return matches(read.row, values)
    ? {
        operation: "create",
        state: "verified",
        message: `Status penyimpanan sempat belum pasti. Saat diperiksa ulang, paket ${describe(saved)} sudah tersimpan.`,
        saved,
      }
    : { operation: "create", state: "changed_elsewhere", message: MESSAGES.changedElsewhere, detail: `Tersimpan: ${describe(saved)}.`, saved };
}

async function verifyUpdate(db: PackageDb, id: string, values: Values, baselineUpdatedAt: string | null): Promise<PackageResult> {
  const read = await readRow(db, id);
  if (!read.ok) return uncertain("update", MESSAGES.uncertainReadFailed);
  if (read.row === null) return { operation: "update", state: "not_found", message: NOT_FOUND_MESSAGE };
  const saved = toSaved(read.row);
  if (!saved) return uncertain("update", MESSAGES.uncertainReadFailed);
  const verdict = judgeRecheck({ baselineAt: baselineUpdatedAt, currentAt: read.row.updated_at, matchesSubmission: matches(read.row, values) });
  if (verdict === "matches_submission") {
    return {
      operation: "update",
      state: "verified",
      message: `Status penyimpanan sempat belum pasti. Saat diperiksa ulang, paket tersimpan sudah sesuai isian Anda: ${describe(saved)}.`,
      saved,
    };
  }
  if (verdict === "changed_elsewhere") {
    return { operation: "update", state: "changed_elsewhere", message: MESSAGES.changedElsewhere, detail: `Tersimpan: ${describe(saved)}.`, saved };
  }
  return uncertain("update", MESSAGES.uncertainNotYetVisible);
}

async function verifyDelete(db: PackageDb, id: string, name: string): Promise<PackageResult> {
  const read = await readRow(db, id);
  if (!read.ok) return uncertain("delete", MESSAGES.uncertainReadFailed);
  if (read.row === null) {
    return {
      operation: "delete",
      state: "verified",
      message: `Status penghapusan sempat belum pasti. Saat diperiksa ulang, paket “${name}” sudah tidak ada di database.`,
      deletedId: id,
    };
  }
  return uncertain(
    "delete",
    "Saat diperiksa, paket ini masih ada. Permintaan hapus mungkin masih diproses atau tidak sampai. Tekan “Periksa ulang” beberapa saat lagi; bila masih ada, Anda boleh menghapus lagi.",
  );
}

// ---------------------------------------------------------------------------------------------
// Operasi
// ---------------------------------------------------------------------------------------------

export async function createPackage(formData: FormData, deps: PackageDeps): Promise<PackageResult> {
  const id = formUuid(formData, "requestId");
  const productId = formUuid(formData, "productId");
  if (!id || !productId) {
    return { operation: "create", state: "invalid", message: "Formulir tidak lengkap. Muat ulang halaman panel. Tidak ada yang berubah." };
  }
  const parsed = parseValues(formData);
  if (!parsed.ok) return parsed.result;
  const { values } = parsed;

  const gate = await deps.gate();
  if (!gate.ok) return { ...gate.result, operation: "create" };

  const response = await gate.db.create({ id, productId, name: values.name, weightCanonical: values.weightCanonical, priceIdr: values.priceIdr });
  if (response.error) {
    const failure = classifyWriteError(response.error, response.status);
    if (failure.kind !== "uncertain") {
      const mapped = certainFailureResult<PackageSaved, PackageField>(failure, {
        fieldForKey,
        notFoundMessage: "Produk tidak ditemukan di database. Paket tidak ditambahkan.",
        conflictMessage: CONFLICT_MESSAGE,
      });
      return { ...mapped, operation: "create" };
    }
    await deps.wait(RECHECK_DELAY_MS);
    return verifyCreate(gate.db, id, values);
  }
  const row = packageRow.safeParse(response.data);
  const saved = row.success ? toSaved(row.data) : null;
  if (!saved) {
    await deps.wait(RECHECK_DELAY_MS);
    return verifyCreate(gate.db, id, values);
  }
  runSideEffect(deps.afterSave);
  return { operation: "create", state: "saved", message: `Paket ${describe(saved)} ditambahkan ke katalog.`, saved };
}

export async function updatePackage(formData: FormData, deps: PackageDeps): Promise<PackageResult> {
  const id = formUuid(formData, "packageId");
  if (!id) return { operation: "update", state: "invalid", message: "ID paket tidak valid. Muat ulang halaman panel. Tidak ada yang berubah." };
  const parsed = parseValues(formData);
  if (!parsed.ok) return { ...parsed.result, operation: "update" };
  const { values } = parsed;
  const baselineUpdatedAt = formTimestamp(formData, "baselineUpdatedAt");

  const gate = await deps.gate();
  if (!gate.ok) return { ...gate.result, operation: "update" };

  const response = await gate.db.update({ id, name: values.name, weightCanonical: values.weightCanonical, priceIdr: values.priceIdr });
  if (response.error) {
    const failure = classifyWriteError(response.error, response.status);
    if (failure.kind !== "uncertain") {
      return {
        ...certainFailureResult<PackageSaved, PackageField>(failure, { fieldForKey, notFoundMessage: NOT_FOUND_MESSAGE }),
        operation: "update",
      };
    }
    await deps.wait(RECHECK_DELAY_MS);
    return verifyUpdate(gate.db, id, values, baselineUpdatedAt);
  }
  const row = packageRow.safeParse(response.data);
  const saved = row.success ? toSaved(row.data) : null;
  if (!saved) {
    await deps.wait(RECHECK_DELAY_MS);
    return verifyUpdate(gate.db, id, values, baselineUpdatedAt);
  }
  runSideEffect(deps.afterSave);
  return { operation: "update", state: "saved", message: `Paket diperbarui: ${describe(saved)}.`, saved };
}

export async function deletePackage(formData: FormData, deps: PackageDeps): Promise<PackageResult> {
  const id = formUuid(formData, "packageId");
  const name = formText(formData, "name").trim() || "ini";
  if (!id) return { operation: "delete", state: "invalid", message: "ID paket tidak valid. Muat ulang halaman panel. Tidak ada yang berubah." };

  const gate = await deps.gate();
  if (!gate.ok) return { ...gate.result, operation: "delete" };

  const response = await gate.db.remove(id);
  if (response.error) {
    const failure = classifyWriteError(response.error, response.status);
    if (failure.kind === "not_found") {
      // Tujuan hapus sudah tercapai: paket memang tidak ada (mis. hapus sebelumnya ternyata berhasil).
      runSideEffect(deps.afterSave);
      return { operation: "delete", state: "verified", message: `Paket “${name}” sudah tidak ada di database.`, deletedId: id };
    }
    if (failure.kind !== "uncertain") {
      return { ...certainFailureResult<PackageSaved, PackageField>(failure), operation: "delete" };
    }
    await deps.wait(RECHECK_DELAY_MS);
    const verified = await verifyDelete(gate.db, id, name);
    if (verified.deletedId) runSideEffect(deps.afterSave);
    return verified;
  }
  runSideEffect(deps.afterSave);
  return { operation: "delete", state: "saved", message: `Paket “${name}” dihapus dari katalog.`, deletedId: id };
}

/** "Periksa ulang" untuk operasi yang hasilnya belum pasti. Tidak pernah menulis. */
export async function recheckPackage(formData: FormData, deps: PackageDeps): Promise<PackageResult> {
  const operation = formText(formData, "operation") as PackageOperation;
  const idField = operation === "create" ? "requestId" : "packageId";
  const id = formUuid(formData, idField);
  if (!id || !["create", "update", "delete"].includes(operation)) {
    return { operation: "create", state: "invalid", message: "Data pemeriksaan tidak lengkap. Muat ulang halaman panel." };
  }
  const gate = await deps.gate();
  if (!gate.ok) return { ...gate.result, operation };

  let result: PackageResult;
  if (operation === "delete") {
    result = await verifyDelete(gate.db, id, formText(formData, "name").trim() || "ini");
  } else {
    const parsed = parseValues(formData);
    if (!parsed.ok) return { ...parsed.result, operation };
    result =
      operation === "create"
        ? await verifyCreate(gate.db, id, parsed.values)
        : await verifyUpdate(gate.db, id, parsed.values, formTimestamp(formData, "baselineUpdatedAt"));
  }
  if (result.state === "verified" || result.state === "changed_elsewhere") runSideEffect(deps.afterSave);
  return result;
}
