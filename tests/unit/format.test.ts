import { afterEach, describe, expect, it } from "vitest";

import { formatWib } from "@/lib/format/datetime";
import { formatKg, formatPricePerKg, formatRupiah } from "@/lib/format/number";

describe("formatKg (AC-03)", () => {
  it.each([
    [12.5, "12,5 kg"],
    [12.25, "12,25 kg"],
    [10, "10 kg"],
    [0.01, "0,01 kg"],
    [1250, "1.250 kg"],
    [100000, "100.000 kg"],
  ])("%d → %j", (kg, expected) => {
    expect(formatKg(kg)).toBe(expected);
  });

  it("menolak nilai negatif atau tidak terhingga", () => {
    expect(() => formatKg(-1)).toThrow(RangeError);
    expect(() => formatKg(Number.NaN)).toThrow(RangeError);
    expect(() => formatKg(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe("formatRupiah / formatPricePerKg (AC-05, AC-06)", () => {
  it.each([
    [35000, "Rp35.000"],
    [32000, "Rp32.000"],
    [0, "Rp0"],
    [1250000, "Rp1.250.000"],
    [10000000, "Rp10.000.000"],
  ])("%d → %j", (idr, expected) => {
    expect(formatRupiah(idr)).toBe(expected);
  });

  it("harga per kg memakai pemisah ' / kg'", () => {
    expect(formatPricePerKg(35000)).toBe("Rp35.000 / kg");
    expect(formatPricePerKg(0)).toBe("Rp0 / kg");
  });

  it("menolak pecahan dan nilai negatif", () => {
    expect(() => formatRupiah(35000.5)).toThrow(RangeError);
    expect(() => formatRupiah(-1)).toThrow(RangeError);
  });
});

describe("formatWib (AC-07, T-04)", () => {
  const originalTz = process.env.TZ;
  afterEach(() => {
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
  });

  it("07:05 UTC → 14.05 WIB pada tanggal yang sama", () => {
    expect(formatWib("2026-11-17T07:05:00Z")).toBe("17 November 2026 pukul 14.05 WIB");
  });

  it("18:30 UTC → tanggal berikutnya 01.30 WIB", () => {
    expect(formatWib("2026-11-17T18:30:00Z")).toBe("18 November 2026 pukul 01.30 WIB");
  });

  it("tengah malam WIB tampil 00.xx, bukan 24.xx", () => {
    expect(formatWib("2026-11-17T17:00:00Z")).toBe("18 November 2026 pukul 00.00 WIB");
  });

  it("pergantian tahun", () => {
    expect(formatWib("2026-12-31T17:30:00Z")).toBe("1 Januari 2027 pukul 00.30 WIB");
  });

  it("menerima format timestamptz PostgREST (offset + mikrodetik)", () => {
    expect(formatWib("2026-11-17T07:05:00.123456+00:00")).toBe(
      "17 November 2026 pukul 14.05 WIB",
    );
  });

  it("menerima objek Date", () => {
    expect(formatWib(new Date(Date.UTC(2026, 0, 5, 1, 2)))).toBe(
      "5 Januari 2026 pukul 08.02 WIB",
    );
  });

  it("tidak bergantung pada zona waktu proses", () => {
    process.env.TZ = "America/New_York";
    expect(formatWib("2026-11-17T07:05:00Z")).toBe("17 November 2026 pukul 14.05 WIB");
    process.env.TZ = "UTC";
    expect(formatWib("2026-11-17T07:05:00Z")).toBe("17 November 2026 pukul 14.05 WIB");
  });

  it("menolak waktu tidak valid", () => {
    expect(() => formatWib("bukan-tanggal")).toThrow(RangeError);
  });
});
