import { and, asc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";

/**
 * Helper integritas persediaan: normalisasi baris, validasi kepemilikan barang,
 * pemotongan/pemulihan FIFO, dan penomoran dokumen berurutan.
 *
 * Semua fungsi yang menerima `tx` WAJIB dipanggil di dalam db.transaction()
 * supaya tidak pernah ada penulisan separuh jalan.
 */

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Error yang pesannya aman ditampilkan ke pengguna (bukan kegagalan server). */
export class DataError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "DataError";
    this.status = status;
  }
}

let idCounter = 0;
/** ID unik: timestamp + counter proses + acak (aman untuk loop cepat). */
export function newId(prefix: string): string {
  idCounter = (idCounter + 1) % 1296;
  return `${prefix}-${Date.now().toString(36)}${idCounter.toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

export function isUniqueViolation(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /UNIQUE constraint failed|SQLITE_CONSTRAINT|constraint failed/i.test(msg);
}

/** Jalankan ulang operasi bila terjadi bentrok nomor dokumen/kode (maks. 5x). */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      // attempts = 1 berarti pemanggil tidak ingin mencoba ulang (mis. update
      // dengan nomor manual): biarkan error aslinya mengalir ke pemanggil.
      if (attempts <= 1 || !isUniqueViolation(err)) throw err;
      lastErr = err;
    }
  }
  throw new DataError(
    "Nomor dokumen/kode bentrok dengan data yang tersimpan" +
      (lastErr instanceof Error ? ` (${lastErr.message})` : "") +
      ". Coba simpan ulang.",
    409
  );
}

export function errorResponse(err: unknown): Response {
  if (err instanceof DataError) {
    return Response.json({ error: err.message }, { status: err.status });
  }
  if (isUniqueViolation(err)) {
    return Response.json(
      { error: "Data bentrok dengan nomor/kode yang sudah ada. Periksa kembali nomor dokumen atau kode barang." },
      { status: 409 }
    );
  }
  const msg = err instanceof Error ? err.message : "Terjadi kesalahan pada server";
  return Response.json({ error: msg }, { status: 500 });
}

// ---------------------------------------------------------------- normalisasi

export interface ReceiptRowInput {
  itemId: string;
  jumlah: number;
  hargaSatuan: number;
}

export interface IssueRowInput {
  itemId: string;
  jumlah: number;
}

function toPositiveNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Baris penerimaan: buang baris tidak valid, gabungkan baris dengan barang &
 * harga sama (satu faktur sering menuliskan barang yang sama dua kali).
 */
export function normalizeReceiptRows(raw: unknown): ReceiptRowInput[] {
  if (!Array.isArray(raw)) return [];
  const merged = new Map<string, ReceiptRowInput>();
  for (const entry of raw as ReceiptRowInput[]) {
    const itemId = typeof entry?.itemId === "string" ? entry.itemId.trim() : "";
    const jumlah = toPositiveNumber(entry?.jumlah);
    const hargaSatuan = toPositiveNumber(entry?.hargaSatuan);
    if (!itemId || !(jumlah > 0) || !(hargaSatuan >= 0)) continue;
    const key = `${itemId}::${hargaSatuan}`;
    const found = merged.get(key);
    if (found) found.jumlah += jumlah;
    else merged.set(key, { itemId, jumlah, hargaSatuan });
  }
  return [...merged.values()];
}

/**
 * Baris pengeluaran: gabungkan baris dengan barang sama dengan MENJUMLAHKAN
 * jumlahnya, supaya validasi stok dihitung dari total kebutuhan.
 */
export function normalizeIssueRows(raw: unknown): IssueRowInput[] {
  if (!Array.isArray(raw)) return [];
  const merged = new Map<string, IssueRowInput>();
  for (const entry of raw as IssueRowInput[]) {
    const itemId = typeof entry?.itemId === "string" ? entry.itemId.trim() : "";
    const jumlah = toPositiveNumber(entry?.jumlah);
    if (!itemId || !(jumlah > 0)) continue;
    const found = merged.get(itemId);
    if (found) found.jumlah += jumlah;
    else merged.set(itemId, { itemId, jumlah });
  }
  return [...merged.values()];
}

// ------------------------------------------------------------------ validasi

/** Pastikan semua barang benar milik unit kerja aktif (cegah barang lintas bidang). */
export async function assertItemsBelongToBidang(
  tx: Tx,
  bidangId: string,
  itemIds: string[]
): Promise<void> {
  if (itemIds.length === 0) return;
  const rows = await tx.query.items.findMany({
    where: and(eq(schema.items.bidangId, bidangId), inArray(schema.items.id, itemIds)),
    columns: { id: true },
  });
  if (rows.length !== new Set(itemIds).size) {
    throw new DataError(
      "Ada barang yang tidak terdaftar di unit kerja aktif. Barang milik unit kerja lain tidak dapat dicatat di sini.",
      403
    );
  }
}

/** Total stok tersedia (jumlah sisa seluruh lapisan aktif) untuk sekumpulan item. */
export async function getAvailableStock(
  tx: Tx,
  bidangId: string,
  itemIds: string[]
): Promise<Map<string, number>> {
  const stock = new Map<string, number>();
  if (itemIds.length === 0) return stock;
  const layers = await tx.query.fifoLayers.findMany({
    where: and(
      eq(schema.fifoLayers.bidangId, bidangId),
      inArray(schema.fifoLayers.itemId, itemIds),
      eq(schema.fifoLayers.status, "ACTIVE")
    ),
    columns: { itemId: true, sisa: true },
  });
  for (const l of layers) stock.set(l.itemId, (stock.get(l.itemId) || 0) + l.sisa);
  return stock;
}

/** Validasi stok agregat per barang; pesan menyebut angka tersedia vs diminta. */
export async function assertIssueStock(
  tx: Tx,
  bidangId: string,
  rows: IssueRowInput[]
): Promise<void> {
  const stock = await getAvailableStock(tx, bidangId, rows.map((r) => r.itemId));
  for (const row of rows) {
    const available = stock.get(row.itemId) || 0;
    if (available < row.jumlah) {
      const item = await tx.query.items.findFirst({
        where: eq(schema.items.id, row.itemId),
        columns: { nama: true },
      });
      throw new DataError(
        `Stok "${item?.nama || "Barang"}" tidak mencukupi. Tersedia: ${available}, diminta: ${row.jumlah}.`
      );
    }
  }
}

// ---------------------------------------------------------------------- FIFO

export interface FifoUsageRow {
  id: string;
  issueItemId: string;
  fifoLayerId: string;
  jumlah: number;
  hargaSatuan: number;
  nilai: number;
}

export interface DeductionResult {
  usageRows: FifoUsageRow[];
  totalValue: number;
}

/**
 * Potong stok dari lapisan FIFO terlama. Gagal (throw) bila stok berubah di
 * tengah jalan atau tidak cukup, sehingga transaksi ikut dibatalkan.
 */
export async function deductFifo(
  tx: Tx,
  params: { bidangId: string; itemId: string; qty: number; issueItemId: string }
): Promise<DeductionResult> {
  const { bidangId, itemId, qty, issueItemId } = params;
  const layers = await tx.query.fifoLayers.findMany({
    where: and(
      eq(schema.fifoLayers.bidangId, bidangId),
      eq(schema.fifoLayers.itemId, itemId),
      eq(schema.fifoLayers.status, "ACTIVE")
    ),
    orderBy: [asc(schema.fifoLayers.tanggal), asc(schema.fifoLayers.id)],
  });

  const usageRows: FifoUsageRow[] = [];
  let totalValue = 0;
  let remaining = qty;

  for (const layer of layers) {
    if (remaining <= 0) break;
    const take = Math.min(layer.sisa, remaining);
    if (take <= 0) continue;

    const newSisa = layer.sisa - take;
    const updated = await tx
      .update(schema.fifoLayers)
      .set({ sisa: newSisa, status: newSisa <= 0 ? "EXHAUSTED" : "ACTIVE" })
      .where(and(eq(schema.fifoLayers.id, layer.id), eq(schema.fifoLayers.sisa, layer.sisa)));

    if (updated.rowsAffected === 0) {
      throw new DataError(
        "Stok berubah saat transaksi diproses (mungkin ada pengguna lain). Silakan ulangi penyimpanan.",
        409
      );
    }

    const nilai = take * layer.hargaSatuan;
    totalValue += nilai;
    remaining -= take;
    usageRows.push({
      id: newId("usg"),
      issueItemId,
      fifoLayerId: layer.id,
      jumlah: take,
      hargaSatuan: layer.hargaSatuan,
      nilai,
    });
  }

  if (remaining > 0) {
    throw new DataError(
      `Stok tidak mencukupi saat pemotongan FIFO (kurang ${remaining} unit). Transaksi dibatalkan, tidak ada perubahan tersimpan.`
    );
  }

  return { usageRows, totalValue };
}

/** Kembalikan seluruh potongan FIFO milik sekumpulan baris pengeluaran. */
export async function restoreFifoUsages(tx: Tx, issueItemIds: string[]): Promise<void> {
  if (issueItemIds.length === 0) return;
  const usages = await tx.query.fifoUsages.findMany({
    where: inArray(schema.fifoUsages.issueItemId, issueItemIds),
  });
  for (const u of usages) {
    const layer = await tx.query.fifoLayers.findFirst({
      where: eq(schema.fifoLayers.id, u.fifoLayerId),
    });
    if (layer) {
      await tx
        .update(schema.fifoLayers)
        .set({ sisa: layer.sisa + u.jumlah, status: "ACTIVE" })
        .where(eq(schema.fifoLayers.id, layer.id));
    }
  }
  await tx.delete(schema.fifoUsages).where(inArray(schema.fifoUsages.issueItemId, issueItemIds));
}

// ---------------------------------------------------------------- penomoran

function sequenceSuffix(value: string): number {
  const m = value.match(/(\d+)\s*$/);
  return m ? Number(m[1]) : 0;
}

function pad(seq: number): string {
  return String(seq).padStart(4, "0");
}

/** Buat lapisan stok tanpa dokumen penerimaan (saldo awal / penambahan opname). */
export async function insertStockLayer(
  tx: Tx,
  params: { bidangId: string; itemId: string; tanggal: string; jumlah: number; hargaSatuan: number }
): Promise<string> {
  const layerId = newId("layer");
  await tx.insert(schema.fifoLayers).values({
    id: layerId,
    bidangId: params.bidangId,
    itemId: params.itemId,
    receiptItemId: null,
    tanggal: params.tanggal,
    hargaSatuan: params.hargaSatuan,
    jumlahAwal: params.jumlah,
    sisa: params.jumlah,
    status: "ACTIVE",
  });
  return layerId;
}

/**
 * Nomor dokumen berikutnya: `<kodeJenis>/<kodeBidang>/<tahun>/0001`.
 * Memakai nomor terbesar yang sudah ada (bukan jumlah baris), sehingga nomor
 * tidak terpakai ulang ketika dokumen lama dihapus.
 */
export async function nextReceiptNumber(
  tx: QuerySource,
  bidangId: string,
  bidangKode: string,
  year: string
): Promise<string> {
  const head = `RCV/${bidangKode}/${year}/`;
  const rows = await tx.query.receipts.findMany({
    where: eq(schema.receipts.bidangId, bidangId),
    columns: { nomorDokumen: true },
  });
  const max = rows
    .filter((r) => r.nomorDokumen.startsWith(head))
    .reduce((acc, r) => Math.max(acc, sequenceSuffix(r.nomorDokumen)), 0);
  return `${head}${pad(max + 1)}`;
}

export async function nextIssueNumber(
  tx: QuerySource,
  bidangId: string,
  bidangKode: string,
  year: string
): Promise<string> {
  const head = `BAST/${bidangKode}/${year}/`;
  const rows = await tx.query.issues.findMany({
    where: eq(schema.issues.bidangId, bidangId),
    columns: { nomorDokumen: true },
  });
  const max = rows
    .filter((r) => r.nomorDokumen.startsWith(head))
    .reduce((acc, r) => Math.max(acc, sequenceSuffix(r.nomorDokumen)), 0);
  return `${head}${pad(max + 1)}`;
}

/** Kode barang berikutnya: `<KODE>-0001`, memakai nomor terbesar yang sudah ada. */
export async function nextItemCode(tx: QuerySource, bidangId: string, bidangKode: string): Promise<string> {
  const head = `${bidangKode}-`;
  const rows = await tx.query.items.findMany({
    where: eq(schema.items.bidangId, bidangId),
    columns: { kode: true },
  });
  const max = rows
    .filter((r) => r.kode.startsWith(head))
    .reduce((acc, r) => Math.max(acc, sequenceSuffix(r.kode)), 0);
  return `${head}${pad(max + 1)}`;
}

/** Kode bidang untuk penomoran dokumen (fallback "BHP"). */
export function sanitizeBidangKode(kode?: string | null): string {
  return (kode || "BHP").toUpperCase().replace(/[^A-Z0-9]/g, "") || "BHP";
}

// ------------------------------------------------------------------ kartu stok

/** Nilai `db` maupun `tx` di dalam transaksi punya bentuk query relasional yang sama. */
export type QuerySource = { query: typeof db.query };

export interface ItemLedgerEntry {
  tanggal: string;
  createdAt: number;
  tipe: "IN" | "OUT";
  nomorDokumen: string;
  keterangan: string;
  qty: number;
  hargaSatuan: number;
  totalNilai: number;
}

export interface ItemLedgerRow extends ItemLedgerEntry {
  saldoQty: number;
  saldoNilai: number;
}

/**
 * Seluruh pergerakan satu barang: baris saldo awal (bila ada), penerimaan,
 * dan pengeluaran — termasuk dokumen penyesuaian stock opname.
 * Pergerakan yang sudah tercakup dalam saldo awal tidak diulang.
 */
export async function collectItemLedger(
  tx: QuerySource,
  bidangId: string,
  itemId: string
): Promise<ItemLedgerEntry[]> {
  const baselines = await tx.query.openingBalances.findMany({
    where: and(eq(schema.openingBalances.bidangId, bidangId), eq(schema.openingBalances.itemId, itemId)),
    orderBy: [asc(schema.openingBalances.tanggal), asc(schema.openingBalances.createdAt)],
  });
  const baseline = baselines.length > 0 ? baselines[baselines.length - 1] : undefined;

  const adjustments = await tx.query.stockAdjustments.findMany({
    where: eq(schema.stockAdjustments.bidangId, bidangId),
    columns: { id: true, issueId: true, receiptId: true, nomorDokumen: true },
  });
  const opnameIssueIds = new Set(adjustments.map((a) => a.issueId).filter(Boolean) as string[]);
  const opnameReceiptIds = new Set(adjustments.map((a) => a.receiptId).filter(Boolean) as string[]);

  const entries: ItemLedgerEntry[] = [];

  if (baseline) {
    entries.push({
      tanggal: baseline.tanggal,
      createdAt: baseline.createdAt,
      tipe: "IN",
      nomorDokumen: "SALDO AWAL",
      keterangan: baseline.keterangan || "Saldo awal persediaan",
      qty: baseline.jumlah,
      hargaSatuan: baseline.hargaSatuan,
      totalNilai: baseline.jumlah * baseline.hargaSatuan,
    });
  }

  const receiptItems = await tx.query.receiptItems.findMany({
    where: eq(schema.receiptItems.itemId, itemId),
  });
  if (receiptItems.length > 0) {
    const parents = await tx.query.receipts.findMany({
      where: inArray(
        schema.receipts.id,
        receiptItems.map((r) => r.receiptId)
      ),
    });
    const parentMap = new Map(parents.map((p) => [p.id, p]));
    for (const ri of receiptItems) {
      const parent = parentMap.get(ri.receiptId);
      if (!parent || parent.bidangId !== bidangId) continue;
      if (baseline && parent.tanggal <= baseline.tanggal) continue;
      const isOpname = opnameReceiptIds.has(parent.id);
      entries.push({
        tanggal: parent.tanggal,
        createdAt: parent.createdAt,
        tipe: "IN",
        nomorDokumen: parent.nomorDokumen,
        keterangan: isOpname
          ? `Penyesuaian Stock Opname: ${parent.keterangan || parent.nomorDokumen}`
          : `Dari: ${parent.vendorNama || "-"} (Faktur: ${parent.noFaktur || "-"})`,
        qty: ri.jumlah,
        hargaSatuan: ri.hargaSatuan,
        totalNilai: ri.jumlahHarga,
      });
    }
  }

  const issueItems = await tx.query.issueItems.findMany({
    where: eq(schema.issueItems.itemId, itemId),
  });
  if (issueItems.length > 0) {
    const parents = await tx.query.issues.findMany({
      where: inArray(
        schema.issues.id,
        issueItems.map((i) => i.issueId)
      ),
    });
    const parentMap = new Map(parents.map((p) => [p.id, p]));
    for (const ii of issueItems) {
      const parent = parentMap.get(ii.issueId);
      if (!parent || parent.bidangId !== bidangId) continue;
      if (baseline && parent.tanggal <= baseline.tanggal) continue;
      const isOpname = opnameIssueIds.has(parent.id) || parent.jenis === "PENYESUAIAN";
      entries.push({
        tanggal: parent.tanggal,
        createdAt: parent.createdAt,
        tipe: "OUT",
        nomorDokumen: parent.nomorDokumen,
        keterangan: isOpname
          ? `Penyesuaian Stock Opname: ${parent.keterangan || parent.nomorDokumen}`
          : `Untuk: ${parent.penerima}${parent.keperluan ? ` (${parent.keperluan})` : ""}`,
        qty: ii.jumlah,
        hargaSatuan: ii.jumlah > 0 ? ii.totalNilaiFifo / ii.jumlah : 0,
        totalNilai: ii.totalNilaiFifo,
      });
    }
  }

  return entries;
}

/** Urutkan pergerakan dan hitung saldo berjalan (untuk Kartu Barang). */
export function buildLedger(entries: ItemLedgerEntry[]): ItemLedgerRow[] {
  const sorted = [...entries].sort((a, b) => {
    if (a.tanggal !== b.tanggal) return a.tanggal.localeCompare(b.tanggal);
    return a.createdAt - b.createdAt;
  });

  let saldoQty = 0;
  let saldoNilai = 0;
  return sorted.map((e) => {
    if (e.tipe === "IN") {
      saldoQty += e.qty;
      saldoNilai += e.totalNilai;
    } else {
      saldoQty -= e.qty;
      saldoNilai -= e.totalNilai;
    }
    return { ...e, saldoQty, saldoNilai };
  });
}

/** Nomor dokumen penyesuaian stock opname. */
export async function nextAdjustmentNumber(
  tx: QuerySource,
  bidangId: string,
  bidangKode: string,
  year: string
): Promise<string> {
  const head = `PENY/${bidangKode}/${year}/`;
  const rows = await tx.query.stockAdjustments.findMany({
    where: eq(schema.stockAdjustments.bidangId, bidangId),
    columns: { nomorDokumen: true },
  });
  const max = rows
    .filter((r) => r.nomorDokumen.startsWith(head))
    .reduce((acc, r) => Math.max(acc, sequenceSuffix(r.nomorDokumen)), 0);
  return `${head}${pad(max + 1)}`;
}

// ------------------------------------------------- resolusi & pembuatan barang
export interface ItemResolver {
  bidangId: string;
  bidangKode: string;
  byName: Map<string, string>;
  kategoriByName: Map<string, string>;
  satuanByName: Map<string, string>;
  nextSeq: number;
  createdItems: number;
}

/**
 * Cache pencarian barang/kategori/satuan + penomorannya, dipakai bersama oleh
 * impor master dan impor saldo awal supaya aturannya identik.
 */
export async function createItemResolver(
  tx: Tx,
  bidangId: string,
  bidangKode: string
): Promise<ItemResolver> {
  const items = await tx.query.items.findMany({
    where: eq(schema.items.bidangId, bidangId),
    columns: { id: true, nama: true, kode: true },
  });
  const categories = await tx.query.categories.findMany({
    where: eq(schema.categories.bidangId, bidangId),
    columns: { id: true, nama: true },
  });
  const units = await tx.query.units.findMany({ columns: { id: true, nama: true } });

  const head = `${bidangKode}-`;
  let maxSeq = 0;
  for (const item of items) {
    if (item.kode.startsWith(head)) maxSeq = Math.max(maxSeq, sequenceSuffix(item.kode));
  }

  const byName = new Map<string, string>();
  for (const i of items) byName.set(i.nama.trim().toLowerCase(), i.id);
  const kategoriByName = new Map<string, string>();
  for (const c of categories) kategoriByName.set(c.nama.trim().toLowerCase(), c.id);
  const satuanByName = new Map<string, string>();
  for (const u of units) satuanByName.set(u.nama.trim().toLowerCase(), u.id);

  return {
    bidangId,
    bidangKode,
    byName,
    kategoriByName,
    satuanByName,
    nextSeq: maxSeq + 1,
    createdItems: 0,
  };
}

/** Ambil barang berdasarkan nama; buat baru (beserta kategori/satuannya) bila belum ada. */
export async function resolveOrCreateItem(
  tx: Tx,
  resolver: ItemResolver,
  input: { nama: string; satuan?: string | null; kategori?: string | null; stokMinimum?: number }
): Promise<string> {
  const nama = input.nama.trim();
  const key = nama.toLowerCase();
  const existing = resolver.byName.get(key);
  if (existing) return existing;

  const now = Date.now();
  const kategoriNama = input.kategori?.trim();
  let kategoriId: string | null = null;
  if (kategoriNama) {
    const catKey = kategoriNama.toLowerCase();
    let id = resolver.kategoriByName.get(catKey);
    if (!id) {
      id = newId("ktg");
      await tx.insert(schema.categories).values({
        id,
        bidangId: resolver.bidangId,
        nama: kategoriNama,
        createdAt: now,
      });
      resolver.kategoriByName.set(catKey, id);
    }
    kategoriId = id;
  }

  const satuanNama = input.satuan?.trim().toLowerCase();
  let satuanId: string | null = null;
  if (satuanNama) {
    let id = resolver.satuanByName.get(satuanNama);
    if (!id) {
      id = `unit-${satuanNama.replace(/[^a-z0-9]/g, "-")}`;
      await tx
        .insert(schema.units)
        .values({ id, nama: satuanNama, createdAt: now })
        .onConflictDoNothing();
      resolver.satuanByName.set(satuanNama, id);
    }
    satuanId = id;
  }

  const itemId = newId("item");
  await tx.insert(schema.items).values({
    id: itemId,
    bidangId: resolver.bidangId,
    kode: `${resolver.bidangKode}-${pad(resolver.nextSeq)}`,
    nama,
    kategoriId,
    satuanId,
    stokMinimum: Number(input.stokMinimum) || 0,
    status: "ACTIVE",
    createdAt: now,
    updatedAt: now,
  });
  resolver.nextSeq += 1;
  resolver.byName.set(key, itemId);
  resolver.createdItems += 1;
  return itemId;
}
