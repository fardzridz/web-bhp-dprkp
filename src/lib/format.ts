/**
 * Satu tempat untuk urusan angka gaya Indonesia.
 *
 * Dipakai bersama oleh halaman maupun komponen input supaya tidak ada dua
 * aturan berbeda: "27.750" = dua puluh tujuh ribu tujuh ratus lima puluh,
 * "27,5" = dua puluh tujuh koma lima, "27,750.00" = 27750.
 */

/**
 * Membaca angka dari teks/tempelen Excel gaya Indonesia.
 * Mengembalikan null bila tidak ada angka yang bisa dibaca.
 */
export function parseAngkaID(nilai: unknown): number | null {
  if (nilai === null || nilai === undefined) return null;
  if (typeof nilai === "number") return Number.isFinite(nilai) ? nilai : null;

  let teks = String(nilai).trim();
  if (!teks) return null;

  // Buang mata uang, spasi, dan huruf. Sisakan angka, pemisah, tanda minus.
  teks = teks.replace(/[^0-9.,-]/g, "");
  if (!teks) return null;

  const negatif = teks.trim().startsWith("-");
  teks = teks.replace(/-/g, "");
  if (!teks) return null;

  const titik = teks.lastIndexOf(".");
  const koma = teks.lastIndexOf(",");
  let posisiDesimal = -1;

  if (titik >= 0 && koma >= 0) {
    // Dua jenis pemisah: yang paling belakang adalah pemisah desimal.
    posisiDesimal = Math.max(titik, koma);
  } else if (koma >= 0) {
    const diBelakang = teks.length - koma - 1;
    // "27,5" desimal; "27,750" ribuan.
    posisiDesimal = koma > 0 && diBelakang === 3 ? -1 : koma;
  } else if (titik >= 0) {
    const diBelakang = teks.length - titik - 1;
    // "27.750" ribuan; "27750.5" desimal.
    posisiDesimal = titik > 0 && diBelakang === 3 ? -1 : titik;
  }

  let bersih: string;
  if (posisiDesimal >= 0) {
    const bulat = teks.slice(0, posisiDesimal).replace(/[.,]/g, "");
    const pecahan = teks.slice(posisiDesimal + 1).replace(/[.,]/g, "");
    bersih = pecahan ? `${bulat}.${pecahan}` : bulat;
  } else {
    bersih = teks.replace(/[.,]/g, "");
  }

  if (!bersih) return null;
  const angka = Number(bersih);
  if (!Number.isFinite(angka)) return null;
  return negatif ? -angka : angka;
}

/**
 * Isi kolom teks saat mengetik angka: ribuan dipisah titik, desimal pakai koma.
 * Ketikan yang belum selesai tetap dipertahankan ("27," tetap "27,"),
 * nol di depan dibuang supaya tidak jadi "010000", dan tanda titik yang
 * diketik dianggap pemisah ribuan (kebiasaan Indonesia).
 */
export function rapikanTeksAngka(teks: string, maxDesimal = 2): string {
  const bersih = teks.replace(/[^0-9,]/g, "");
  const posisiKoma = bersih.indexOf(",");

  let bulat = (posisiKoma === -1 ? bersih : bersih.slice(0, posisiKoma)).replace(/^0+(?=\d)/, "");
  let pecahan: string | null = null;

  if (posisiKoma !== -1) {
    pecahan = bersih
      .slice(posisiKoma + 1)
      .replace(/,/g, "")
      .slice(0, Math.max(0, maxDesimal));
  }

  if (bulat === "" && pecahan === null) return "";
  const grup = bulat.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  if (pecahan === null) return grup;
  return `${grup || "0"},${pecahan}`;
}

/** Angka menjadi teks isian kolom (tanpa "Rp"), mis. 27750.5 -> "27.750,5". */
export function angkaKeTeks(nilai: number | null | undefined, maxDesimal = 2): string {
  if (nilai === null || nilai === undefined || !Number.isFinite(nilai)) return "";
  const teks = new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: maxDesimal,
  }).format(Math.abs(nilai));
  return nilai < 0 ? `-${teks}` : teks;
}

/** Angka rapi untuk dibaca, mis. 1234567.5 -> "1.234.567,5". */
export function formatAngka(nilai: number | null | undefined, maxDesimal = 2): string {
  if (nilai === null || nilai === undefined || !Number.isFinite(nilai)) return "-";
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: maxDesimal }).format(nilai);
}

/**
 * Angka untuk lembar cetak resmi: SELALU 2 angka desimal, tanpa "Rp".
 * Contoh: 5640000 -> "5.640.000,00", 47 -> "47,00", 544520879.13 -> "544.520.879,13".
 * Dipakai di Laporan Mutasi, Berita Acara, dan Lampiran resmi.
 */
export function formatResmi(nilai: number | null | undefined, desimal = 2): string {
  const angka = nilai === null || nilai === undefined || !Number.isFinite(nilai) ? 0 : nilai;
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: desimal,
    maximumFractionDigits: desimal,
  }).format(angka);
}

/**
 * Rupiah siap baca, mis. 27750 -> "Rp 27.750", 544520879.13 -> "Rp 544.520.879,13".
 * Angka bulat tidak diberi ",00" supaya daftar tetap ringkas.
 */
export function formatRupiah(nilai: number | null | undefined, maxDesimal = 2): string {
  const angka = nilai === null || nilai === undefined || !Number.isFinite(nilai) ? 0 : nilai;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDesimal,
  }).format(angka);
}
