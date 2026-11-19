/**
 * Akses data uji E2E ke proyek dev/staging TERVERIFIKASI (tests/support/cloud-target.ts). Kredensial hanya dari
 * `.env.local`; tidak ada yang dicetak. Tidak memakai service-role key: operasi tulis berjalan sebagai akun
 * mitra uji lewat fungsi/kolom yang memang diizinkan.
 */
import { appendFileSync, readFileSync } from "node:fs";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { readEnvLocalFile, resolveCloudTarget, type CloudTarget } from "../../support/cloud-target";

export const FIXTURE_PREFIX = "UJI-E2E";
export const STATE_DIR = process.env.PASARNILA_E2E_ISOLATED === "1" ? ".playwright/phase9/state" : ".playwright/state";
export const PARTNER_STATE = `${STATE_DIR}/partner.json`;
export const ORIGINALS = `${STATE_DIR}/originals.json`;
export const RUN_LOCK = ".playwright/state/run.lock";
export const PACKAGE_LEDGER = `${STATE_DIR}/packages.jsonl`;
export const BUSINESS_LEDGER = `${STATE_DIR}/business.jsonl`;

type BrowserTarget = Omit<CloudTarget, "dbUrl" | "partner" | "outsider"> & {
  partner: NonNullable<CloudTarget["partner"]>;
  outsider: NonNullable<CloudTarget["outsider"]>;
};

export function cloudTarget(): BrowserTarget {
  const env = readEnvLocalFile();
  // This suite uses the app/Data API only; never parse or select a direct SQL credential here.
  const resolved = resolveCloudTarget(env && { ...env, SUPABASE_DB_URL: "" });
  if (!resolved.ok) throw new Error(`Target cloud belum terverifikasi: ${resolved.reasons.join("; ")}`);
  if (!resolved.target.partner || !resolved.target.outsider) {
    throw new Error("E2E_PARTNER_* / E2E_OUTSIDER_* belum diisi di .env.local");
  }
  const { ref, targetEnv, supabaseUrl, publishableKey, partner, outsider } = resolved.target;
  const linked = z.object({ ref: z.string() }).parse(JSON.parse(readFileSync("supabase/.temp/linked-project.json", "utf8")));
  if (linked.ref !== ref) throw new Error("Linked project berbeda dari target aplikasi");
  return { ref, targetEnv, supabaseUrl, publishableKey, partner, outsider };
}

export function anonClient(target = cloudTarget()): SupabaseClient {
  return createClient(target.supabaseUrl, target.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export async function partnerClient(target = cloudTarget()): Promise<SupabaseClient> {
  const client = anonClient(target);
  const { error } = await client.auth.signInWithPassword(target.partner);
  if (error) throw new Error("Login akun mitra uji gagal");
  return client;
}

const originalsSchema = z.object({
  businessName: z.string(), stockKg: z.number().min(0).max(100000).nullable(),
  pricePerKgIdr: z.number().int().min(0).max(10000000).nullable(), productId: z.uuid(),
  articleTitle: z.string(), articleBody: z.string(), confirmedAt: z.string().nullable(),
  productUpdatedAt: z.string(), settingsUpdatedAt: z.string(), articleUpdatedAt: z.string(),
});
export type Originals = z.infer<typeof originalsSchema>;

export async function readOriginals(client: SupabaseClient): Promise<Originals> {
  const [product, settings, article] = await Promise.all([
    client.from("products").select("id, stock_kg, price_per_kg_idr, stock_price_confirmed_at, updated_at").eq("slug", "ikan-nila").single(),
    client.from("site_settings").select("business_name, updated_at").single(),
    client.from("articles").select("title, body, updated_at").eq("slug", "artikel-1").single(),
  ]);
  if (product.error || settings.error || article.error) throw new Error("Gagal membaca nilai awal");
  const baseline = originalsSchema.safeParse({
    productId: product.data.id,
    stockKg: product.data.stock_kg,
    pricePerKgIdr: product.data.price_per_kg_idr,
    businessName: settings.data.business_name,
    articleTitle: article.data.title,
    articleBody: article.data.body,
    confirmedAt: product.data.stock_price_confirmed_at,
    productUpdatedAt: product.data.updated_at,
    settingsUpdatedAt: settings.data.updated_at,
    articleUpdatedAt: article.data.updated_at,
  });
  if (!baseline.success) throw new Error("Bentuk nilai awal tidak valid; pengujian tulis tidak aman");
  return baseline.data;
}

export function originalValues(): Originals {
  return originalsSchema.parse(JSON.parse(readFileSync(ORIGINALS, "utf8")));
}

export function registerPackage(name: string): void {
  appendFileSync(PACKAGE_LEDGER, `${JSON.stringify(name)}\n`);
}

export async function fixturePackages(client: SupabaseClient, productId: string, names: string[]) {
  if (names.length === 0) return [];
  const { data, error } = await client.from("product_packages").select("id").eq("product_id", productId).in("name", names);
  if (error) throw new Error(`Gagal membaca paket uji: ${error.code}`);
  return data;
}

/** Hanya nama persis yang didaftarkan sebelum penulisan, pada produk yang diketahui. */
export async function deleteFixturePackages(client: SupabaseClient, productId: string, names: string[]): Promise<number> {
  const rows = await fixturePackages(client, productId, names);
  for (const { id } of rows) {
    const { error } = await client.rpc("delete_product_package", { p_id: id });
    if (error) throw new Error(`Gagal menghapus paket uji: ${error.code}`);
  }
  if ((await fixturePackages(client, productId, names)).length) throw new Error("Paket uji masih tersisa");
  return rows.length;
}

export const BUSINESS_FIELDS = ["stockPrice", "article", "settings"] as const;
export type BusinessField = (typeof BUSINESS_FIELDS)[number];

function differences(before: Originals, after: Originals): BusinessField[] {
  const fields: BusinessField[] = [];
  if (before.stockKg !== after.stockKg || before.pricePerKgIdr !== after.pricePerKgIdr) fields.push("stockPrice");
  if (before.articleTitle !== after.articleTitle || before.articleBody !== after.articleBody) fields.push("article");
  if (before.businessName !== after.businessName) fields.push("settings");
  return fields;
}

export async function restoreBusiness(client: SupabaseClient, before: Originals, fields: readonly BusinessField[]) {
  const now = await readOriginals(client);
  if (now.productId !== before.productId) throw new Error("Identitas produk berubah; pemulihan dibatalkan");
  const restored = differences(before, now).filter((field) => fields.includes(field));
  for (const field of restored) {
    if (field === "stockPrice" && (before.stockKg === null || before.pricePerKgIdr === null)) {
      throw new Error("Baseline stok/harga tidak bisa dipulihkan lewat RPC");
    }
    const result = field === "stockPrice"
      ? await client.rpc("confirm_product_stock_price", {
          p_product_id: before.productId, p_stock_kg: String(before.stockKg), p_price_per_kg_idr: before.pricePerKgIdr,
        })
      : field === "article"
        ? await client.from("articles").update({ title: before.articleTitle, body: before.articleBody }).eq("slug", "artikel-1")
        : await client.from("site_settings").update({ business_name: before.businessName }).eq("id", true);
    if (result.error) throw new Error(`Gagal memulihkan ${field}: ${result.error.code}`);
  }
  const final = restored.length ? await readOriginals(client) : now;
  if (differences(before, final).some((field) => fields.includes(field))) throw new Error("Nilai bisnis belum pulih");
  return { restored, final };
}
