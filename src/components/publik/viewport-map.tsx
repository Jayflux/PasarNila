"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Jarak native lazy loading Chromium masih memuat Maps beranda jauh sebelum kartu terlihat. */
export function ViewportMap({ children, className }: { children: ReactNode; className: string }) {
  const frame = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return <div ref={frame} className={className}>{visible ? children : <noscript>{children}</noscript>}</div>;
}
