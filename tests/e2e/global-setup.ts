import { mkdirSync, rmSync, writeFileSync } from "node:fs";

import { anonClient, BUSINESS_LEDGER, cloudTarget, ORIGINALS, PACKAGE_LEDGER, readOriginals, RUN_LOCK, STATE_DIR } from "./support/cloud";
import globalTeardown from "./global-teardown";

/** Ambil baseline sebelum penulisan. Lock tersisa setelah kegagalan cleanup agar baseline tidak tertimpa. */
export default async function globalSetup() {
  const target = cloudTarget();
  if (target.targetEnv !== "staging" && target.targetEnv !== "development") throw new Error("Bukan dev/staging");
  mkdirSync(STATE_DIR, { recursive: true });
  mkdirSync(".playwright/state", { recursive: true });
  writeFileSync(RUN_LOCK, `${process.pid}\n`, { flag: "wx" });
  try {
    const originals = await readOriginals(anonClient(target));
    if (originals.stockKg === null || originals.pricePerKgIdr === null) {
      throw new Error("Baseline stok/harga tidak bisa dipulihkan lewat RPC; suite tulis dibatalkan");
    }
    for (const file of ["axe.jsonl", "responsive.jsonl", "teardown.json"]) rmSync(`${STATE_DIR}/${file}`, { force: true });
    writeFileSync(ORIGINALS, JSON.stringify(originals));
    writeFileSync(PACKAGE_LEDGER, "");
    writeFileSync(BUSINESS_LEDGER, "");
  } catch (error) {
    rmSync(RUN_LOCK);
    throw error;
  }
  return globalTeardown;
}
