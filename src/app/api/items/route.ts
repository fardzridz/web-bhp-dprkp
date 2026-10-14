import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db, schema } from "@/db";
import { eq, and, desc, count } from "drizzle-orm";
import { recordActivityLog } from "@/lib/activity-log";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || !session.activeBidangId) {
    return NextResponse.json({ error: "Unauthorized / Bidang belum dipilih" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const requestedBidangId = searchParams.get("bidangId");
  const activeBidangId = requestedBidangId || session.activeBidangId;

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

  const enrichedItems = items.map((item) => ({
    ...item,
    kategoriNama: item.kategoriId ? categoryMap[item.kategoriId] || "-" : "-",
    satuanNama: item.satuanId ? unitMap[item.satuanId] || "-" : "-",
    stok: stockMap[item.id] || 0,
    nilaiPersediaan: valueMap[item.id] || 0,
  }));

  return NextResponse.json({ data: enrichedItems });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !session.activeBidangId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { kode, nama, kategoriId, satuanId, stokMinimum } = body;

    if (!nama || !nama.trim()) {
      return NextResponse.json({ error: "Nama barang wajib diisi" }, { status: 400 });
    }

    const activeBidangId = session.activeBidangId;

    // Get active bidang to use its specific code prefix
    const currentBidang = await db.query.bidang.findFirst({
      where: eq(schema.bidang.id, activeBidangId),
    });
    const prefix = currentBidang?.kode ? currentBidang.kode.toUpperCase() : "BRG";

    // Generate kode if not provided
    let itemKode = kode?.trim();
    if (!itemKode) {
      const existingItems = await db.query.items.findMany({
        where: eq(schema.items.bidangId, activeBidangId),
      });
      const nextNumber = existingItems.length + 1;
      itemKode = `${prefix}-${String(nextNumber).padStart(4, "0")}`;
    }

    const id = "item-" + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const now = Date.now();

    await db.insert(schema.items).values({
      id,
      bidangId: activeBidangId,
      kode: itemKode,
      nama: String(nama).trim(),
      kategoriId: kategoriId || null,
      satuanId: satuanId || null,
      stokMinimum: Number(stokMinimum) || 0,
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
    });
    await recordActivityLog({
      userId: session.id,
      userName: session.nama,
      userRole: session.role,
      bidangId: activeBidangId,
      action: "TAMBAH_BARANG",
      description: `Menambahkan master barang baru: "${nama}" (${itemKode}).`,
      metadata: { itemId: id, kode: itemKode, nama },
    });

    return NextResponse.json({ success: true, id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal menambah master barang";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session || !session.activeBidangId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, kode, nama, kategoriId, satuanId, stokMinimum, status } = body;

    if (!id || !nama) {
      return NextResponse.json({ error: "ID dan Nama barang wajib diisi" }, { status: 400 });
    }

    await db
      .update(schema.items)
      .set({
        kode: String(kode).trim(),
        nama: String(nama).trim(),
        kategoriId: kategoriId || null,
        satuanId: satuanId || null,
        stokMinimum: Number(stokMinimum) || 0,
        status: status || "ACTIVE",
        updatedAt: Date.now(),
      })
      .where(and(eq(schema.items.id, id), eq(schema.items.bidangId, session.activeBidangId)));
    await recordActivityLog({
      userId: session.id,
      userName: session.nama,
      userRole: session.role,
      bidangId: session.activeBidangId,
      action: "UBAH_BARANG",
      description: `Memperbarui master barang: "${nama}" (${kode}).`,
      metadata: { itemId: id, kode, nama },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal memperbarui barang";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session || !session.activeBidangId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID barang diperlukan" }, { status: 400 });

    // Check if item has FIFO layers or transactions
    const [layerCount] = await db
      .select({ count: count() })
      .from(schema.fifoLayers)
      .where(eq(schema.fifoLayers.itemId, id));

    if (layerCount && layerCount.count > 0) {
      return NextResponse.json(
        { error: "Barang tidak dapat dihapus karena sudah memiliki riwayat persediaan/transaksi. Anda bisa mengubah statusnya menjadi NONAKTIF." },
        { status: 400 }
      );
    }

    await db
      .delete(schema.items)
      .where(and(eq(schema.items.id, id), eq(schema.items.bidangId, session.activeBidangId)));
    await recordActivityLog({
      userId: session.id,
      userName: session.nama,
      userRole: session.role,
      bidangId: session.activeBidangId,
      action: "HAPUS_BARANG",
      description: `Menghapus master barang ID: ${id}.`,
      metadata: { itemId: id },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal menghapus barang";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
