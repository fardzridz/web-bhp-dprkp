import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db, schema } from "@/db";
import { eq, and } from "drizzle-orm";

interface ImportItemPayload {
  nama: string;
  satuan?: string;
  kategori?: string;
  stokMinimum?: number;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !session.activeBidangId) {
    return NextResponse.json({ error: "Unauthorized / Bidang belum dipilih" }, { status: 401 });
  }

  const activeBidangId = session.activeBidangId;

  try {
    const { items: rawItems } = await request.json();

    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return NextResponse.json(
        { error: "Daftar barang import kosong atau format salah." },
        { status: 400 }
      );
    }

    // Existing categories for this bidang
    const existingCategories = await db.query.categories.findMany({
      where: eq(schema.categories.bidangId, activeBidangId),
    });
    const categoryMap: Record<string, string> = {};
    for (const c of existingCategories) {
      categoryMap[c.nama.trim().toLowerCase()] = c.id;
    }

    // Existing units
    const existingUnits = await db.query.units.findMany();
    const unitMap: Record<string, string> = {};
    for (const u of existingUnits) {
      unitMap[u.nama.trim().toLowerCase()] = u.id;
    }

    // Existing items in this bidang
    const existingItems = await db.query.items.findMany({
      where: eq(schema.items.bidangId, activeBidangId),
    });
    const itemMap: Record<string, true> = {};
    for (const i of existingItems) {
      itemMap[i.nama.trim().toLowerCase()] = true;
    }

    let addedCount = 0;
    let skippedCount = 0;
    let nextNum = existingItems.length + 1;
    const now = Date.now();

    for (const raw of rawItems as ImportItemPayload[]) {
      const cleanNama = raw.nama?.trim();
      if (!cleanNama) continue;

      const normalized = cleanNama.toLowerCase();
      if (itemMap[normalized]) {
        skippedCount++;
        continue;
      }

      // Ensure Category
      let kategoriId: string | null = null;
      if (raw.kategori && raw.kategori.trim()) {
        const catName = raw.kategori.trim();
        const catKey = catName.toLowerCase();
        if (!categoryMap[catKey]) {
          const newCatId = "ktg-" + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
          await db.insert(schema.categories).values({
            id: newCatId,
            bidangId: activeBidangId,
            nama: catName,
            createdAt: now,
          });
          categoryMap[catKey] = newCatId;
        }
        kategoriId = categoryMap[catKey];
      }

      // Ensure Unit
      let satuanId: string | null = null;
      if (raw.satuan && raw.satuan.trim()) {
        const unitName = raw.satuan.trim().toLowerCase();
        if (!unitMap[unitName]) {
          const newUnitId = "unit-" + unitName.replace(/[^a-z0-9]/g, "-");
          await db
            .insert(schema.units)
            .values({
              id: newUnitId,
              nama: unitName,
              createdAt: now,
            })
            .onConflictDoNothing();
          unitMap[unitName] = newUnitId;
        }
        satuanId = unitMap[unitName];
      }

      const itemId = "item-" + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
      const itemKode = `BRG-${String(nextNum++).padStart(4, "0")}`;

      await db.insert(schema.items).values({
        id: itemId,
        bidangId: activeBidangId,
        kode: itemKode,
        nama: cleanNama,
        kategoriId,
        satuanId,
        stokMinimum: Number(raw.stokMinimum) || 0,
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now,
      });

      itemMap[normalized] = true;
      addedCount++;
    }

    return NextResponse.json({
      success: true,
      total: rawItems.length,
      added: addedCount,
      skipped: skippedCount,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal import barang";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
