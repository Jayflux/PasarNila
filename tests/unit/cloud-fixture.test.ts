/** Pengaman parameter fixture Management API (tests/support/cloud-fixture.ts). Tanpa jaringan. */
import { describe, expect, it } from "vitest";

import { bindParams } from "../support/cloud-fixture";

describe("bindParams", () => {
  it("mengisi $n dengan literal yang divalidasi", () => {
    expect(bindParams("insert into t (a, b, c) values ($1, $2, $3)", ["uji-paket-ab12cd34", 5, true])).toBe(
      "insert into t (a, b, c) values ('uji-paket-ab12cd34', 5, true)",
    );
  });

  it("memakai nilai yang sama bila $n muncul dua kali", () => {
    expect(bindParams("select $1, $1", ["a-b"])).toBe("select 'a-b', 'a-b'");
  });

  it.each([["x'; drop table products; --"], ["a\"b"], ["a;b"], ["a\nb"], ["x".repeat(121)]])(
    "menolak string tidak aman %j",
    (value) => {
      expect(() => bindParams("select $1", [value])).toThrow(/tidak aman/);
    },
  );

  it("menolak tipe yang tidak didukung dan angka tidak terhingga", () => {
    expect(() => bindParams("select $1", [null])).toThrow();
    expect(() => bindParams("select $1", [{}])).toThrow();
    expect(() => bindParams("select $1", [Number.NaN])).toThrow();
    expect(() => bindParams("select $1", [])).toThrow();
  });
});
