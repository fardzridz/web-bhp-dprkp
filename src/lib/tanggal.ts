/**
 * Tanggal & angka dalam kata untuk kalimat resmi (Berita Acara).
 *
 * Contoh keluaran:
 *   tanggalKeKata("2026-01-02")
 *   -> "Kamis tanggal Dua Januari Tahun Dua Ribu Dua Puluh Enam"
 */

const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

const BULAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const SATUAN = [
  "",
  "Satu",
  "Dua",
  "Tiga",
  "Empat",
  "Lima",
  "Enam",
  "Tujuh",
  "Delapan",
  "Sembilan",
  "Sepuluh",
  "Sebelas",
];

/** Bilangan bulat 0..999999 menjadi kata, mis. 2026 -> "Dua Ribu Dua Puluh Enam". */
export function angkaKeKata(nilai: number): string {
  const n = Math.floor(Math.abs(nilai));
  if (n === 0) return "Nol";
  if (n < 12) return SATUAN[n];
  if (n < 20) return `${angkaKeKata(n - 10)} Belas`;
  if (n < 100) {
    const sisa = n % 10;
    return `${SATUAN[Math.floor(n / 10)]} Puluh${sisa ? ` ${angkaKeKata(sisa)}` : ""}`;
  }
  if (n < 200) return `Seratus${n > 100 ? ` ${angkaKeKata(n - 100)}` : ""}`;
  if (n < 1000) {
    const sisa = n % 100;
    return `${angkaKeKata(Math.floor(n / 100))} Ratus${sisa ? ` ${angkaKeKata(sisa)}` : ""}`;
  }
  if (n < 2000) return `Seribu${n > 1000 ? ` ${angkaKeKata(n - 1000)}` : ""}`;
  if (n < 1000000) {
    const sisa = n % 1000;
    return `${angkaKeKata(Math.floor(n / 1000))} Ribu${sisa ? ` ${angkaKeKata(sisa)}` : ""}`;
  }
  return String(n);
}

function potongTanggal(tanggal: string): { tahun: number; bulan: number; hari: number; hariPekan: number } | null {
  const cocok = /^(\d{4})-(\d{2})-(\d{2})/.exec((tanggal || "").trim());
  if (!cocok) return null;
  const tahun = Number(cocok[1]);
  const bulan = Number(cocok[2]);
  const hari = Number(cocok[3]);
  if (bulan < 1 || bulan > 12 || hari < 1 || hari > 31) return null;
  const tanggalObj = new Date(Date.UTC(tahun, bulan - 1, hari));
  return { tahun, bulan, hari, hariPekan: tanggalObj.getUTCDay() };
}

/** "Kamis tanggal Dua Januari Tahun Dua Ribu Dua Puluh Enam" (untuk pembuka BA). */
export function tanggalKeKata(tanggal: string): string {
  const bagian = potongTanggal(tanggal);
  if (!bagian) return "-";
  return (
    `${HARI[bagian.hariPekan]} tanggal ${angkaKeKata(bagian.hari)} ${BULAN[bagian.bulan - 1]}` +
    ` Tahun ${angkaKeKata(bagian.tahun)}`
  );
}

/** "31 Desember 2025" (untuk kalimat "pada tanggal ..."). */
export function tanggalKeTeks(tanggal: string): string {
  const bagian = potongTanggal(tanggal);
  if (!bagian) return "-";
  return `${bagian.hari} ${BULAN[bagian.bulan - 1]} ${bagian.tahun}`;
}

/** Nama hari saja, mis. "Kamis". */
export function namaHari(tanggal: string): string {
  const bagian = potongTanggal(tanggal);
  return bagian ? HARI[bagian.hariPekan] : "-";
}
