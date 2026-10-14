import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db, schema } from "@/db";
import { eq, and, desc, asc } from "drizzle-orm";
import { recordActivityLog } from "@/lib/activity-log";

interface IssueItemInput {
  itemId: string;
  jumlah: number;
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || !session.activeBidangId) {
    return NextResponse.json({ error: "Unauthorized / Bidang belum dipilih" }, { status: 401 });
  }

  const issuesList = await db.query.issues.findMany({
    where: eq(schema.issues.bidangId, session.activeBidangId),
    orderBy: [desc(schema.issues.tanggal), desc(schema.issues.createdAt)],
  });

  const results = [];
  for (const iss of issuesList) {
    const items = await db.query.issueItems.findMany({
      where: eq(schema.issueItems.issueId, iss.id),
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

    const totalNilai = items.reduce((sum, i) => sum + i.totalNilaiFifo, 0);

    results.push({
      ...iss,
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
      tglPenyerahan,
      penerima,
      keperluan,
      keterangan,
      namaPenyerah,
      nipPenyerah,
      jabatanPenyerah,
      namaPenerima,
      nipPenerima,
      jabatanPenerima,
      items,
    } = body;

    if (!tanggal || !penerima || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Tanggal, Penerima, dan rincian barang keluar wajib diisi" },
        { status: 400 }
      );
    }

    // 1. Validate item ownership & stock availability
    for (const item of items as IssueItemInput[]) {
      const qty = Number(item.jumlah);
      if (!item.itemId || qty <= 0) continue;

      // Check if item belongs to this active bidang
      const itemBelongs = await db.query.items.findFirst({
        where: and(eq(schema.items.id, item.itemId), eq(schema.items.bidangId, activeBidangId)),
      });
      if (!itemBelongs) {
        return NextResponse.json(
          { error: "Barang tidak terdaftar di unit kerja Anda. Unit kerja lain tidak dapat mengeluarkan barang ini." },
          { status: 403 }
        );
      }

      const activeLayers = await db.query.fifoLayers.findMany({
        where: and(
          eq(schema.fifoLayers.bidangId, activeBidangId),
          eq(schema.fifoLayers.itemId, item.itemId),
          eq(schema.fifoLayers.status, "ACTIVE")
        ),
      });

      const totalStock = activeLayers.reduce((s, l) => s + l.sisa, 0);
      if (totalStock < qty) {
        const itemInfo = await db.query.items.findFirst({
          where: eq(schema.items.id, item.itemId),
        });
        const name = itemInfo ? itemInfo.nama : "Barang";
        return NextResponse.json(
          {
            error: `Stok "${name}" tidak mencukupi. Tersedia: ${totalStock}, Diminta: ${qty}.`,
          },
          { status: 400 }
        );
      }
    }

    // Auto-generate document number if not provided
    let docNo = nomorDokumen?.trim();
    if (!docNo) {
      const year = String(tanggal).substring(0, 4);
      const countList = await db.query.issues.findMany({
        where: eq(schema.issues.bidangId, activeBidangId),
      });
      docNo = `BAST/${activeBidangId.toUpperCase().substring(0, 4)}/${year}/${String(countList.length + 1).padStart(4, "0")}`;
    }

    const issueId = "iss-" + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const now = Date.now();

    const currentBidang = await db.query.bidang.findFirst({
      where: eq(schema.bidang.id, activeBidangId),
    });
    const finalNamaPenyerah = currentBidang?.namaPengurus || namaPenyerah || session.nama;
    const finalNipPenyerah = currentBidang?.nipPengurus || nipPenyerah;
    const finalJabatanPenyerah = currentBidang?.jabatanPengurus || jabatanPenyerah || "Pengurus Barang";

    // 2. Insert Header
    await db.insert(schema.issues).values({
      id: issueId,
      bidangId: activeBidangId,
      nomorDokumen: docNo,
      tanggal,
      tglPenyerahan: tglPenyerahan || tanggal,
      penerima: String(penerima).trim(),
      keperluan: keperluan || null,
      keterangan: keterangan || null,
      namaPenyerah: finalNamaPenyerah,
      nipPenyerah: finalNipPenyerah,
      jabatanPenyerah: finalJabatanPenyerah,
      namaPenerima: namaPenerima || null,
      nipPenerima: nipPenerima || null,
      jabatanPenerima: jabatanPenerima || null,
      createdBy: session.nama,
      createdAt: now,
    });

    // 3. Process FIFO deduction for each item
    for (const item of items as IssueItemInput[]) {
      const requestedQty = Number(item.jumlah);
      if (!item.itemId || requestedQty <= 0) continue;

      const issueItemId = "issi-" + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);

      // Fetch layers ordered oldest to newest
      const activeLayers = await db.query.fifoLayers.findMany({
        where: and(
          eq(schema.fifoLayers.bidangId, activeBidangId),
          eq(schema.fifoLayers.itemId, item.itemId),
          eq(schema.fifoLayers.status, "ACTIVE")
        ),
        orderBy: [asc(schema.fifoLayers.tanggal), asc(schema.fifoLayers.id)],
      });

      let remainingNeed = requestedQty;
      let totalItemFifoValue = 0;

      for (const layer of activeLayers) {
        if (remainingNeed <= 0) break;

        const take = Math.min(layer.sisa, remainingNeed);
        const layerValue = take * layer.hargaSatuan;
        totalItemFifoValue += layerValue;
        const newSisa = layer.sisa - take;
        const newStatus = newSisa <= 0 ? "EXHAUSTED" : "ACTIVE";

        // Update Layer
        await db
          .update(schema.fifoLayers)
          .set({ sisa: newSisa, status: newStatus })
          .where(eq(schema.fifoLayers.id, layer.id));

        // Insert Usage
        const usageId = "usg-" + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
        await db.insert(schema.fifoUsages).values({
          id: usageId,
          issueItemId,
          fifoLayerId: layer.id,
          jumlah: take,
          hargaSatuan: layer.hargaSatuan,
          nilai: layerValue,
        });

        remainingNeed -= take;
      }

      // Insert Issue Item
      await db.insert(schema.issueItems).values({
        id: issueItemId,
        issueId,
        itemId: item.itemId,
        jumlah: requestedQty,
        totalNilaiFifo: totalItemFifoValue,
      });
    }
    await recordActivityLog({
      userId: session.id,
      userName: session.nama,
      userRole: session.role,
      bidangId: activeBidangId,
      action: "INPUT_KELUAR",
      description: `Menerbitkan BAST pengeluaran barang (${docNo}) kepada ${penerima} sejumlah ${items.length} jenis item.`,
      metadata: { issueId, nomorDokumen: docNo, penerima },
    });

    return NextResponse.json({ success: true, id: issueId, nomorDokumen: docNo });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal menyimpan pengeluaran barang";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
