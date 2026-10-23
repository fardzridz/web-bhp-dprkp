import { and, eq, inArray } from "drizzle-orm";
import { schema } from "@/db";
import type { Movement, OpeningBaseline, MovementSummary } from "@/lib/stock";
import { summarizeMovements } from "@/lib/stock";
import type { QuerySource } from "@/lib/inventory";

/**
 * Hitung stok & nilai sistem untuk sekumpulan barang per tanggal tertentu
 * (dipakai kertas kerja stock opname). Rumusnya sama dengan laporan mutasi:
 * saldo awal + penambahan - pengurangan.
 */
export async function computeStockAsOf(
  tx: QuerySource,
  bidangId: string,
  tanggal: string,
  itemIds?: string[]
): Promise<Map<string, MovementSummary>> {
  const baselines = await tx.query.openingBalances.findMany({
    where: eq(schema.openingBalances.bidangId, bidangId),
    columns: { itemId: true, tanggal: true, jumlah: true, hargaSatuan: true },
  });
  const baselineByItem = new Map<string, OpeningBaseline[]>();
  for (const b of baselines) {
    const list = baselineByItem.get(b.itemId);
    if (list) list.push(b);
    else baselineByItem.set(b.itemId, [b]);
  }

  const movementsByItem = new Map<string, Movement[]>();
  const pushMovement = (itemId: string, movement: Movement) => {
    const list = movementsByItem.get(itemId);
    if (list) list.push(movement);
    else movementsByItem.set(itemId, [movement]);
  };

  const inScope = (itemId: string) => !itemIds || itemIds.includes(itemId);

  const receipts = await tx.query.receipts.findMany({
    where: eq(schema.receipts.bidangId, bidangId),
    columns: { id: true, tanggal: true },
  });
  if (receipts.length > 0) {
    const receiptIds = receipts.map((r) => r.id);
    const tanggalByReceipt = new Map(receipts.map((r) => [r.id, r.tanggal]));
    const rows = await tx.query.receiptItems.findMany({
      where: and(
        inArray(schema.receiptItems.receiptId, receiptIds),
        itemIds ? inArray(schema.receiptItems.itemId, itemIds) : undefined
      ),
      columns: { itemId: true, receiptId: true, jumlah: true, jumlahHarga: true },
    });
    for (const row of rows) {
      if (!inScope(row.itemId)) continue;
      pushMovement(row.itemId, {
        itemId: row.itemId,
        tanggal: tanggalByReceipt.get(row.receiptId) || "",
        tipe: "IN",
        jumlah: row.jumlah,
        nilai: row.jumlahHarga,
      });
    }
  }

  const issues = await tx.query.issues.findMany({
    where: eq(schema.issues.bidangId, bidangId),
    columns: { id: true, tanggal: true },
  });
  if (issues.length > 0) {
    const issueIds = issues.map((i) => i.id);
    const tanggalByIssue = new Map(issues.map((i) => [i.id, i.tanggal]));
    const rows = await tx.query.issueItems.findMany({
      where: and(
        inArray(schema.issueItems.issueId, issueIds),
        itemIds ? inArray(schema.issueItems.itemId, itemIds) : undefined
      ),
      columns: { itemId: true, issueId: true, jumlah: true, totalNilaiFifo: true },
    });
    for (const row of rows) {
      if (!inScope(row.itemId)) continue;
      pushMovement(row.itemId, {
        itemId: row.itemId,
        tanggal: tanggalByIssue.get(row.issueId) || "",
        tipe: "OUT",
        jumlah: row.jumlah,
        nilai: row.totalNilaiFifo,
      });
    }
  }

  const targets =
    itemIds ??
    (
      await tx.query.items.findMany({
        where: eq(schema.items.bidangId, bidangId),
        columns: { id: true },
      })
    ).map((i) => i.id);

  const result = new Map<string, MovementSummary>();
  for (const itemId of targets) {
    const baselinesForItem = baselineByItem.get(itemId) || [];
    let latest: OpeningBaseline | undefined;
    for (const b of baselinesForItem) {
      if (!latest || b.tanggal > latest.tanggal) latest = b;
    }
    result.set(
      itemId,
      summarizeMovements(latest, movementsByItem.get(itemId) || [], "0000-01-01", tanggal)
    );
  }
  return result;
}
