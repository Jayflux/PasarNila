import { describe, expect, it } from "vitest";

import {
  checkEnvironment,
  EnvValidationError,
  getSiteUrl,
  getSupabasePublicEnv,
  getWhatsAppConfig,
  isEnvCheckPassing,
  isIndexingAllowed,
  type EnvCheckRow,
  type EnvSource,
} from "@/lib/env";

// Semua nilai di bawah FIKTIF, hanya untuk menguji format.
const FAKE_REF = "abcdefghijklmnopqrst";
const VALID: EnvSource = {
  NEXT_PUBLIC_SUPABASE_URL: `https://${FAKE_REF}.supabase.co`,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_FAKE_test_value_123",
  NEXT_PUBLIC_SITE_URL: "https://contoh.vercel.app",
  WHATSAPP_NUMBER: "6281200000000",
  ALLOW_INDEXING: "false",
};

function row(rows: EnvCheckRow[], name: string): EnvCheckRow | undefined {
  return rows.find((r) => r.name === name);
}

describe("getSupabasePublicEnv", () => {
  it("mengembalikan origin dan publishable key yang valid", () => {
    expect(getSupabasePublicEnv(VALID)).toEqual({
      url: `https://${FAKE_REF}.supabase.co`,
      publishableKey: "sb_publishable_FAKE_test_value_123",
    });
  });

  it("menolak secret key tanpa membocorkan nilainya", () => {
    const secret = "sb_secret_DO_NOT_LEAK_123";
    let caught: unknown;
    try {
      getSupabasePublicEnv({ ...VALID, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: secret });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(EnvValidationError);
    const error = caught as EnvValidationError;
    expect(error.variables).toEqual(["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]);
    expect(error.message).not.toContain("DO_NOT_LEAK");
    expect(error.message).toContain("RAHASIA");
  });

  it("menolak anon key lama berformat JWT", () => {
    expect(() =>
      getSupabasePublicEnv({
        ...VALID,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.c2lnbmF0dXJl",
      }),
    ).toThrow(/anon key lama/);
  });

  it("menolak URL http non-lokal, URL berpath, dan nilai kosong", () => {
    expect(() =>
      getSupabasePublicEnv({ ...VALID, NEXT_PUBLIC_SUPABASE_URL: "http://contoh.supabase.co" }),
    ).toThrow(EnvValidationError);
    expect(() =>
      getSupabasePublicEnv({
        ...VALID,
        NEXT_PUBLIC_SUPABASE_URL: `https://${FAKE_REF}.supabase.co/rest/v1`,
      }),
    ).toThrow(EnvValidationError);
    expect(() => getSupabasePublicEnv({})).toThrow(EnvValidationError);
  });

  it("mengizinkan http untuk Supabase lokal", () => {
    expect(
      getSupabasePublicEnv({ ...VALID, NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" }).url,
    ).toBe("http://127.0.0.1:54321");
  });
});

describe("getSiteUrl", () => {
  it("memakai NEXT_PUBLIC_SITE_URL bila valid", () => {
    expect(getSiteUrl(VALID)?.origin).toBe("https://contoh.vercel.app");
  });

  it("production tanpa nilai → error", () => {
    expect(() => getSiteUrl({ VERCEL_ENV: "production" })).toThrow(EnvValidationError);
  });

  it("preview tanpa nilai → jatuh ke VERCEL_URL", () => {
    expect(getSiteUrl({ VERCEL_ENV: "preview", VERCEL_URL: "contoh-git-x.vercel.app" })?.origin).toBe(
      "https://contoh-git-x.vercel.app",
    );
  });

  it("lokal tanpa nilai → null", () => {
    expect(getSiteUrl({})).toBeNull();
  });
});

describe("getWhatsAppConfig / isIndexingAllowed", () => {
  it("nomor kosong → tidak dikonfigurasi, tanpa nomor cadangan", () => {
    expect(getWhatsAppConfig({})).toEqual({ configured: false, reason: "missing" });
  });

  it("hanya 'true' yang mengizinkan indeks", () => {
    expect(isIndexingAllowed({ ALLOW_INDEXING: "true" })).toBe(true);
    expect(isIndexingAllowed({ ALLOW_INDEXING: "false" })).toBe(false);
    expect(isIndexingAllowed({ ALLOW_INDEXING: "TRUE" })).toBe(false);
    expect(isIndexingAllowed({ ALLOW_INDEXING: "1" })).toBe(false);
    expect(isIndexingAllowed({})).toBe(false);
  });
});

describe("checkEnvironment", () => {
  const FULL: EnvSource = {
    ...VALID,
    SUPABASE_PROJECT_REF: FAKE_REF,
    SUPABASE_ACCESS_TOKEN: "fake-token-value",
    SUPABASE_DB_PASSWORD: "fake-password-value",
    E2E_PARTNER_EMAIL: "mitra@example.test",
    E2E_PARTNER_PASSWORD: "fake-partner-password",
    E2E_OUTSIDER_EMAIL: "outsider@example.test",
    E2E_OUTSIDER_PASSWORD: "fake-outsider-password",
  };

  it("konfigurasi lengkap dan valid → lulus", () => {
    const rows = checkEnvironment(FULL);
    expect(isEnvCheckPassing(rows)).toBe(true);
    expect(rows.every((r) => r.status === "tersedia")).toBe(true);
  });

  it("laporan TIDAK PERNAH memuat nilai variabel", () => {
    const rows = checkEnvironment({
      ...FULL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_DO_NOT_LEAK_1",
      SUPABASE_SERVICE_ROLE_KEY: "DO_NOT_LEAK_2",
      NEXT_PUBLIC_OTHER: "sb_secret_DO_NOT_LEAK_3",
    });
    const text = JSON.stringify(rows);
    for (const value of Object.values(FULL)) {
      // "true"/"false" juga muncul sebagai literal JSON (mis. "required":false), jadi dilewati.
      if (value && value !== "true" && value !== "false") expect(text).not.toContain(value);
    }
    expect(text).not.toContain("DO_NOT_LEAK");
  });

  it("variabel wajib kosong → gagal", () => {
    const rows = checkEnvironment({});
    expect(row(rows, "NEXT_PUBLIC_SUPABASE_URL")).toMatchObject({ status: "kosong", required: true });
    expect(isEnvCheckPassing(rows)).toBe(false);
  });

  it("tooling kosong tidak menggagalkan pemeriksaan", () => {
    const rows = checkEnvironment(VALID);
    expect(row(rows, "SUPABASE_DB_PASSWORD")?.status).toBe("kosong");
    expect(isEnvCheckPassing(rows)).toBe(true);
  });

  it("secret key Supabase di lingkungan → tidak boleh ada", () => {
    const rows = checkEnvironment({ ...VALID, SUPABASE_SERVICE_ROLE_KEY: "x" });
    expect(row(rows, "SUPABASE_SERVICE_ROLE_KEY")?.status).toBe("tidak boleh ada");
    expect(isEnvCheckPassing(rows)).toBe(false);
  });

  it("variabel NEXT_PUBLIC_ lain berisi secret key → tidak boleh ada", () => {
    const rows = checkEnvironment({ ...VALID, NEXT_PUBLIC_OTHER: "sb_secret_x" });
    expect(row(rows, "NEXT_PUBLIC_OTHER")?.status).toBe("tidak boleh ada");
  });

  it("project ref tidak cocok dengan host URL → tidak valid", () => {
    const rows = checkEnvironment({ ...VALID, SUPABASE_PROJECT_REF: "projectlainyangbeda1" });
    expect(row(rows, "SUPABASE_PROJECT_REF")).toMatchObject({ status: "tidak valid" });
  });

  it("akun E2E mitra dan outsider harus berbeda", () => {
    const rows = checkEnvironment({
      ...FULL,
      E2E_OUTSIDER_EMAIL: "MITRA@example.test",
    });
    expect(row(rows, "E2E_OUTSIDER_EMAIL")).toMatchObject({ status: "tidak valid" });
  });

  it("nomor WhatsApp tidak valid dilaporkan tanpa nilainya", () => {
    const rows = checkEnvironment({ ...VALID, WHATSAPP_NUMBER: "0812abc" });
    expect(row(rows, "WHATSAPP_NUMBER")).toMatchObject({ status: "tidak valid" });
    expect(JSON.stringify(rows)).not.toContain("0812abc");
  });
});
