import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db, schema } from "@/db";
import { eq, and, asc } from "drizzle-orm";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || !session.activeBidangId) {
    return NextResponse.json({ error: "Unauthorized / Bidang belum dipilih" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const itemId = searchParams.get("itemId");
  if (!itemId) {
    return NextResponse.json({ error: "itemId diperlukan" }, { status: 400 });
  }

  const activeBidangId = session.activeBidangId;

  // 1. Fetch Item info
  const item = await db.query.items.findFirst({
    where: and(eq(schema.items.id, itemId), eq(schema.items.bidangId, activeBidangId)),
  });

  if (!item) {
    return NextResponse.json({ error: "Barang tidak ditemukan di bidang ini" }, { status: 404 });
  }

  // Fetch unit
  let unitName = "-";
  if (item.satuanId) {
    const u = await db.query.units.findFirst({ where: eq(schema.units.id, item.satuanId) });
    if (u) unitName = u.nama;
  }

  // 2. Fetch Receipts containing this item
  const receiptItems = await db.query.receiptItems.findMany({
    where: eq(schema.receiptItems.itemId, itemId),
  });

  const receiptIds = receiptItems.map((r) => r.receiptId);
  const receiptsList = await db.query.receipts.findMany({
    where: (r, { inArray }) => inArray(r.id, receiptIds.length ? receiptIds : ["none"]),
  });
  const receiptMap: Record<string, typeof receiptsList[0]> = {};
  for (const r of receiptsList) receiptMap[r.id] = r;

  // 3. Fetch Issues containing this item
  const issueItems = await db.query.issueItems.findMany({
    where: eq(schema.issueItems.itemId, itemId),
  });

  const issueIds = issueItems.map((i) => i.issueId);
  const issuesList = await db.query.issues.findMany({
    where: (i, { inArray }) => inArray(i.id, issueIds.length ? issueIds : ["none"]),
  });
  const issueMap: Record<string, typeof issuesList[0]> = {};
  for (const iss of issuesList) issueMap[iss.id] = iss;

  // 4. Combine into chronological ledger
  interface LedgerEntry {
    tanggal: string;
    tipe: "IN" | "OUT";
    nomorDokumen: string;
    keterangan: string;
    inQty: number;
    hargaSatuan: number;
    inNilai: number;
    outQty: number;
    outNilai: number;
    saldoQty: number;
    saldoNilai: number;
  }

  const rawEntries: Array<{
    tanggal: string;
    createdAt: number;
    tipe: "IN" | "OUT";
    nomorDokumen: string;
    keterangan: string;
    qty: number;
    hargaSatuan: number;
    totalNilai: number;
  }> = [];

  for (const ri of receiptItems) {
    const parent = receiptMap[ri.receiptId];
    if (parent && parent.bidangId === activeBidangId) {
      rawEntries.push({
        tanggal: parent.tanggal,
        createdAt: parent.createdAt,
        tipe: "IN",
        nomorDokumen: parent.nomorDokumen,
        keterangan: `Dari: ${parent.vendorNama || "-"} (Faktur: ${parent.noFaktur || "-"})`,
        qty: ri.jumlah,
        hargaSatuan: ri.hargaSatuan,
        totalNilai: ri.jumlahHarga,
      });
    }
  }

  for (const ii of issueItems) {
    const parent = issueMap[ii.issueId];
    if (parent && parent.bidangId === activeBidangId) {
      const avgPrice = ii.jumlah > 0 ? ii.totalNilaiFifo / ii.jumlah : 0;
      rawEntries.push({
        tanggal: parent.tanggal,
        createdAt: parent.createdAt,
        tipe: "OUT",
        nomorDokumen: parent.nomorDokumen,
        keterangan: `Untuk: ${parent.penerima} (${parent.keperluan || "Operasional"})`,
        qty: ii.jumlah,
        hargaSatuan: avgPrice,
        totalNilai: ii.totalNilaiFifo,
      });
    }
  }

  // Sort ascending by date
  rawEntries.sort((a, b) => {
    if (a.tanggal !== b.tanggal) return a.tanggal.localeCompare(b.tanggal);
    return a.createdAt - b.createdAt;
  });

  let runningQty = 0;
  let runningNilai = 0;

  const ledger: LedgerEntry[] = rawEntries.map((e) => {
    if (e.tipe === "IN") {
      runningQty += e.qty;
      runningNilai += e.totalNilai;
      return {
        tanggal: e.tanggal,
        tipe: "IN",
        nomorDokumen: e.nomorDokumen,
        keterangan: e.keterangan,
        inQty: e.qty,
        hargaSatuan: e.hargaSatuan,
        inNilai: e.totalNilai,
        outQty: 0,
        outNilai: 0,
        saldoQty: runningQty,
        saldoNilai: runningNilai,
      };
    } else {
      runningQty -= e.qty;
      runningNilai -= e.totalNilai;
      return {
        tanggal: e.tanggal,
        tipe: "OUT",
        nomorDokumen: e.nomorDokumen,
        keterangan: e.keterangan,
        inQty: 0,
        hargaSatuan: e.hargaSatuan,
        inNilai: 0,
        outQty: e.qty,
        outNilai: e.totalNilai,
        saldoQty: runningQty,
        saldoNilai: runningNilai,
      };
    }
  });

  // 5. Active FIFO Layers breakdown
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
    currentStock: runningQty,
    currentValue: runningNilai,
    activeLayers,
    ledger,
  });
}
