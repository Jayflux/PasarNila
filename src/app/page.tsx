/**
 * Halaman sementara selama tahap fondasi. Beranda sebenarnya (PRD §7) dibuat pada tahap halaman
 * publik. Tidak memuat klaim usaha, angka stok/harga, atau nomor apa pun.
 */
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-4 px-4 py-16">
      <h1 className="text-2xl font-semibold">Website sedang disiapkan</h1>
      <p className="text-base leading-7">
        Informasi stok dan harga ikan nila akan tersedia di halaman ini setelah tahap pengembangan
        berikutnya selesai.
      </p>
    </main>
  );
}
