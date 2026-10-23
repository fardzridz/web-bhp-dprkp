/**
 * Aturan perhitungan mutasi persediaan — dipakai bersama oleh laporan resmi
 * maupun kertas kerja stock opname.
 *
 * Rumus resmi formulir DPRKP:
 *   Saldo Akhir (kolom 9) = Saldo Awal (3) + Penambahan (5) - Pengurangan (7)
 *
 * Saldo awal berasal dari "saldo awal" yang ditetapkan admin (per tanggal),
 * bukan hanya dari dokumen. Aturan pemisahannya:
 *   - dokumen bertanggal <= tanggal saldo awal  -> sudah tercakup di saldo awal
 *   - dokumen sebelum periode (tetapi setelah saldo awal) -> menambah/mengurangi saldo awal
 *   - dokumen dalam periode -> kolom Penambahan / Pengurangan
 * Bila belum ada saldo awal, seluruh dokumen sebelum periode dianggap saldo awal
 * (perilaku lama).
 */

export interface OpeningBaseline {
  itemId: string;
  tanggal: string;
  jumlah: number;
  hargaSatuan: number;
}

export interface Movement {
  itemId: string;
  tanggal: string;
  tipe: "IN" | "OUT";
  jumlah: number;
  nilai: number;
}

export interface MovementSummary {
  baselineTanggal: string | null;
  openingQty: number;
  openingValue: number;
  incomingQty: number;
  incomingValue: number;
  outgoingQty: number;
  outgoingValue: number;
  closingQty: number;
  closingValue: number;
}

const ROUND_EPSILON = 1e-9;

/**
 * Ringkas mutasi satu barang untuk periode startDate..endDate.
 * `movements` tidak perlu terurut.
 */
export function summarizeMovements(
  baseline: OpeningBaseline | undefined,
  movements: Movement[],
  startDate: string,
  endDate: string
): MovementSummary {
  const baselineTanggal = baseline?.tanggal ?? "";
  let openingQty = baseline?.jumlah ?? 0;
  let openingValue = baseline ? baseline.jumlah * baseline.hargaSatuan : 0;
  let incomingQty = 0;
  let incomingValue = 0;
  let outgoingQty = 0;
  let outgoingValue = 0;

  for (const m of movements) {
    // Sudah termasuk dalam angka saldo awal -> jangan dihitung dua kali.
    if (baselineTanggal && m.tanggal <= baselineTanggal) continue;

    if (m.tanggal < startDate) {
      if (m.tipe === "IN") {
        openingQty += m.jumlah;
        openingValue += m.nilai;
      } else {
        openingQty -= m.jumlah;
        openingValue -= m.nilai;
      }
      continue;
    }

    if (m.tanggal > endDate) continue;

    if (m.tipe === "IN") {
      incomingQty += m.jumlah;
      incomingValue += m.nilai;
    } else {
      outgoingQty += m.jumlah;
      outgoingValue += m.nilai;
    }
  }

  return {
    baselineTanggal: baseline ? baseline.tanggal : null,
    openingQty,
    openingValue,
    incomingQty,
    incomingValue,
    outgoingQty,
    outgoingValue,
    closingQty: openingQty + incomingQty - outgoingQty,
    closingValue: openingValue + incomingValue - outgoingValue,
  };
}

/** Saldo awal terakhir yang berlaku sampai tanggal tertentu (null bila belum ada). */
export function pickBaseline(
  baselines: OpeningBaseline[],
  asOfDate: string
): OpeningBaseline | undefined {
  let picked: OpeningBaseline | undefined;
  for (const b of baselines) {
    if (b.tanggal > asOfDate) continue;
    if (!picked || b.tanggal > picked.tanggal) picked = b;
  }
  return picked;
}

/** Kelompokkan saldo awal per barang agar mudah dicari. */
export function groupBaselinesByItem(baselines: OpeningBaseline[]): Map<string, OpeningBaseline[]> {
  const grouped = new Map<string, OpeningBaseline[]>();
  for (const b of baselines) {
    const list = grouped.get(b.itemId);
    if (list) list.push(b);
    else grouped.set(b.itemId, [b]);
  }
  return grouped;
}

/** Kelompokkan dokumen (mutasi) per barang. */
export function groupMovementsByItem(movements: Movement[]): Map<string, Movement[]> {
  const grouped = new Map<string, Movement[]>();
  for (const m of movements) {
    const list = grouped.get(m.itemId);
    if (list) list.push(m);
    else grouped.set(m.itemId, [m]);
  }
  return grouped;
}

/** Nilai persediaan rata-rata per satuan (dipakai untuk harga sistem saat opname). */
export function averageUnitValue(qty: number, value: number): number {
  return qty > ROUND_EPSILON ? value / qty : 0;
}
