"use server";

import { revalidatePath, updateTag } from "next/cache";
import type { AppSupabaseClient } from "@/lib/supabase/public-client";

import {
  recheckBusinessName,
  refreshBusinessNameCache,
  saveBusinessName,
  type BusinessNameDb,
  type BusinessNameDeps,
  type BusinessNameResult,
} from "@/lib/actions/core/site-settings";
import { supabaseGate, verifyReadSignal, wait, writeSignal } from "@/lib/actions/core/supabase-gate";
import { SITE_SETTINGS_TAG } from "@/lib/data/site-settings";
import type { ActionResult } from "@/lib/write/action-result";
import { settle } from "@/lib/write/outcome";

/** Server Action nama usaha (PRD BR-P3, AC-45–AC-50, AC-52; ARCHITECTURE.md §5.6, §12.5). */

const COLUMNS = "business_name, updated_at";

function businessNameDb(supabase: AppSupabaseClient): BusinessNameDb {
  return {
    update: (name) =>
      settle(() =>
        supabase
          .from("site_settings")
          .update({ business_name: name })
          .eq("id", true)
          .select(COLUMNS)
          .abortSignal(writeSignal()),
      ),
    read: () =>
      settle(() =>
        supabase.from("site_settings").select(COLUMNS).eq("id", true).abortSignal(verifyReadSignal()).maybeSingle(),
      ),
  };
}

function deps(): BusinessNameDeps {
  return {
    gate: supabaseGate(businessNameDb),
    wait,
    invalidate: () => {
      // `updateTag` hanya dapat dipanggil di Server Action: langsung meng-expire tag (§12.0).
      updateTag(SITE_SETTINGS_TAG);
      revalidatePath("/", "layout");
    },
  };
}

export async function updateBusinessNameAction(formData: FormData): Promise<BusinessNameResult> {
  return saveBusinessName(formData, deps());
}

export async function recheckBusinessNameAction(formData: FormData): Promise<BusinessNameResult> {
  return recheckBusinessName(formData, deps());
}

export async function refreshBusinessNameCacheAction(): Promise<ActionResult> {
  return refreshBusinessNameCache(deps());
}
