import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db, schema } from "@/db";
import { and, asc, eq } from "drizzle-orm";
import { buildLedger, collectItemLedger, errorResponse } from "@/lib/inventory";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || (!session.activeBidangId && !session.bidangId)) {
    return NextResponse.json({ error: "Unauthorized / Bidang belum dipilih" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const itemId = searchParams.get("itemId");
  if (!itemId) {
    return NextResponse.json({ error: "itemId diperlukan" }, { status: 400 });
  }

  const activeBidangId =
    session.role === "SUPERADMIN"
      ? session.activeBidangId!
      : (session.bidangId || session.activeBidangId)!;

  try {
    const item = await db.query.items.findFirst({
      where: and(eq(schema.items.id, itemId), eq(schema.items.bidangId, activeBidangId)),
    });

    if (!item) {
      return NextResponse.json({ error: "Barang tidak ditemukan di bidang ini" }, { status: 404 });
    }

    let unitName = "-";
    if (item.satuanId) {
      const u = await db.query.units.findFirst({ where: eq(schema.units.id, item.satuanId) });
      if (u) unitName = u.nama;
    }

    // Pergerakan lengkap: baris saldo awal, penerimaan, pengeluaran, dan
    // penyesuaian stock opname — dihitung dari sumber yang sama dengan laporan.
    const ledgerRows = buildLedger(await collectItemLedger(db, activeBidangId, itemId));
    const lastRow = ledgerRows.length > 0 ? ledgerRows[ledgerRows.length - 1] : undefined;

    const ledger = ledgerRows.map((e) => ({
      tanggal: e.tanggal,
      tipe: e.tipe,
      nomorDokumen: e.nomorDokumen,
      keterangan: e.keterangan,
      inQty: e.tipe === "IN" ? e.qty : 0,
      hargaSatuan: e.hargaSatuan,
      inNilai: e.tipe === "IN" ? e.totalNilai : 0,
      outQty: e.tipe === "OUT" ? e.qty : 0,
      outNilai: e.tipe === "OUT" ? e.totalNilai : 0,
      saldoQty: e.saldoQty,
      saldoNilai: e.saldoNilai,
    }));

    const activeLayers = await db.query.fifoLayers.findMany({
      where: and(
        eq(schema.fifoLayers.bidangId, activeBidangId),
        eq(schema.fifoLayers.itemId, itemId),
        eq(schema.fifoLayers.status, "ACTIVE")
      ),
      orderBy: [asc(schema.fifoLayers.tanggal)],
    });

    return NextResponse.json({
      item: {
        ...item,
        satuanNama: unitName,
      },
      currentStock: lastRow?.saldoQty ?? 0,
      currentValue: lastRow?.saldoNilai ?? 0,
      activeLayers,
      ledger,
    });
  } catch (err: unknown) {
    return errorResponse(err);
  }
}
