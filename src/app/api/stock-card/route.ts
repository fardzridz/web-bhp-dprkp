import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db, schema } from "@/db";
import { and, asc, eq, inArray } from "drizzle-orm";
import { buildLedger, collectItemLedger, errorResponse } from "@/lib/inventory";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || (!session.activeBidangId && !session.bidangId)) {
    return NextResponse.json({ error: "Unauthorized / Bidang belum dipilih" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const itemId = searchParams.get("itemId");
  const itemIdsParam = searchParams.get("itemIds"); // comma separated
  const allParam = searchParams.get("all"); // "true"

  const activeBidangId =
    session.role === "SUPERADMIN"
      ? session.activeBidangId!
      : (session.bidangId || session.activeBidangId)!;

  try {
    let targetItems: Array<typeof schema.items.$inferSelect> = [];

    if (allParam === "true") {
      targetItems = await db.query.items.findMany({
        where: eq(schema.items.bidangId, activeBidangId),
        orderBy: [asc(schema.items.kode)],
      });
    } else if (itemIdsParam) {
      const ids = itemIdsParam.split(",").map((s) => s.trim()).filter(Boolean);
      if (ids.length > 0) {
        targetItems = await db.query.items.findMany({
          where: and(eq(schema.items.bidangId, activeBidangId), inArray(schema.items.id, ids)),
          orderBy: [asc(schema.items.kode)],
        });
      }
    } else if (itemId) {
      const it = await db.query.items.findFirst({
        where: and(eq(schema.items.id, itemId), eq(schema.items.bidangId, activeBidangId)),
      });
      if (it) targetItems = [it];
    }

    if (targetItems.length === 0) {
      return NextResponse.json({ error: "Barang tidak ditemukan" }, { status: 404 });
    }

    const allUnits = await db.query.units.findMany();
    const unitMap = new Map(allUnits.map((u: typeof schema.units.$inferSelect) => [u.id, u.nama]));

    const results = [];

    for (const item of targetItems) {
      const unitName = item.satuanId ? unitMap.get(item.satuanId) || "-" : "-";
      const ledgerRows = buildLedger(await collectItemLedger(db, activeBidangId, item.id));
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
          eq(schema.fifoLayers.itemId, item.id),
          eq(schema.fifoLayers.status, "ACTIVE")
        ),
        orderBy: [asc(schema.fifoLayers.tanggal)],
      });

      results.push({
        item: {
          ...item,
          satuanNama: unitName,
        },
        currentStock: lastRow?.saldoQty ?? 0,
        currentValue: lastRow?.saldoNilai ?? 0,
        activeLayers,
        ledger,
      });
    }

    // Jika dipanggil dengan all=true atau itemIds, kembalikan array cards: [...]
    if (allParam === "true" || itemIdsParam) {
      return NextResponse.json({
        cards: results,
      });
    }

    // Fallback single item untuk backward compatibility
    return NextResponse.json(results[0]);
  } catch (err: unknown) {
    return errorResponse(err);
  }
}
