/**
 * PLACEHOLDER VISUAL — BUKAN FOTO USAHA.
 *
 * Bidang ilustrasi abstrak bertema air, dipakai sampai klien mengirim foto usaha/produk beserta
 * pernyataan hak pakai (PRD K3, K4, K12; ARCHITECTURE.md §14). Sengaja berupa bentuk gelombang datar
 * agar tidak terlihat seperti foto asli. Tidak ada gambar yang diambil dari situs referensi.
 *
 * Penggantian: ganti isi komponen ini dengan `next/image` dari `public/images/...` (dengan `priority`
 * dan teks alternatif deskriptif) setelah foto disetujui.
 */
export function HeroVisual() {
  return (
    <figure className="relative mx-auto w-full max-w-md md:max-w-none">
      <div className="overflow-hidden rounded-[2rem] shadow-xl ring-1 shadow-deep/15 ring-deep/10">
        <svg
          viewBox="0 0 480 360"
          aria-hidden="true"
          focusable="false"
          className="block h-auto w-full"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <linearGradient id="hero-water-sky" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#0b4446" />
              <stop offset="1" stopColor="#0f766e" />
            </linearGradient>
            <linearGradient id="hero-water-wave" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#5fd4c8" stopOpacity="0.55" />
              <stop offset="1" stopColor="#5fd4c8" stopOpacity="0.15" />
            </linearGradient>
            <radialGradient id="hero-water-glow" cx="0.78" cy="0.22" r="0.45">
              <stop offset="0" stopColor="#dcf3ef" stopOpacity="0.55" />
              <stop offset="1" stopColor="#dcf3ef" stopOpacity="0" />
            </radialGradient>
          </defs>

          <rect width="480" height="360" fill="url(#hero-water-sky)" />
          <rect width="480" height="360" fill="url(#hero-water-glow)" />

          <path
            d="M0 196 C 80 168, 160 226, 240 198 S 400 168, 480 196 V360 H0 Z"
            fill="url(#hero-water-wave)"
          />
          <path
            d="M0 246 C 90 222, 170 276, 260 250 S 410 224, 480 250 V360 H0 Z"
            fill="#5fd4c8"
            fillOpacity="0.28"
          />
          <path
            d="M0 294 C 100 276, 180 318, 280 298 S 420 280, 480 300 V360 H0 Z"
            fill="#eef7f5"
            fillOpacity="0.22"
          />

          <g fill="none" stroke="#dcf3ef" strokeOpacity="0.45" strokeWidth="2">
            <circle cx="96" cy="120" r="9" />
            <circle cx="122" cy="92" r="5" />
            <circle cx="372" cy="150" r="7" />
            <circle cx="350" cy="122" r="4" />
          </g>
          <path
            d="M40 160 C 70 150, 100 170, 130 160"
            stroke="#dcf3ef"
            strokeOpacity="0.4"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M320 92 C 350 82, 380 102, 410 92"
            stroke="#dcf3ef"
            strokeOpacity="0.35"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      </div>
      <figcaption className="absolute bottom-4 left-4 rounded-full bg-deep-strong/80 px-3 py-1 text-xs font-medium text-on-deep backdrop-blur-sm">
        Ilustrasi · foto usaha menyusul
      </figcaption>
    </figure>
  );
}
