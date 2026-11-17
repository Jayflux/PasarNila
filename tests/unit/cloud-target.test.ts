import { describe, expect, it } from "vitest";

import { resolveCloudTarget } from "../support/cloud-target";

// Semua nilai FIKTIF.
const REF = "abcdefghijklmnopqrst";
const BASE = {
  NEXT_PUBLIC_SUPABASE_URL: `https://${REF}.supabase.co`,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_FAKE_value",
  SUPABASE_PROJECT_REF: REF,
  SUPABASE_TARGET_ENV: "staging",
};

describe("resolveCloudTarget — penjaga uji/migrasi cloud", () => {
  it("lulus hanya bila peruntukan dev/staging eksplisit dan ref cocok", () => {
    const result = resolveCloudTarget(BASE);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.target).toMatchObject({ ref: REF, targetEnv: "staging", dbUrl: null });
  });

  it("menolak bila peruntukan belum dinyatakan (proyek kosong ≠ otomatis staging)", () => {
    const result = resolveCloudTarget({ ...BASE, SUPABASE_TARGET_ENV: "" });
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.reasons.join(" ")).toContain("SUPABASE_TARGET_ENV");
  });

  it("selalu menolak production", () => {
    const result = resolveCloudTarget({ ...BASE, SUPABASE_TARGET_ENV: "production" });
    expect(result.ok).toBe(false);
  });

  it("menolak ref yang tidak cocok dengan URL", () => {
    expect(resolveCloudTarget({ ...BASE, SUPABASE_PROJECT_REF: "proyeklainyangberbed" }).ok).toBe(false);
    expect(resolveCloudTarget({ ...BASE, SUPABASE_PROJECT_REF: "" }).ok).toBe(false);
  });

  it("menolak SUPABASE_DB_URL milik proyek lain tanpa membocorkan nilainya", () => {
    const result = resolveCloudTarget({
      ...BASE,
      SUPABASE_DB_URL: "postgresql://postgres.proyeklain:RAHASIA_X@pooler.example.test:5432/postgres",
    });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain("RAHASIA_X");
  });

  it("menerima SUPABASE_DB_URL pooler atau direct untuk ref yang sama", () => {
    for (const dbUrl of [
      `postgresql://postgres.${REF}:x@pooler.example.test:5432/postgres`,
      `postgresql://postgres:x@db.${REF}.supabase.co:5432/postgres`,
    ]) {
      const result = resolveCloudTarget({ ...BASE, SUPABASE_DB_URL: dbUrl });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.target.dbUrl).toBe(dbUrl);
    }
  });

  it("akun mitra dan non-mitra harus berbeda", () => {
    const result = resolveCloudTarget({
      ...BASE,
      E2E_PARTNER_EMAIL: "a@example.test",
      E2E_PARTNER_PASSWORD: "x",
      E2E_OUTSIDER_EMAIL: "A@example.test",
      E2E_OUTSIDER_PASSWORD: "y",
    });
    expect(result.ok).toBe(false);
  });
});
