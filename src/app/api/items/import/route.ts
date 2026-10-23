import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { DataError, errorResponse, newId, nextItemCode, withRetry } from "@/lib/inventory";
import { recordActivityLog } from "@/lib/activity-log";

interface ImportItemPayload {
  nama: string;
  satuan?: string;
  kategori?: string;
  stokMinimum?: number;
}

interface ImportSummary {
  total: number;
  added: number;
  skipped: number;
  addedNames: string[];
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || (!session.activeBidangId && !session.bidangId)) {
    return NextResponse.json({ error: "Unauthorized / Bidang belum dipilih" }, { status: 401 });
  }

  const activeBidangId =
    session.role === "SUPERADMIN"
      ? session.activeBidangId!
      : (session.bidangId || session.activeBidangId)!;

  try {
    const { items: rawItems } = await request.json();

    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return NextResponse.json(
        { error: "Daftar barang import kosong atau format salah." },
        { status: 400 }
      );
    }

    const result = await withRetry(() =>
      db.transaction(async (tx) => {
        const existingCategories = await tx.query.categories.findMany({
          where: eq(schema.categories.bidangId, activeBidangId),
        });
        const categoryMap: Record<string, string> = {};
        for (const c of existingCategories) {
          categoryMap[c.nama.trim().toLowerCase()] = c.id;
        }

        const existingUnits = await tx.query.units.findMany();
        const unitMap: Record<string, string> = {};
        for (const u of existingUnits) {
          unitMap[u.nama.trim().toLowerCase()] = u.id;
        }

        const existingItems = await tx.query.items.findMany({
          where: eq(schema.items.bidangId, activeBidangId),
          columns: { nama: true },
        });
        const existingNames = new Set(existingItems.map((i) => i.nama.trim().toLowerCase()));

        const currentBidang = await tx.query.bidang.findFirst({
          where: eq(schema.bidang.id, activeBidangId),
          columns: { kode: true },
        });
        const prefix = (currentBidang?.kode || "BRG").toUpperCase();

        // Nomor kode berlanjut dari kode terbesar yang sudah ada, bukan dari jumlah baris.
        let nextKode = await nextItemCode(tx, activeBidangId, prefix);
        let nextSeq = Number(nextKode.slice(prefix.length + 1)) || 1;

        const summary: ImportSummary = { total: rawItems.length, added: 0, skipped: 0, addedNames: [] };
        const now = Date.now();

        for (const raw of rawItems as ImportItemPayload[]) {
          const cleanNama = raw.nama?.trim();
          if (!cleanNama) continue;

          const normalized = cleanNama.toLowerCase();
          if (existingNames.has(normalized)) {
            summary.skipped++;
            continue;
          }

          // Pastikan kategori
          let kategoriId: string | null = null;
          if (raw.kategori && raw.kategori.trim()) {
            const catName = raw.kategori.trim();
            const catKey = catName.toLowerCase();
            if (!categoryMap[catKey]) {
              const newCatId = newId("ktg");
              await tx.insert(schema.categories).values({
                id: newCatId,
                bidangId: activeBidangId,
                nama: catName,
                createdAt: now,
              });
              categoryMap[catKey] = newCatId;
            }
            kategoriId = categoryMap[catKey];
          }

          // Pastikan satuan
          let satuanId: string | null = null;
          if (raw.satuan && raw.satuan.trim()) {
            const unitName = raw.satuan.trim().toLowerCase();
            if (!unitMap[unitName]) {
              const newUnitId = "unit-" + unitName.replace(/[^a-z0-9]/g, "-");
              await tx
                .insert(schema.units)
                .values({ id: newUnitId, nama: unitName, createdAt: now })
                .onConflictDoNothing();
              unitMap[unitName] = newUnitId;
            }
            satuanId = unitMap[unitName];
          }

          await tx.insert(schema.items).values({
            id: newId("item"),
            bidangId: activeBidangId,
            kode: nextKode,
            nama: cleanNama,
            kategoriId,
            satuanId,
            stokMinimum: Number(raw.stokMinimum) || 0,
            status: "ACTIVE",
            createdAt: now,
            updatedAt: now,
          });

          nextSeq += 1;
          nextKode = `${prefix}-${String(nextSeq).padStart(4, "0")}`;
          existingNames.add(normalized);
          summary.addedNames.push(cleanNama);
          summary.added++;
        }

        if (summary.added === 0 && summary.skipped === 0) {
          throw new DataError("Tidak ada baris nama barang yang terbaca dari data yang ditempel.");
        }

        return summary;
      })
    );

    await recordActivityLog({
      userId: session.id,
      userName: session.nama,
      userRole: session.role,
      bidangId: activeBidangId,
      action: "TAMBAH_BARANG",
      description: `Import master barang: ${result.added} barang ditambahkan, ${result.skipped} dilewati (nama sudah ada).`,
      metadata: {
        added: result.added,
        skipped: result.skipped,
        addedNames: result.addedNames.slice(0, 50),
      },
    });

    return NextResponse.json({
      success: true,
      total: result.total,
      added: result.added,
      skipped: result.skipped,
      addedNames: result.addedNames,
    });
  } catch (err: unknown) {
    return errorResponse(err);
  }
}
