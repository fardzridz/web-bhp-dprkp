/**
 * Pencocokan nama unit kerja untuk lembar Berita Acara.
 *
 * Daftar unit resmi di Pengaturan (mis. "Bidang Permukiman") tidak selalu
 * sama tulisannya dengan nama bidang di aplikasi (mis. "Bidang Kawasan
 * Permukiman"), jadi dicocokkan longgar: kata "bidang/upt/dinas" dibuang,
 * lalu dibandingkan saling mengandung.
 */

const KATA_UMUM = /\b(bidang|uptd?|dinas|seksi|sub)\b/g;

function normalkan(nama: string): string {
  return (nama || "")
    .toLowerCase()
    .replace(KATA_UMUM, " ")
    .replace(/[^a-z0-9]+/g, "");
}

/** true bila nama unit resmi dan nama bidang di aplikasi dianggap unit yang sama. */
export function unitCocok(namaUnit: string, namaBidang: string): boolean {
  const a = normalkan(namaUnit);
  const b = normalkan(namaBidang);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

/** Membaca daftar unit dari pengaturan, mis. "Sekretariat|Bidang Permukiman". */
export function parseUnitKerja(teks: string | undefined | null): string[] {
  return (teks || "")
    .split("|")
    .map((u) => u.trim())
    .filter(Boolean);
}

/** Daftar unit bawaan bila Pengaturan belum diisi (sesuai dokumen resmi mitra). */
export const UNIT_KERJA_BAWAAN = [
  "Sekretariat",
  "Bidang Permukiman",
  "Bidang Perumahan",
  "UPT Pemakaman",
  "UPT Rusunawa",
];

/** Daftar unit yang dipakai: dari Pengaturan bila ada, kalau tidak pakai bawaan. */
export function daftarUnitKerja(dariPengaturan?: string | null): string[] {
  const hasil = parseUnitKerja(dariPengaturan);
  return hasil.length > 0 ? hasil : UNIT_KERJA_BAWAAN;
}
