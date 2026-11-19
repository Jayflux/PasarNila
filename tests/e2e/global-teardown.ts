import { readFileSync, rmSync, writeFileSync } from "node:fs";

import {
  BUSINESS_FIELDS, BUSINESS_LEDGER, deleteFixturePackages, originalValues, PACKAGE_LEDGER, partnerClient,
  restoreBusiness, RUN_LOCK, STATE_DIR,
} from "./support/cloud";

function registered(file: string): string[] {
  return [...new Set(readFileSync(file, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line) as string))];
}

/** Pengaman tambahan untuk teardown per test; hanya memulihkan bidang dan paket yang didaftarkan run. */
export default async function globalTeardown(): Promise<void> {
  const before = originalValues();
  const names = registered(PACKAGE_LEDGER);
  const fields = registered(BUSINESS_LEDGER);
  const client = await partnerClient();
  try {
    // Upayakan kedua cleanup meskipun salah satunya gagal.
    const [packages, business] = await Promise.allSettled([
      deleteFixturePackages(client, before.productId, names),
      restoreBusiness(client, before, BUSINESS_FIELDS.filter((field) => fields.includes(field))),
    ]);
    if (packages.status === "rejected") throw packages.reason;
    if (business.status === "rejected") throw business.reason;
    const { final, restored } = business.value;
    const timestamps = ["confirmedAt", "productUpdatedAt", "settingsUpdatedAt", "articleUpdatedAt"] as const;
    const identicalToStart = (["productId", "businessName", "stockKg", "pricePerKgIdr", "articleTitle", "articleBody"] as const)
      .every((field) => final[field] === before[field]);
    writeFileSync(`${STATE_DIR}/teardown.json`, JSON.stringify({
      registeredPackages: names.length,
      packagesRemovedByGlobalTeardown: packages.value,
      fixturePackagesLeft: 0,
      restoredByGlobalTeardown: restored,
      identicalToStart,
      timestampsChanged: timestamps.filter((field) => final[field] !== before[field]),
    }, null, 2));
    if (!identicalToStart) throw new Error("Nilai bisnis berubah di luar bidang yang didaftarkan");
    rmSync(RUN_LOCK);
  } finally {
    await client.auth.signOut({ scope: "local" });
  }
}
