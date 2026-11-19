// Preload KHUSUS server uji gangguan (port 3201, lihat playwright.config.ts). Semua `fetch` ke
// `*.supabase.co` gagal seperti jaringan terputus, sehingga keadaan gangguan dapat diuji tanpa menyentuh
// cloud. Tidak pernah dimuat oleh aplikasi biasa.
const original = globalThis.fetch;
globalThis.fetch = function failSupabaseFetch(input, init) {
  const url = typeof input === "string" ? input : (input && (input.url ?? String(input))) || "";
  if (/\.supabase\.co/.test(url)) return Promise.reject(new TypeError("fetch failed (simulasi gangguan uji)"));
  return original.call(this, input, init);
};
