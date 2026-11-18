// Pengganti modul `server-only` untuk Vitest. Next.js menyediakan modul ini secara internal saat build
// (impor dari komponen klien menjadi error build); di lingkungan uji Node, impor cukup tidak melakukan apa-apa.
export {};
