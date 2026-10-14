import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db, schema } from "@/db";
import { eq, desc } from "drizzle-orm";
import { recordActivityLog } from "@/lib/activity-log";

interface ReceiptItemInput {
  itemId: string;
  jumlah: number;
  hargaSatuan: number;
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || !session.activeBidangId) {
    return NextResponse.json({ error: "Unauthorized / Bidang belum dipilih" }, { status: 401 });
  }

  const receiptsList = await db.query.receipts.findMany({
    where: eq(schema.receipts.bidangId, session.activeBidangId),
    orderBy: [desc(schema.receipts.tanggal), desc(schema.receipts.createdAt)],
  });

  // Fetch details for each receipt
  const results = [];
  for (const r of receiptsList) {
    const items = await db.query.receiptItems.findMany({
      where: eq(schema.receiptItems.receiptId, r.id),
    });

    const itemIds = items.map((i) => i.itemId);
    const itemDetails = await db.query.items.findMany({
      where: (it, { inArray }) => inArray(it.id, itemIds.length ? itemIds : ["none"]),
    });
    const itemNameMap: Record<string, string> = {};
    for (const it of itemDetails) itemNameMap[it.id] = it.nama;

    const enrichedItems = items.map((i) => ({
      ...i,
      itemNama: itemNameMap[i.itemId] || "-",
    }));

    const totalNilai = items.reduce((sum, i) => sum + i.jumlahHarga, 0);

    results.push({
      ...r,
      totalNilai,
      items: enrichedItems,
    });
  }

  return NextResponse.json({ data: results });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !session.activeBidangId) {
    return NextResponse.json({ error: "Unauthorized / Bidang belum dipilih" }, { status: 401 });
  }

  const activeBidangId = session.activeBidangId;

  try {
    const body = await request.json();
    const {
      nomorDokumen,
      tanggal,
      vendorId,
      vendorNama,
      noFaktur,
      tglFaktur,
      noBa,
      tglBa,
      keterangan,
      items,
    } = body;

    if (!tanggal || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Tanggal dan rincian barang masuk wajib diisi" },
        { status: 400 }
      );
    }

    // Auto-generate document number if not provided
    let docNo = nomorDokumen?.trim();
    if (!docNo) {
      const year = String(tanggal).substring(0, 4);
      const countList = await db.query.receipts.findMany({
        where: eq(schema.receipts.bidangId, activeBidangId),
      });
      docNo = `RCV/${activeBidangId.toUpperCase().substring(0, 4)}/${year}/${String(countList.length + 1).padStart(4, "0")}`;
    }

    const receiptId = "rcv-" + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const now = Date.now();

    // 1. Insert Receipt Header
    await db.insert(schema.receipts).values({
      id: receiptId,
      bidangId: activeBidangId,
      nomorDokumen: docNo,
      tanggal,
      vendorId: vendorId || null,
      vendorNama: vendorNama || null,
      noFaktur: noFaktur || null,
      tglFaktur: tglFaktur || null,
      noBa: noBa || null,
      tglBa: tglBa || null,
      keterangan: keterangan || null,
      createdBy: session.nama,
      createdAt: now,
    });

    // 2. Insert Items & Create FIFO Layers
    for (const item of items as ReceiptItemInput[]) {
      const qty = Number(item.jumlah);
      const price = Number(item.hargaSatuan);
      if (!item.itemId || qty <= 0 || price < 0) continue;

      const receiptItemId = "rcvi-" + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
      const lineTotal = qty * price;

      await db.insert(schema.receiptItems).values({
        id: receiptItemId,
        receiptId,
        itemId: item.itemId,
        jumlah: qty,
        hargaSatuan: price,
        jumlahHarga: lineTotal,
      });

      // Create new FIFO layer for this batch
      const layerId = "layer-" + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
      await db.insert(schema.fifoLayers).values({
        id: layerId,
        bidangId: activeBidangId,
        itemId: item.itemId,
        receiptItemId,
        tanggal,
        hargaSatuan: price,
        jumlahAwal: qty,
        sisa: qty,
        status: "ACTIVE",
      });
    }

    await recordActivityLog({
      userId: session.id,
      userName: session.nama,
      userRole: session.role,
      bidangId: activeBidangId,
      action: "INPUT_MASUK",
      description: `Mencatat penerimaan ${items.length} jenis barang (${docNo}) dari vendor ${vendorNama || "-"}.`,
      metadata: { receiptId, nomorDokumen: docNo, vendorNama },
    });

    return NextResponse.json({ success: true, id: receiptId, nomorDokumen: docNo });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal menyimpan penerimaan barang";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
