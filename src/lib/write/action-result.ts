/**
 * Bentuk hasil Server Action panel yang dipakai bersama server dan browser (ARCHITECTURE.md §10.3–§10.4).
 *
 * File ini tidak memuat kode server, sehingga aman diimpor komponen klien.
 */

export type SaveState =
  /** Jawaban sukses berisi baris tersimpan. */
  | "saved"
  /** Hasil awal belum pasti; pembacaan ulang menunjukkan data tersimpan sesuai isian. */
  | "verified"
  /** Hasil awal belum pasti; data tersimpan berbeda dari isian (diubah dari tempat lain). */
  | "changed_elsewhere"
  /** Belum dapat dipastikan. Data mungkin tersimpan, mungkin belum. */
  | "uncertain"
  /** Isian tidak valid. Tidak ada permintaan tulis yang dikirim atau database menolaknya. */
  | "invalid"
  /** Database/PostgREST menolak dengan jaminan pembatalan. */
  | "rejected"
  /** Data yang dituju tidak ada (atau tidak terlihat oleh akun ini). */
  | "not_found"
  /** Sesi login tidak ada/kedaluwarsa. */
  | "session_expired"
  /** Akun login bukan mitra di allowlist. */
  | "forbidden"
  /** Pemeriksaan hak akses gagal sementara; operasi tidak dijalankan. */
  | "access_check_failed";

export type ActionResult<TSaved = undefined, TField extends string = string> = {
  state: SaveState;
  message: string;
  /** Penjelasan tambahan, mis. hasil pembacaan ulang. */
  detail?: string;
  fieldErrors?: Partial<Record<TField, string>>;
  /** Nilai yang terbaca dari database (bukan dari isian). */
  saved?: TSaved;
  /** Tampilkan tombol "Periksa ulang". */
  canRecheck?: boolean;
  /** Peringatan yang tidak mengubah status simpan (mis. penyegaran tampilan publik gagal). */
  warning?: string;
};

/** Status yang menjamin data di database TIDAK berubah oleh permintaan ini. */
export function isCertainlyUnchanged(state: SaveState): boolean {
  return (
    state === "invalid" ||
    state === "rejected" ||
    state === "not_found" ||
    state === "session_expired" ||
    state === "forbidden" ||
    state === "access_check_failed"
  );
}

export function isSuccessState(state: SaveState): boolean {
  return state === "saved" || state === "verified";
}

// ---------------------------------------------------------------------------------------------
// Pesan bersama (Bahasa Indonesia, PRD AC-24, AC-29, AC-51, AC-52; ARCHITECTURE §10.3)
// ---------------------------------------------------------------------------------------------

export const MESSAGES = {
  sessionExpired:
    "Sesi Anda telah berakhir. Silakan login kembali. Isian Anda masih ada di formulir ini, dan data di database tidak berubah.",
  forbidden: "Akun ini tidak memiliki akses untuk menyimpan data. Data tidak berubah.",
  accessCheckFailed:
    "Pemeriksaan hak akses sedang terganggu, jadi permintaan belum dijalankan dan data tidak berubah. Silakan coba lagi beberapa saat lagi.",
  rejected: "Gagal menyimpan. Data sebelumnya tidak berubah. Silakan coba lagi.",
  notFound: "Data tidak ditemukan atau Anda tidak memiliki akses. Data tidak berubah.",
  invalid: "Periksa kembali isian yang ditandai. Data tidak berubah.",
  beforeSend: "Terjadi kesalahan sebelum data dikirim. Data tidak berubah. Silakan coba lagi.",
  uncertain: "Status penyimpanan belum dapat dipastikan.",
  uncertainNotYetVisible:
    "Saat diperiksa, data tersimpan belum berubah. Permintaan Anda mungkin masih diproses atau tidak sampai ke server, jadi hasilnya belum pasti. Tekan “Periksa ulang” beberapa saat lagi. Bila tetap belum berubah, Anda boleh menyimpan lagi.",
  uncertainReadFailed:
    "Pemeriksaan ulang juga gagal. Periksa koneksi, lalu tekan “Periksa ulang” atau muat ulang halaman untuk melihat data tersimpan sebelum mencoba lagi.",
  networkFromBrowser:
    "Koneksi ke server terputus saat mengirim. Data mungkin sudah tersimpan, mungkin belum. Tekan “Periksa ulang” untuk melihat data tersimpan.",
  changedElsewhere:
    "Data tersimpan berbeda dari isian Anda. Kemungkinan data diubah dari tempat lain. Nilai tersimpan ditampilkan di bawah; isian Anda tetap di formulir.",
} as const;
