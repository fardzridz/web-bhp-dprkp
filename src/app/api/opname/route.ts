import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db, schema } from "@/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import { recordActivityLog } from "@/lib/activity-log";
import {
  DataError,
  assertItemsBelongToBidang,
  deductFifo,
  errorResponse,
  insertStockLayer,
  newId,
  nextAdjustmentNumber,
  restoreFifoUsages,
  sanitizeBidangKode,
  withRetry,
} from "@/lib/inventory";
import { averageUnitValue } from "@/lib/stock";
import { computeStockAsOf } from "./stock-as-of";

interface OpnameRowInput {
  itemId: string;
  jumlahFisik: number;
  kondisi?: string;
  keterangan?: string;
  hargaSatuan?: number;
}

const KONDISI_DEFAULT = "Baik";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || (!session.activeBidangId && !session.bidangId)) {
    return NextResponse.json({ error: "Unauthorized / Bidang belum dipilih" }, { status: 401 });
  }

  // Paket cetak hanya boleh meminta bidang lain bila pengguna Superadmin.
  const bidangDiminta = new URL(request.url).searchParams.get("bidangId");
  const activeBidangId =
    session.role === "SUPERADMIN"
      ? (bidangDiminta || session.activeBidangId!)
      : (session.bidangId || session.activeBidangId)!;

  const adjustments = await db.query.stockAdjustments.findMany({
    where: eq(schema.stockAdjustments.bidangId, activeBidangId),
    orderBy: [desc(schema.stockAdjustments.tanggal), desc(schema.stockAdjustments.createdAt)],
  });

  const adjustmentIds = adjustments.map((a) => a.id);
  const itemRows = adjustmentIds.length
    ? await db.query.stockAdjustmentItems.findMany({
        where: inArray(schema.stockAdjustmentItems.adjustmentId, adjustmentIds),
      })
    : [];

  const referencedItemIds = [...new Set(itemRows.map((r) => r.itemId))];
  const items = referencedItemIds.length
    ? await db.query.items.findMany({
        where: inArray(schema.items.id, referencedItemIds),
        columns: { id: true, kode: true, nama: true, kategoriId: true, satuanId: true },
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

  const data = adjustments.map((a) => {
    const rows = itemRows.filter((r) => r.adjustmentId === a.id);
    return {
      ...a,
      posted: Boolean(a.issueId || a.receiptId),
      totalSelisihNilai: rows.reduce((s, r) => s + r.selisihNilai, 0),
      totalNilaiFisik: rows.reduce((s, r) => s + r.nilaiFisik, 0),
      jumlahBarisSelisih: rows.filter((r) => Math.abs(r.selisihJumlah) > 1e-9).length,
      items: rows.map((r) => {
        const item = itemMap.get(r.itemId);
        return {
          ...r,
          kode: item?.kode || "-",
          nama: item?.nama || "(barang terhapus)",
          kategori: item?.kategoriId ? categoryMap.get(item.kategoriId) || "Tanpa Kategori" : "Tanpa Kategori",
          satuan: item?.satuanId ? unitMap.get(item.satuanId) || "-" : "-",
        };
      }),
    };
  });

  return NextResponse.json({ data });
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
    const body = await request.json();
    const { tanggal, keterangan, posting, rows, nomorBa, tanggalBa } = body as {
      tanggal?: string;
      keterangan?: string;
      posting?: boolean;
      rows?: OpnameRowInput[];
      nomorBa?: string;
      tanggalBa?: string;
    };

    if (!tanggal || !/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
      return NextResponse.json({ error: "Tanggal opname wajib diisi (format YYYY-MM-DD)." }, { status: 400 });
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "Belum ada baris hasil hitung fisik." }, { status: 400 });
    }

    const cleanRows: Array<OpnameRowInput & { jumlahFisik: number }> = [];
    const seen = new Set<string>();
    for (const raw of rows) {
      const itemId = typeof raw?.itemId === "string" ? raw.itemId.trim() : "";
      const jumlahFisik = Number(raw?.jumlahFisik);
      if (!itemId || !Number.isFinite(jumlahFisik) || jumlahFisik < 0) continue;
      if (seen.has(itemId)) {
        throw new DataError("Ada barang yang tercatat lebih dari satu kali pada hasil opname.");
      }
      seen.add(itemId);
      cleanRows.push({ ...raw, itemId, jumlahFisik });
    }
    if (cleanRows.length === 0) {
      return NextResponse.json({ error: "Tidak ada baris hasil hitung fisik yang valid." }, { status: 400 });
    }

    const postingOpname = posting !== false;
    const bidangRow = await db.query.bidang.findFirst({
      where: eq(schema.bidang.id, activeBidangId),
      columns: { kode: true },
    });
    const bidangKode = sanitizeBidangKode(bidangRow?.kode);

    const result = await withRetry(() =>
      db.transaction(async (tx) => {
        const itemIds = cleanRows.map((r) => r.itemId);
        await assertItemsBelongToBidang(tx, activeBidangId, itemIds);

        const summaries = await computeStockAsOf(tx, activeBidangId, tanggal, itemIds);

        const nomorDokumen = await nextAdjustmentNumber(
          tx,
          activeBidangId,
          bidangKode,
          tanggal.substring(0, 4)
        );
        const adjustmentId = newId("adj");
        const now = Date.now();

        await tx.insert(schema.stockAdjustments).values({
          id: adjustmentId,
          bidangId: activeBidangId,
          nomorDokumen,
          nomorBa: typeof nomorBa === "string" && nomorBa.trim() ? nomorBa.trim() : null,
          tanggalBa: typeof tanggalBa === "string" && tanggalBa.trim() ? tanggalBa.trim() : null,
          tanggal,
          keterangan: keterangan?.trim() || null,
          createdBy: session.nama,
          createdAt: now,
        });

        interface Prepared {
          itemId: string;
          stokSistem: number;
          nilaiSistem: number;
          hargaSatuanSistem: number;
          jumlahFisik: number;
          nilaiFisik: number;
          selisihJumlah: number;
          selisihNilai: number;
          kondisi: string;
          keterangan: string | null;
          hargaSatuanPakai: number;
        }

        const prepared: Prepared[] = [];
        for (const row of cleanRows) {
          const summary = summaries.get(row.itemId);
          const stokSistem = summary?.closingQty ?? 0;
          const nilaiSistem = summary?.closingValue ?? 0;
          const hargaSatuanSistem = averageUnitValue(stokSistem, nilaiSistem);
          const selisihJumlah = row.jumlahFisik - stokSistem;
          const hargaPakai =
            hargaSatuanSistem > 0 ? hargaSatuanSistem : Number(row.hargaSatuan) || 0;

          if (postingOpname && selisihJumlah > 0 && hargaPakai <= 0) {
            const item = await tx.query.items.findFirst({
              where: eq(schema.items.id, row.itemId),
              columns: { nama: true },
            });
            throw new DataError(
              `Barang "${item?.nama || row.itemId}" belum punya nilai persediaan, jadi harga satuannya wajib diisi untuk mencatat penambahan dari opname.`
            );
          }

          const nilaiFisik = row.jumlahFisik * hargaPakai;

          prepared.push({
            itemId: row.itemId,
            stokSistem,
            nilaiSistem,
            hargaSatuanSistem,
            jumlahFisik: row.jumlahFisik,
            nilaiFisik,
            selisihJumlah,
            selisihNilai: nilaiFisik - nilaiSistem,
            kondisi: row.kondisi?.trim() || KONDISI_DEFAULT,
            keterangan: row.keterangan?.trim() || null,
            hargaSatuanPakai: hargaPakai,
          });
        }

        for (const p of prepared) {
          await tx.insert(schema.stockAdjustmentItems).values({
            id: newId("adji"),
            adjustmentId,
            itemId: p.itemId,
            stokSistem: p.stokSistem,
            nilaiSistem: p.nilaiSistem,
            hargaSatuanSistem: p.hargaSatuanSistem,
            jumlahFisik: p.jumlahFisik,
            nilaiFisik: p.nilaiFisik,
            selisihJumlah: p.selisihJumlah,
            selisihNilai: p.selisihNilai,
            kondisi: p.kondisi,
            keterangan: p.keterangan,
          });
        }

        const kurang = prepared.filter((p) => p.selisihJumlah < -1e-9);
        const lebih = prepared.filter((p) => p.selisihJumlah > 1e-9);
        let issueId: string | null = null;
        let receiptId: string | null = null;

        if (postingOpname && kurang.length > 0) {
          const currentBidang = await tx.query.bidang.findFirst({
            where: eq(schema.bidang.id, activeBidangId),
          });
          issueId = newId("iss");
          await tx.insert(schema.issues).values({
            id: issueId,
            bidangId: activeBidangId,
            jenis: "PENYESUAIAN",
            nomorDokumen,
            tanggal,
            tglPenyerahan: tanggal,
            penerima: "Penyesuaian Stock Opname",
            keperluan: keterangan?.trim() || "Koreksi hasil stock opname",
            keterangan: `Pengurangan hasil stock opname ${nomorDokumen}`,
            namaPenyerah: currentBidang?.namaPengurus || session.nama,
            nipPenyerah: currentBidang?.nipPengurus || null,
            jabatanPenyerah: currentBidang?.jabatanPengurus || "Pengurus Barang",
            createdBy: session.nama,
            createdAt: now,
          });

          for (const p of kurang) {
            const issueItemId = newId("issi");
            const jumlahKurang = Math.abs(p.selisihJumlah);
            await tx.insert(schema.issueItems).values({
              id: issueItemId,
              issueId,
              itemId: p.itemId,
              jumlah: jumlahKurang,
              totalNilaiFifo: 0,
            });
            const { usageRows, totalValue } = await deductFifo(tx, {
              bidangId: activeBidangId,
              itemId: p.itemId,
              qty: jumlahKurang,
              issueItemId,
            });
            await tx
              .update(schema.issueItems)
              .set({ totalNilaiFifo: totalValue })
              .where(eq(schema.issueItems.id, issueItemId));
            for (const usage of usageRows) {
              await tx.insert(schema.fifoUsages).values(usage);
            }
          }
        }

        if (postingOpname && lebih.length > 0) {
          receiptId = newId("rcv");
          await tx.insert(schema.receipts).values({
            id: receiptId,
            bidangId: activeBidangId,
            nomorDokumen,
            tanggal,
            vendorNama: "Penyesuaian Stock Opname",
            keterangan: `Penambahan hasil stock opname ${nomorDokumen}`,
            createdBy: session.nama,
            createdAt: now,
          });

          for (const p of lebih) {
            const receiptItemId = newId("rcvi");
            await tx.insert(schema.receiptItems).values({
              id: receiptItemId,
              receiptId,
              itemId: p.itemId,
              jumlah: p.selisihJumlah,
              hargaSatuan: p.hargaSatuanPakai,
              jumlahHarga: p.selisihJumlah * p.hargaSatuanPakai,
            });
            await insertStockLayer(tx, {
              bidangId: activeBidangId,
              itemId: p.itemId,
              tanggal,
              jumlah: p.selisihJumlah,
              hargaSatuan: p.hargaSatuanPakai,
            });
          }
        }

        if (issueId || receiptId) {
          await tx
            .update(schema.stockAdjustments)
            .set({ issueId, receiptId })
            .where(eq(schema.stockAdjustments.id, adjustmentId));
        }

        return {
          adjustmentId,
          nomorDokumen,
          posted: Boolean(issueId || receiptId),
          barangKurang: kurang.length,
          barangLebih: lebih.length,
          nilaiKurang: kurang.reduce((s, p) => s + Math.abs(p.selisihNilai), 0),
          nilaiLebih: lebih.reduce((s, p) => s + p.selisihNilai, 0),
        };
      })
    );

    await recordActivityLog({
      userId: session.id,
      userName: session.nama,
      userRole: session.role,
      bidangId: activeBidangId,
      action: "INPUT_KELUAR",
      description: `Stock opname ${result.nomorDokumen} per ${tanggal}: ${result.barangKurang} barang berkurang, ${result.barangLebih} barang bertambah${result.posted ? " (penyesuaian diposting)" : " (tanpa penyesuaian)"}.`,
      metadata: { adjustmentId: result.adjustmentId, nomorDokumen: result.nomorDokumen, tanggal },
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    return errorResponse(err);
  }
}

/**
 * Mengubah keterangan administratif dokumen opname — sekarang dipakai untuk
 * menyimpan nomor Berita Acara resmi (diisi manual dari kantor).
 */
export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session || (!session.activeBidangId && !session.bidangId)) {
    return NextResponse.json({ error: "Unauthorized / Bidang belum dipilih" }, { status: 401 });
  }

  const activeBidangId =
    session.role === "SUPERADMIN"
      ? session.activeBidangId!
      : (session.bidangId || session.activeBidangId)!;

  try {
    const body = await request.json();
    const id = typeof body?.id === "string" ? body.id.trim() : "";
    if (!id) {
      return NextResponse.json({ error: "ID dokumen opname wajib diisi" }, { status: 400 });
    }
    if (body?.nomorBa !== undefined && typeof body.nomorBa !== "string") {
      return NextResponse.json({ error: "Nomor Berita Acara tidak valid" }, { status: 400 });
    }
    if (body?.tanggalBa !== undefined && typeof body.tanggalBa !== "string") {
      return NextResponse.json({ error: "Tanggal Berita Acara tidak valid" }, { status: 400 });
    }

    const nomorBa = typeof body?.nomorBa === "string" && body.nomorBa.trim() ? body.nomorBa.trim() : null;
    const tanggalBa = typeof body?.tanggalBa === "string" && body.tanggalBa.trim() ? body.tanggalBa.trim() : null;

    const existing = await db.query.stockAdjustments.findFirst({
      where: and(eq(schema.stockAdjustments.id, id), eq(schema.stockAdjustments.bidangId, activeBidangId)),
      columns: { id: true, nomorDokumen: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Dokumen stock opname tidak ditemukan" }, { status: 404 });
    }

    await db
      .update(schema.stockAdjustments)
      .set({ nomorBa, tanggalBa })
      .where(eq(schema.stockAdjustments.id, id));

    await recordActivityLog({
      userId: session.id,
      userName: session.nama,
      userRole: session.role,
      bidangId: activeBidangId,
      action: "UBAH_PENGATURAN",
      description: `Nomor/tanggal Berita Acara dokumen opname ${existing.nomorDokumen} diubah menjadi ${nomorBa || "(nomor kosong)"} / ${tanggalBa || "(tanggal kosong)"}.`,
      metadata: { adjustmentId: id, nomorBa, tanggalBa },
    });

    return NextResponse.json({ success: true, nomorBa, tanggalBa });
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
    if (!id) return NextResponse.json({ error: "ID stock opname diperlukan" }, { status: 400 });

    const removed = await db.transaction(async (tx) => {
      const adjustment = await tx.query.stockAdjustments.findFirst({
        where: and(
          eq(schema.stockAdjustments.id, id),
          eq(schema.stockAdjustments.bidangId, activeBidangId)
        ),
      });
      if (!adjustment) throw new DataError("Data stock opname tidak ditemukan", 404);

      // Batal dokumen penambahan: hanya boleh bila lapisannya belum terpakai.
      if (adjustment.receiptId) {
        const receiptRows = await tx.query.receiptItems.findMany({
          where: eq(schema.receiptItems.receiptId, adjustment.receiptId),
        });
        const receiptRowIds = receiptRows.map((r) => r.id);
        const layers = receiptRowIds.length
          ? await tx.query.fifoLayers.findMany({
              where: inArray(schema.fifoLayers.receiptItemId, receiptRowIds),
            })
          : [];
        if (layers.some((l) => l.jumlahAwal > l.sisa)) {
          throw new DataError(
            "Stock opname ini tidak dapat dibatalkan karena stok penambahannya sudah terpakai pada transaksi BAST."
          );
        }
        if (receiptRowIds.length) {
          await tx
            .delete(schema.fifoLayers)
            .where(inArray(schema.fifoLayers.receiptItemId, receiptRowIds));
          await tx.delete(schema.receiptItems).where(eq(schema.receiptItems.receiptId, adjustment.receiptId));
        }
        await tx.delete(schema.receipts).where(eq(schema.receipts.id, adjustment.receiptId));
      }

      // Batal dokumen pengurangan: nilai FIFO dikembalikan.
      if (adjustment.issueId) {
        const issueRows = await tx.query.issueItems.findMany({
          where: eq(schema.issueItems.issueId, adjustment.issueId),
        });
        const issueRowIds = issueRows.map((r) => r.id);
        await restoreFifoUsages(tx, issueRowIds);
        if (issueRowIds.length) {
          await tx.delete(schema.issueItems).where(inArray(schema.issueItems.id, issueRowIds));
        }
        await tx.delete(schema.issues).where(eq(schema.issues.id, adjustment.issueId));
      }

      await tx
        .delete(schema.stockAdjustmentItems)
        .where(eq(schema.stockAdjustmentItems.adjustmentId, id));
      await tx.delete(schema.stockAdjustments).where(eq(schema.stockAdjustments.id, id));

      return { nomorDokumen: adjustment.nomorDokumen, tanggal: adjustment.tanggal };
    });

    await recordActivityLog({
      userId: session.id,
      userName: session.nama,
      userRole: session.role,
      bidangId: activeBidangId,
      action: "HAPUS_KELUAR",
      description: `Membatalkan stock opname ${removed.nomorDokumen} (${removed.tanggal}) beserta dokumen penyesuaiannya.`,
      metadata: { adjustmentId: id, nomorDokumen: removed.nomorDokumen },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return errorResponse(err);
  }
}
