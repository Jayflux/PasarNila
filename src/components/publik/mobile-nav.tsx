"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { CloseIcon, MenuIcon } from "@/components/ui/icons";
import type { NavItem } from "@/config/navigation";

/**
 * Menu navigasi HP (satu-satunya Client Component di header).
 *
 * Pola disclosure: tombol dengan `aria-expanded` + `aria-controls`, panel `hidden` saat tertutup.
 * Escape menutup menu dan mengembalikan fokus ke tombol; memilih tautan atau mengetuk di luar menu
 * juga menutupnya. Di layar ≥ md komponen ini disembunyikan dan menu desktop yang dipakai.
 */
type Props = {
  items: readonly NavItem[];
  /** Tombol WhatsApp yang dirender di server (berisi tautan dari konfigurasi atau keadaan nonaktif). */
  whatsappSlot: React.ReactNode;
};

export function MobileNav({ items, whatsappSlot }: Props) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    function onPointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="md:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex size-11 items-center justify-center rounded-full border border-deep/20 bg-surface text-deep transition hover:bg-accent-soft"
      >
        {open ? <CloseIcon className="size-6" /> : <MenuIcon className="size-6" />}
        <span className="sr-only">Menu navigasi</span>
      </button>

      <div
        id={panelId}
        hidden={!open}
        className="absolute inset-x-0 top-full border-b border-line bg-cream shadow-lg"
      >
        <nav aria-label="Menu utama" className="mx-auto max-w-6xl px-4 py-3">
          <ul className="flex flex-col">
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex min-h-12 items-center rounded-lg px-3 text-base font-medium text-ink transition hover:bg-accent-soft"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-3 border-t border-line pt-4 pb-2 [&>*]:w-full">{whatsappSlot}</div>
        </nav>
      </div>
    </div>
  );
}
