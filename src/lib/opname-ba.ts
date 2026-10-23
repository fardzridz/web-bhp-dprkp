/**
 * Penyusunan blok Berita Acara Stok Opname: hasil opname dikelompokkan per
 * kategori barang, lalu setiap kategori ditampilkan untuk SELURUH unit kerja
 * resmi (unit yang tidak ikut diopname bernilai null sehingga dicetak "-"),
 * persis seperti lembar resmi mitra.
 *
 * Dipakai bersama oleh halaman Stock Opname dan paket cetak di halaman Laporan.
 */

import { unitCocok } from "./unit";

export interface UnitNilaiBA {
  unit: string;
  /** Nilai hasil opname unit ini; null berarti unit itu tidak ada datanya ("-"). */
  nilai: number | null;
}

export interface BlokKategoriBA {
  kategori: string;
  perUnit: UnitNilaiBA[];
  jumlah: number;
}

export interface BarisOpnameBA {
  kategori: string;
  nilaiFisik: number;
}

/**
 * @param items baris hasil opname dokumen ini
 * @param unitKerja daftar unit resmi dari Pengaturan
 * @param namaBidang nama bidang pemilik dokumen (untuk mencocokkan baris unit)
 */
export function susunBlokBA(
  items: BarisOpnameBA[],
  unitKerja: string[],
  namaBidang: string
): BlokKategoriBA[] {
  const perKategori = new Map<string, number>();
  for (const item of items) {
    perKategori.set(item.kategori, (perKategori.get(item.kategori) || 0) + item.nilaiFisik);
  }

  const adaCocok = unitKerja.some((u) => unitCocok(u, namaBidang));
  const daftarUnit = adaCocok || !namaBidang ? unitKerja : [...unitKerja, `${namaBidang} (di luar daftar unit)`];

  return [...perKategori.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([kategori, nilai]) => ({
      kategori,
      perUnit: daftarUnit.map((unit) => ({ unit, nilai: unitCocok(unit, namaBidang) ? nilai : null })),
      jumlah: nilai,
    }));
}
