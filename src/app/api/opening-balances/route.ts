import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db, schema } from "@/db";
import { and, asc, eq } from "drizzle-orm";
import { recordActivityLog } from "@/lib/activity-log";
import {
  DataError,
  errorResponse,
  insertStockLayer,
  newId,
  sanitizeBidangKode,
  withRetry,
  createItemResolver,
  resolveOrCreateItem,
} from "@/lib/inventory";

interface OpeningRowInput {
  itemId?: string;
  nama?: string;
  satuan?: string;
  kategori?: string;
  jumlah: number;
  hargaSatuan: number;
}

function isDateLike(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

async function requireSuperadminBidang() {
  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (session.role !== "SUPERADMIN") {
    return {
      error: NextResponse.json(
        { error: "Hanya Superadmin yang berwenang menetapkan saldo awal persediaan." },
        { status: 403 }
      ),
    };
  }
  const activeBidangId = session.activeBidangId || session.bidangId;
  if (!activeBidangId) {
    return { error: NextResponse.json({ error: "Bidang belum dipilih" }, { status: 400 }) };
  }
  return { session, activeBidangId };
}

export async function GET() {
  const session = await getSession();
  if (!session || (!session.activeBidangId && !session.bidangId)) {
    return NextResponse.json({ error: "Unauthorized / Bidang belum dipilih" }, { status: 401 });
  }

  const activeBidangId =
    session.role === "SUPERADMIN"
      ? session.activeBidangId!
      : (session.bidangId || session.activeBidangId)!;

  const rows = await db.query.openingBalances.findMany({
    where: eq(schema.openingBalances.bidangId, activeBidangId),
    orderBy: [asc(schema.openingBalances.tanggal), asc(schema.openingBalances.createdAt)],
  });

  const itemIds = [...new Set(rows.map((r) => r.itemId))];
  const items = itemIds.length
    ? await db.query.items.findMany({
        where: (t, { inArray }) => inArray(t.id, itemIds),
        columns: { id: true, kode: true, nama: true, satuanId: true, kategoriId: true },
      })
    : [];
  const itemMap = new Map(items.map((i) => [i.id, i]));

  const categories = await db.query.categories.findMany({
    where: eq(schema.categories.bidangId, activeBidangId),
    columns: { id: true, nama: true },
  });
  const categoryMap = new Map(categories.map((c) => [c.id, c.nama]));
  const units = await db.query.units.findMany({ columns: { id: true, nama: true } });
  const unitMap = new Map(units.map((u) => [u.id, u.nama]));

  const data = rows.map((r) => {
    const item = itemMap.get(r.itemId);
    return {
      ...r,
      nilai: r.jumlah * r.hargaSatuan,
      kode: item?.kode || "-",
      nama: item?.nama || "(barang terhapus)",
      satuan: item?.satuanId ? unitMap.get(item.satuanId) || "-" : "-",
      kategori: item?.kategoriId ? categoryMap.get(item.kategoriId) || "-" : "-",
    };
  });

  const tanggalList = [...new Set(rows.map((r) => r.tanggal))].sort();

  return NextResponse.json({
    data,
    summary: {
      baris: rows.length,
      totalNilai: rows.reduce((s, r) => s + r.jumlah * r.hargaSatuan, 0),
      tanggal: tanggalList,
    },
  });
}

export async function POST(request: Request) {
  const guard = await requireSuperadminBidang();
  if (guard.error) return guard.error;
  const { session, activeBidangId } = guard;

  try {
    const body = await request.json();
    const { tanggal, keterangan, rows } = body as {
      tanggal?: string;
      keterangan?: string;
      rows?: OpeningRowInput[];
    };

    if (!isDateLike(tanggal)) {
      return NextResponse.json(
        { error: "Tanggal berlakunya saldo awal wajib diisi (format YYYY-MM-DD)." },
        { status: 400 }
      );
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "Daftar saldo awal kosong atau format salah." }, { status: 400 });
    }

    const bidangRow = await db.query.bidang.findFirst({
      where: eq(schema.bidang.id, activeBidangId),
      columns: { kode: true },
    });
    const bidangKode = sanitizeBidangKode(bidangRow?.kode);

    const result = await withRetry(() =>
      db.transaction(async (tx) => {
        const resolver = await createItemResolver(tx, activeBidangId, bidangKode);
        const existing = await tx.query.openingBalances.findMany({
          where: and(
            eq(schema.openingBalances.bidangId, activeBidangId),
            eq(schema.openingBalances.tanggal, tanggal)
          ),
          columns: { itemId: true },
        });
        const alreadyHasBaseline = new Set(existing.map((e) => e.itemId));

        const skippedNames: string[] = [];
        const invalidNames: string[] = [];
        let created = 0;
        let totalNilai = 0;
        const now = Date.now();

        for (const raw of rows) {
          const jumlah = Number(raw.jumlah);
          const hargaSatuan = Number(raw.hargaSatuan);
          const label = (raw.nama || "").trim() || raw.itemId || "(tanpa nama)";

          if (!Number.isFinite(jumlah) || jumlah <= 0 || !Number.isFinite(hargaSatuan) || hargaSatuan < 0) {
            invalidNames.push(label);
            continue;
          }

          let itemId = raw.itemId?.trim() || "";
          if (itemId) {
            const owned = await tx.query.items.findFirst({
              where: and(eq(schema.items.id, itemId), eq(schema.items.bidangId, activeBidangId)),
              columns: { id: true },
            });
            if (!owned) {
              invalidNames.push(label);
              continue;
            }
          } else {
            if (!raw.nama?.trim()) {
              invalidNames.push(label);
              continue;
            }
            itemId = await resolveOrCreateItem(tx, resolver, {
              nama: raw.nama,
              satuan: raw.satuan,
              kategori: raw.kategori,
            });
          }

          if (alreadyHasBaseline.has(itemId)) {
            skippedNames.push(label);
            continue;
          }

          const layerId = await insertStockLayer(tx, {
            bidangId: activeBidangId,
            itemId,
            tanggal,
            jumlah,
            hargaSatuan,
          });

          await tx.insert(schema.openingBalances).values({
            id: newId("ob"),
            bidangId: activeBidangId,
            itemId,
            tanggal,
            jumlah,
            hargaSatuan,
            keterangan: keterangan?.trim() || null,
            fifoLayerId: layerId,
            createdBy: session.nama,
            createdAt: now,
          });

          alreadyHasBaseline.add(itemId);
          created++;
          totalNilai += jumlah * hargaSatuan;
        }

        if (created === 0 && skippedNames.length === 0 && invalidNames.length === 0) {
          throw new DataError("Tidak ada baris saldo awal yang terbaca dari data yang ditempel.");
        }

        return {
          created,
          skipped: skippedNames.length,
          invalid: invalidNames.length,
          itemsCreated: resolver.createdItems,
          totalNilai,
          skippedNames: skippedNames.slice(0, 30),
          invalidNames: invalidNames.slice(0, 30),
        };
      })
    );

    await recordActivityLog({
      userId: session.id,
      userName: session.nama,
      userRole: session.role,
      bidangId: activeBidangId,
      action: "UBAH_PENGATURAN",
      description: `Menetapkan saldo awal persediaan per ${tanggal}: ${result.created} barang (Rp${result.totalNilai.toLocaleString("id-ID")}), ${result.skipped} dilewati.`,
      metadata: {
        tanggal,
        created: result.created,
        skipped: result.skipped,
        itemsCreated: result.itemsCreated,
      },
    });

    return NextResponse.json({ success: true, ...result, tanggal });
  } catch (err: unknown) {
    return errorResponse(err);
  }
}

export async function PUT(request: Request) {
  const guard = await requireSuperadminBidang();
  if (guard.error) return guard.error;
  const { session, activeBidangId } = guard;

  try {
    const body = await request.json();
    const { id, jumlah, hargaSatuan, keterangan, tanggal } = body as {
      id?: string;
      jumlah?: number;
      hargaSatuan?: number;
      keterangan?: string;
      tanggal?: string;
    };

    if (!id) return NextResponse.json({ error: "ID saldo awal wajib diisi" }, { status: 400 });

    const newJumlah = Number(jumlah);
    const newHarga = Number(hargaSatuan);
    if (!Number.isFinite(newJumlah) || newJumlah <= 0 || !Number.isFinite(newHarga) || newHarga < 0) {
      return NextResponse.json({ error: "Jumlah dan harga satuan harus berupa angka yang sah." }, { status: 400 });
    }
    if (tanggal !== undefined && !isDateLike(tanggal)) {
      return NextResponse.json({ error: "Tanggal tidak sah (format YYYY-MM-DD)." }, { status: 400 });
    }

    await db.transaction(async (tx) => {
      const baseline = await tx.query.openingBalances.findFirst({
        where: and(eq(schema.openingBalances.id, id), eq(schema.openingBalances.bidangId, activeBidangId)),
      });
      if (!baseline) throw new DataError("Saldo awal tidak ditemukan", 404);

      const layer = baseline.fifoLayerId
        ? await tx.query.fifoLayers.findFirst({ where: eq(schema.fifoLayers.id, baseline.fifoLayerId) })
        : undefined;

      if (layer) {
        const usages = await tx.query.fifoUsages.findMany({
          where: eq(schema.fifoUsages.fifoLayerId, layer.id),
          columns: { id: true },
        });
        const touched = layer.sisa < layer.jumlahAwal || usages.length > 0;
        if (touched) {
          throw new DataError(
            "Saldo awal ini tidak dapat diubah karena stoknya sudah bergerak (ada BAST/penyesuaian yang memakainya). Batalkan transaksi tersebut lebih dahulu."
          );
        }
        await tx
          .update(schema.fifoLayers)
          .set({
            tanggal: tanggal || layer.tanggal,
            jumlahAwal: newJumlah,
            sisa: newJumlah,
            hargaSatuan: newHarga,
            status: "ACTIVE",
          })
          .where(eq(schema.fifoLayers.id, layer.id));
      }

      await tx
        .update(schema.openingBalances)
        .set({
          tanggal: tanggal || baseline.tanggal,
          jumlah: newJumlah,
          hargaSatuan: newHarga,
          keterangan: keterangan !== undefined ? keterangan || null : baseline.keterangan,
        })
        .where(eq(schema.openingBalances.id, id));
    });

    await recordActivityLog({
      userId: session.id,
      userName: session.nama,
      userRole: session.role,
      bidangId: activeBidangId,
      action: "UBAH_PENGATURAN",
      description: `Mengubah saldo awal persediaan (ID ${id}).`,
      metadata: { openingBalanceId: id, jumlah: newJumlah, hargaSatuan: newHarga, tanggal: tanggal || null },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return errorResponse(err);
  }
}

export async function DELETE(request: Request) {
  const guard = await requireSuperadminBidang();
  if (guard.error) return guard.error;
  const { session, activeBidangId } = guard;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID saldo awal diperlukan" }, { status: 400 });

    const removed = await db.transaction(async (tx) => {
      const baseline = await tx.query.openingBalances.findFirst({
        where: and(eq(schema.openingBalances.id, id), eq(schema.openingBalances.bidangId, activeBidangId)),
      });
      if (!baseline) throw new DataError("Saldo awal tidak ditemukan", 404);

      const layer = baseline.fifoLayerId
        ? await tx.query.fifoLayers.findFirst({ where: eq(schema.fifoLayers.id, baseline.fifoLayerId) })
        : undefined;

      if (layer) {
        const usages = await tx.query.fifoUsages.findMany({
          where: eq(schema.fifoUsages.fifoLayerId, layer.id),
          columns: { id: true },
        });
        if (layer.sisa < layer.jumlahAwal || usages.length > 0) {
          throw new DataError(
            "Saldo awal ini tidak dapat dihapus karena stoknya sudah terpakai pada transaksi BAST/penyesuaian."
          );
        }
        await tx.delete(schema.fifoLayers).where(eq(schema.fifoLayers.id, layer.id));
      }

      await tx.delete(schema.openingBalances).where(eq(schema.openingBalances.id, id));
      return { tanggal: baseline.tanggal, jumlah: baseline.jumlah, hargaSatuan: baseline.hargaSatuan };
    });

    await recordActivityLog({
      userId: session.id,
      userName: session.nama,
      userRole: session.role,
      bidangId: activeBidangId,
      action: "UBAH_PENGATURAN",
      description: `Menghapus satu baris saldo awal persediaan (${removed.tanggal}).`,
      metadata: { openingBalanceId: id, tanggal: removed.tanggal },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return errorResponse(err);
  }
}
