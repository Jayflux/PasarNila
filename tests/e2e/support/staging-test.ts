import { randomUUID } from "node:crypto";
import { appendFileSync } from "node:fs";

import { test as base } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  BUSINESS_LEDGER, deleteFixturePackages, FIXTURE_PREFIX, originalValues, partnerClient, readOriginals,
  registerPackage, restoreBusiness, type BusinessField,
} from "./cloud";

type Staging = {
  packageName: (suffix: string) => string;
  seedPackage: (name: string, weight: string, price: number) => Promise<void>;
  trackBusiness: (field: BusinessField) => void;
  readBusiness: () => ReturnType<typeof readOriginals>;
};

export const test = base.extend<{ staging: Staging }, { stagingClient: SupabaseClient }>({
  stagingClient: [async ({}, runTest) => {
    const client = await partnerClient();
    try {
      await runTest(client);
    } finally {
      await client.auth.signOut({ scope: "local" });
    }
  }, { scope: "worker" }],
  staging: async ({ stagingClient: client }, runTest) => {
    const before = originalValues();
    const id = randomUUID();
    const names: string[] = [];
    const fields = new Set<BusinessField>();
    try {
      await runTest({
        packageName(suffix) {
          const name = `${FIXTURE_PREFIX} ${id} ${suffix}`;
          if (name.length > 60) throw new Error("Nama paket fixture melebihi batas");
          registerPackage(name);
          names.push(name);
          return name;
        },
        async seedPackage(name, weight, price) {
          if (!names.includes(name)) throw new Error("Nama paket belum didaftarkan");
          const { error } = await client.rpc("create_product_package", {
            p_id: randomUUID(), p_product_id: before.productId, p_name: name, p_weight_kg: weight, p_price_total_idr: price,
          });
          if (error) throw new Error(`Fixture paket gagal: ${error.code}`);
        },
        trackBusiness(field) {
          appendFileSync(BUSINESS_LEDGER, `${JSON.stringify(field)}\n`);
          fields.add(field);
        },
        readBusiness: () => readOriginals(client),
      });
    } finally {
      try {
        await deleteFixturePackages(client, before.productId, names);
      } finally {
        if (fields.size) await restoreBusiness(client, before, [...fields]);
      }
    }
  },
});
