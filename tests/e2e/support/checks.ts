import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

/** Tag axe yang dijalankan. Tidak ada aturan yang dinonaktifkan. */
export const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

export type AxeFinding = { id: string; impact: string | null; help: string; targets: string[] };
type AxeReview = AxeFinding & { checks: { id: string; reason: string | null; related: string[] }[] };

/** Menjalankan axe pada halaman (iframe lintas domain seperti Google Maps tidak dapat dipindai isinya). */
export async function axeScan(page: Page): Promise<{ all: AxeFinding[]; blocking: AxeFinding[]; incomplete: AxeReview[] }> {
  const result = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  const all = result.violations.map((v) => ({
    id: v.id,
    impact: v.impact ?? null,
    help: v.help,
    targets: v.nodes.map((n) => n.target.join(" ")),
  }));
  return {
    all,
    blocking: all.filter((v) => v.impact === "critical" || v.impact === "serious"),
    incomplete: result.incomplete.map((r) => ({
      id: r.id,
      impact: r.impact ?? null,
      help: r.help,
      targets: r.nodes.map((n) => n.target.join(" ")),
      checks: r.nodes.flatMap((n) => [...n.any, ...n.all, ...n.none].map((c) => ({
        id: c.id,
        reason: typeof c.data?.messageKey === "string" ? c.data.messageKey : null,
        related: (c.relatedNodes ?? []).map((el) => el.target.join(" ")),
      }))),
    })),
  };
}

/** Lebar konten melebihi viewport (gulir horizontal). */
export async function horizontalOverflow(page: Page): Promise<{ scrollWidth: number; clientWidth: number; culprits: string[] }> {
  return page.evaluate(() => {
    const root = document.documentElement;
    const clientWidth = root.clientWidth;
    const culprits: string[] = [];
    if (root.scrollWidth > clientWidth + 1) {
      for (const el of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.right > clientWidth + 1 && getComputedStyle(el).position !== "fixed") {
          culprits.push(`${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}.${String(el.className).slice(0, 60)}`);
          if (culprits.length >= 5) break;
        }
      }
    }
    return { scrollWidth: root.scrollWidth, clientWidth, culprits };
  });
}

/**
 * Target sentuh yang lebih kecil dari 44×44 px (PRD NFR-02, AC-42): tombol, input, dan tautan bergaya tombol.
 * Tautan teks di dalam kalimat (mis. breadcrumb) tidak dihitung, sesuai pengecualian "inline" WCAG 2.5.8.
 */
export async function smallTargets(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const offenders: string[] = [];
    const nodes = document.querySelectorAll<HTMLElement>(
      "button, input:not([type=hidden]), select, textarea, a[class*='rounded-full'], a[class*='min-h-11']",
    );
    for (const el of Array.from(nodes)) {
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none") continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (el.closest("[hidden], dialog:not([open])")) continue;
      // Tersembunyi visual sampai difokuskan (skip link `sr-only`); ukurannya diuji saat fokus.
      if (el.matches(".sr-only") && document.activeElement !== el) continue;
      if (rect.height < 43.5 || rect.width < 43.5) {
        const label = (el.getAttribute("aria-label") || el.textContent || el.getAttribute("name") || "").trim().slice(0, 40);
        offenders.push(`${el.tagName.toLowerCase()} "${label}" ${Math.round(rect.width)}×${Math.round(rect.height)}`);
      }
    }
    return offenders;
  });
}

/** Input dengan teks < 16 px memicu zoom otomatis di HP (PRD NFR-02). */
export async function smallInputText(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>("input:not([type=hidden]), textarea, select"))
      .filter((el) => el.getBoundingClientRect().width > 0)
      .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16)
      .map((el) => `${el.getAttribute("name") ?? el.id} ${getComputedStyle(el).fontSize}`),
  );
}

export function waText(href: string | null): string {
  if (!href) return "";
  const url = new URL(href);
  return url.searchParams.get("text") ?? "";
}
