/**
 * Pengelompokan baris Laporan Mutasi per kategori, meniru lembar resmi mitra
 * yang memakai satu tabel per kategori dan menutupnya dengan baris
 * "Jumlah <Nama Kategori>".
 */

export interface BarisMutasi {
  id: string;
  kode?: string;
  nama?: string;
  satuan?: string;
  kategori?: string;
  bidangId?: string;
  bidangNama?: string;
  bidangKode?: string;
  openingQty: number;
  openingValue: number;
  incomingQty: number;
  incomingValue: number;
  outgoingQty: number;
  outgoingValue: number;
  closingQty: number;
  closingValue: number;
  opnameQty?: number | null;
  opnameValue?: number | null;
  selisihQty?: number | null;
  selisihValue?: number | null;
  /** true bila saldo akhir negatif — tanda data stok tidak konsisten. */
  negative?: boolean;
  /** Kondisi hasil opname barang ini; "Beragam" bila unit berbeda pendapat. */
  opnameKondisi?: string | null;
  /** Tanggal opname terakhir yang berlaku untuk baris ini. */
  opnameTanggal?: string | null;
}

export interface SubtotalKategori {
  openingQty: number;
  openingValue: number;
  incomingQty: number;
  incomingValue: number;
  outgoingQty: number;
  outgoingValue: number;
  closingQty: number;
  closingValue: number;
  opnameQty: number;
  opnameValue: number;
  selisihQty: number;
  selisihValue: number;
}

export interface KelompokMutasi<T extends BarisMutasi> {
  kategori: string;
  baris: Array<T & { nomor: number }>;
  /** Banyaknya barang yang sudah punya hasil opname — ditulis di kolom Kondisi. */
  jumlahOpname: number;
  subtotal: SubtotalKategori;
}

/**
 * Baris tanpa hasil opname tidak ikut dijumlahkan, tetapi tetap dihitung pada
 * kolom lain. Nomor baris (`nomor`) menerus dari kategori sebelumnya supaya
 * penomoran tabel tetap seperti lembar resmi.
 */
export function kelompokkanMutasi<T extends BarisMutasi>(rows: T[]): Array<KelompokMutasi<T>> {
  const peta = new Map<string, KelompokMutasi<T>>();
  let nomor = 0;

  for (const baris of rows) {
    nomor += 1;
    const kunci = baris.kategori || "Tanpa Kategori";

    if (!peta.has(kunci)) {
      peta.set(kunci, {
        kategori: kunci,
        baris: [],
        jumlahOpname: 0,
        subtotal: {
          openingQty: 0,
          openingValue: 0,
          incomingQty: 0,
          incomingValue: 0,
          outgoingQty: 0,
          outgoingValue: 0,
          closingQty: 0,
          closingValue: 0,
          opnameQty: 0,
          opnameValue: 0,
          selisihQty: 0,
          selisihValue: 0,
        },
      });
    }

    const grup = peta.get(kunci)!;
    grup.baris.push({ ...baris, nomor });

    const s = grup.subtotal;
    s.openingQty += baris.openingQty;
    s.openingValue += baris.openingValue;
    s.incomingQty += baris.incomingQty;
    s.incomingValue += baris.incomingValue;
    s.outgoingQty += baris.outgoingQty;
    s.outgoingValue += baris.outgoingValue;
    s.closingQty += baris.closingQty;
    s.closingValue += baris.closingValue;

    if (baris.opnameQty !== null && baris.opnameQty !== undefined) {
      s.opnameQty += baris.opnameQty;
      grup.jumlahOpname += 1;
    }
    if (baris.opnameValue !== null && baris.opnameValue !== undefined) s.opnameValue += baris.opnameValue;
    if (baris.selisihQty !== null && baris.selisihQty !== undefined) s.selisihQty += baris.selisihQty;
    if (baris.selisihValue !== null && baris.selisihValue !== undefined) s.selisihValue += baris.selisihValue;
  }

  return [...peta.values()];
}

/**
 * Menggabungkan baris dengan nama & satuan sama yang berasal dari unit kerja
 * berbeda. Dipakai saat lingkup laporan "Semua Bidang": lembar resmi SKPD hanya
 * memuat satu baris per barang (tanpa kolom unit), sedangkan master barang di
 * aplikasi diisolasi per unit kerja — tanpa penggabungan, satu barang muncul
 * beberapa kali dengan tag unit.
 */
export function gabungBarisLintasUnit<T extends BarisMutasi>(
  rows: T[]
): Array<T & { gabungan: true; jumlahUnit: number; id: string }> {
  const peta = new Map<string, T & { gabungan: true; jumlahUnit: number; id: string }>();

  for (const baris of rows) {
    const kunci = `${(baris.nama || "").trim().toLowerCase()}||${(baris.satuan || "").trim().toLowerCase()}`;
    const ada = peta.get(kunci);

    if (!ada) {
      peta.set(kunci, { ...baris, gabungan: true, jumlahUnit: 1, id: `gab-${kunci}` });
      continue;
    }

    ada.jumlahUnit += 1;
    ada.openingQty += baris.openingQty;
    ada.openingValue += baris.openingValue;
    ada.incomingQty += baris.incomingQty;
    ada.incomingValue += baris.incomingValue;
    ada.outgoingQty += baris.outgoingQty;
    ada.outgoingValue += baris.outgoingValue;
    ada.closingQty += baris.closingQty;
    ada.closingValue += baris.closingValue;

    if (baris.opnameQty !== null && baris.opnameQty !== undefined) {
      ada.opnameQty = (ada.opnameQty ?? 0) + baris.opnameQty;
    }
    if (baris.opnameValue !== null && baris.opnameValue !== undefined) {
      ada.opnameValue = (ada.opnameValue ?? 0) + baris.opnameValue;
    }
    if (baris.selisihQty !== null && baris.selisihQty !== undefined) {
      ada.selisihQty = (ada.selisihQty ?? 0) + baris.selisihQty;
    }
    if (baris.selisihValue !== null && baris.selisihValue !== undefined) {
      ada.selisihValue = (ada.selisihValue ?? 0) + baris.selisihValue;
    }

    // Kondisi dipakai hanya bila seluruh unit mencatat kondisi yang sama.
    if (ada.opnameKondisi && baris.opnameKondisi && ada.opnameKondisi !== baris.opnameKondisi) {
      ada.opnameKondisi = "Beragam";
    } else if (!ada.opnameKondisi && baris.opnameKondisi) {
      ada.opnameKondisi = baris.opnameKondisi;
    }

    const tanggalAda = ada.opnameTanggal;
    const tanggalBaru = baris.opnameTanggal;
    if (tanggalBaru && (!tanggalAda || tanggalBaru > tanggalAda)) {
      ada.opnameTanggal = tanggalBaru;
    }
  }

  for (const baris of peta.values()) {
    baris.negative = baris.closingQty < 0;
  }

  return [...peta.values()];
}
