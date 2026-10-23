import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db, schema } from "@/db";
import { eq, and, count, inArray } from "drizzle-orm";
import { recordActivityLog } from "@/lib/activity-log";
import { DataError, errorResponse, newId, nextItemCode, withRetry } from "@/lib/inventory";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || (!session.activeBidangId && !session.bidangId)) {
    return NextResponse.json({ error: "Unauthorized / Bidang belum dipilih" }, { status: 401 });
  }

  const isSuperAdmin = session.role === "SUPERADMIN";
  const { searchParams } = new URL(request.url);
  const requestedBidangId = searchParams.get("bidangId");

  let activeBidangId = session.activeBidangId;
  if (isSuperAdmin && requestedBidangId) {
    activeBidangId = requestedBidangId;
  } else if (!isSuperAdmin) {
    activeBidangId = session.bidangId || session.activeBidangId;
  }

  if (!activeBidangId) {
    return NextResponse.json({ error: "Bidang tidak valid" }, { status: 400 });
  }

  // 1. Fetch items
  const items = await db.query.items.findMany({
    where: eq(schema.items.bidangId, activeBidangId),
    orderBy: (i, { asc }) => [asc(i.nama)],
  });

  // 2. Fetch categories map
  const categoriesList = await db.query.categories.findMany({
    where: eq(schema.categories.bidangId, activeBidangId),
  });
  const categoryMap: Record<string, string> = {};
  for (const c of categoriesList) {
    categoryMap[c.id] = c.nama;
  }

  // 3. Fetch units map
  const unitsList = await db.query.units.findMany();
  const unitMap: Record<string, string> = {};
  for (const u of unitsList) {
    unitMap[u.id] = u.nama;
  }

  // 4. Fetch stock & valuation from FIFO layers
  const activeLayers = await db.query.fifoLayers.findMany({
    where: and(
      eq(schema.fifoLayers.bidangId, activeBidangId),
      eq(schema.fifoLayers.status, "ACTIVE")
    ),
  });

  const stockMap: Record<string, number> = {};
  const valueMap: Record<string, number> = {};

  for (const layer of activeLayers) {
    stockMap[layer.itemId] = (stockMap[layer.itemId] || 0) + layer.sisa;
    valueMap[layer.itemId] = (valueMap[layer.itemId] || 0) + layer.sisa * layer.hargaSatuan;
  }

  // 5. Harga beli terakhir per barang (tanpa dokumen penyesuaian stock opname).
  //    Dipakai form transaksi untuk mengisi harga satuan otomatis.
  const receiptList = await db.query.receipts.findMany({
    where: eq(schema.receipts.bidangId, activeBidangId),
    columns: { id: true, tanggal: true },
  });
  const adjustmentLinks = await db.query.stockAdjustments.findMany({
    where: eq(schema.stockAdjustments.bidangId, activeBidangId),
    columns: { receiptId: true },
  });
  const receiptPenyesuaian = new Set(
    adjustmentLinks.map((a) => a.receiptId).filter((id): id is string => Boolean(id))
  );
  const tanggalReceipt = new Map(receiptList.map((r) => [r.id, r.tanggal] as const));
  const receiptBeliIds = receiptList.filter((r) => !receiptPenyesuaian.has(r.id)).map((r) => r.id);
  const barisBeli = receiptBeliIds.length
    ? await db.query.receiptItems.findMany({
        where: inArray(schema.receiptItems.receiptId, receiptBeliIds),
        columns: { itemId: true, receiptId: true, hargaSatuan: true },
      })
    : [];

  const hargaTerakhirMap = new Map<string, { hargaSatuan: number; tanggal: string | null }>();
  for (const baris of barisBeli) {
    const tanggal = tanggalReceipt.get(baris.receiptId) ?? null;
    const tersimpan = hargaTerakhirMap.get(baris.itemId);
    if (!tersimpan || (tanggal && (!tersimpan.tanggal || tanggal >= tersimpan.tanggal))) {
      hargaTerakhirMap.set(baris.itemId, { hargaSatuan: baris.hargaSatuan, tanggal });
    }
  }

  const enrichedItems = items.map((item) => ({
    ...item,
    kategoriNama: item.kategoriId ? categoryMap[item.kategoriId] || "-" : "-",
    satuanNama: item.satuanId ? unitMap[item.satuanId] || "-" : "-",
    stok: stockMap[item.id] || 0,
    nilaiPersediaan: valueMap[item.id] || 0,
    hargaTerakhir: hargaTerakhirMap.get(item.id)?.hargaSatuan ?? null,
    hargaTerakhirTanggal: hargaTerakhirMap.get(item.id)?.tanggal ?? null,
  }));

  return NextResponse.json({ data: enrichedItems });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || (!session.activeBidangId && !session.bidangId)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const activeBidangId =
    session.role === "SUPERADMIN"
      ? session.activeBidangId!
      : (session.bidangId || session.activeBidangId)!;

  try {
    const body = await request.json();
    const { kode, nama, kategoriId, satuanId, stokMinimum } = body;

    if (!nama || !String(nama).trim()) {
      return NextResponse.json({ error: "Nama barang wajib diisi" }, { status: 400 });
    }

    const cleanNama = String(nama).trim();
    const manualKode = kode?.trim() || null;

    const createItem = () =>
      db.transaction(async (tx) => {
        const currentBidang = await tx.query.bidang.findFirst({
          where: eq(schema.bidang.id, activeBidangId),
          columns: { kode: true },
        });
        const prefix = (currentBidang?.kode || "BRG").toUpperCase();

        const itemKode = manualKode || (await nextItemCode(tx, activeBidangId, prefix));
        const id = newId("item");
        const now = Date.now();

        await tx.insert(schema.items).values({
          id,
          bidangId: activeBidangId,
          kode: itemKode,
          nama: cleanNama,
          kategoriId: kategoriId || null,
          satuanId: satuanId || null,
          stokMinimum: Number(stokMinimum) || 0,
          status: "ACTIVE",
          createdAt: now,
          updatedAt: now,
        });

        return { id, itemKode };
      });

    // Kode manual tidak perlu diulang: kalau bentrok, memang salah input.
    const created = manualKode ? await createItem() : await withRetry(createItem);

    await recordActivityLog({
      userId: session.id,
      userName: session.nama,
      userRole: session.role,
      bidangId: activeBidangId,
      action: "TAMBAH_BARANG",
      description: `Menambahkan master barang baru: "${cleanNama}" (${created.itemKode}).`,
      metadata: { itemId: created.id, kode: created.itemKode, nama: cleanNama },
    });

    return NextResponse.json({ success: true, id: created.id, kode: created.itemKode });
  } catch (err: unknown) {
    return errorResponse(err);
  }
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session || (!session.activeBidangId && !session.bidangId)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const activeBidangId =
    session.role === "SUPERADMIN"
      ? session.activeBidangId!
      : (session.bidangId || session.activeBidangId)!;

  try {
    const body = await request.json();
    const { id, kode, nama, kategoriId, satuanId, stokMinimum, status } = body;

    if (!id || !nama) {
      return NextResponse.json({ error: "ID dan Nama barang wajib diisi" }, { status: 400 });
    }

    const cleanNama = String(nama).trim();
    const cleanKode = kode ? String(kode).trim() : "";

    await db.transaction(async (tx) => {
      const existing = await tx.query.items.findFirst({
        where: and(eq(schema.items.id, id), eq(schema.items.bidangId, activeBidangId)),
      });
      if (!existing) {
        throw new DataError("Barang tidak ditemukan di unit kerja Anda", 404);
      }

      await tx
        .update(schema.items)
        .set({
          kode: cleanKode || existing.kode,
          nama: cleanNama,
          kategoriId: kategoriId || null,
          satuanId: satuanId || null,
          stokMinimum: Number(stokMinimum) || 0,
          status: status || "ACTIVE",
          updatedAt: Date.now(),
        })
        .where(and(eq(schema.items.id, id), eq(schema.items.bidangId, activeBidangId)));
    });

    await recordActivityLog({
      userId: session.id,
      userName: session.nama,
      userRole: session.role,
      bidangId: activeBidangId,
      action: "UBAH_BARANG",
      description: `Memperbarui master barang: "${cleanNama}" (${cleanKode || "-"}).`,
      metadata: { itemId: id, kode: cleanKode, nama: cleanNama },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return errorResponse(err);
  }
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session || (!session.activeBidangId && !session.bidangId)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const activeBidangId =
    session.role === "SUPERADMIN"
      ? session.activeBidangId!
      : (session.bidangId || session.activeBidangId)!;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID barang diperlukan" }, { status: 400 });

    const deleted = await db.transaction(async (tx) => {
      const existing = await tx.query.items.findFirst({
        where: and(eq(schema.items.id, id), eq(schema.items.bidangId, activeBidangId)),
      });
      if (!existing) {
        throw new DataError("Barang tidak ditemukan di unit kerja Anda", 404);
      }

      const [layerCount] = await tx
        .select({ count: count() })
        .from(schema.fifoLayers)
        .where(eq(schema.fifoLayers.itemId, id));

      if (layerCount && layerCount.count > 0) {
        throw new DataError(
          "Barang tidak dapat dihapus karena sudah memiliki riwayat persediaan/transaksi. Anda bisa mengubah statusnya menjadi NONAKTIF."
        );
      }

      await tx
        .delete(schema.items)
        .where(and(eq(schema.items.id, id), eq(schema.items.bidangId, activeBidangId)));

      return { nama: existing.nama, kode: existing.kode };
    });

    await recordActivityLog({
      userId: session.id,
      userName: session.nama,
      userRole: session.role,
      bidangId: activeBidangId,
      action: "HAPUS_BARANG",
      description: `Menghapus master barang "${deleted.nama}" (${deleted.kode}).`,
      metadata: { itemId: id, kode: deleted.kode },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return errorResponse(err);
  }
}
