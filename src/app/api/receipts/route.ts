import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db, schema } from "@/db";
import { eq, and, desc, inArray } from "drizzle-orm";
import { recordActivityLog } from "@/lib/activity-log";
import {
  DataError,
  errorResponse,
  newId,
  nextReceiptNumber,
  normalizeReceiptRows,
  withRetry,
  assertItemsBelongToBidang,
  sanitizeBidangKode,
  type ReceiptRowInput,
} from "@/lib/inventory";

export async function GET() {
  const session = await getSession();
  if (!session || (!session.activeBidangId && !session.bidangId)) {
    return NextResponse.json({ error: "Unauthorized / Bidang belum dipilih" }, { status: 401 });
  }

  const activeBidangId =
    session.role === "SUPERADMIN"
      ? session.activeBidangId!
      : (session.bidangId || session.activeBidangId)!;

  const receiptsList = await db.query.receipts.findMany({
    where: eq(schema.receipts.bidangId, activeBidangId),
    orderBy: [desc(schema.receipts.tanggal), desc(schema.receipts.createdAt)],
  });

  const receiptIds = receiptsList.map((r) => r.id);
  const itemRows = receiptIds.length
    ? await db.query.receiptItems.findMany({
        where: inArray(schema.receiptItems.receiptId, receiptIds),
      })
    : [];
  const receiptItemIds = itemRows.map((i) => i.id);
  const layers = receiptItemIds.length
    ? await db.query.fifoLayers.findMany({
        where: inArray(schema.fifoLayers.receiptItemId, receiptItemIds),
        columns: { id: true, receiptItemId: true, jumlahAwal: true, sisa: true },
      })
    : [];
  const layerIds = layers.map((l) => l.id);
  const usages = layerIds.length
    ? await db.query.fifoUsages.findMany({
        where: inArray(schema.fifoUsages.fifoLayerId, layerIds),
        columns: { fifoLayerId: true },
      })
    : [];
  const layersWithUsage = new Set(usages.map((u) => u.fifoLayerId));

  // Dokumen yang sebagian stoknya sudah keluar tidak boleh diubah rinciannya.
  // Dibedakan dua sebab:
  // - locked : ada dokumen BAST yang memotong stok (rintisan normal)
  // - stale  : stok berkurang TANPA jejak dokumen (data lama/perlu perbaikan)
  const consumedReceiptItem = new Set<string>();
  const undocumentedReceiptItem = new Set<string>();
  for (const l of layers) {
    if (!l.receiptItemId || l.jumlahAwal <= l.sisa) continue;
    consumedReceiptItem.add(l.receiptItemId);
    if (!layersWithUsage.has(l.id)) undocumentedReceiptItem.add(l.receiptItemId);
  }

  const referencedItemIds = [...new Set(itemRows.map((i) => i.itemId))];
  const itemDetails = referencedItemIds.length
    ? await db.query.items.findMany({
        where: inArray(schema.items.id, referencedItemIds),
        columns: { id: true, nama: true },
      })
    : [];
  const itemNameMap = new Map(itemDetails.map((it) => [it.id, it.nama]));

  // Dokumen penambahan dari penyesuaian stock opname ditandai agar tidak
  // tertukar dengan pembelian dari penyedia.
  const opnameLinks = await db.query.stockAdjustments.findMany({
    where: eq(schema.stockAdjustments.bidangId, activeBidangId),
    columns: { receiptId: true },
  });
  const opnameReceiptIds = new Set(
    opnameLinks.map((a) => a.receiptId).filter((id): id is string => Boolean(id))
  );

  const data = receiptsList.map((r) => {
    const rows = itemRows.filter((i) => i.receiptId === r.id);
    return {
      ...r,
      isPenyesuaian: opnameReceiptIds.has(r.id),
      totalNilai: rows.reduce((sum, i) => sum + i.jumlahHarga, 0),
      locked: rows.some((i) => consumedReceiptItem.has(i.id)),
      stale: rows.some((i) => undocumentedReceiptItem.has(i.id)),
      items: rows.map((i) => ({ ...i, itemNama: itemNameMap.get(i.itemId) || "-" })),
    };
  });

  // Nomor dokumen saran untuk form barang masuk (boleh diganti mitra).
  const bidangInfo = await db.query.bidang.findFirst({
    where: eq(schema.bidang.id, activeBidangId),
    columns: { kode: true },
  });
  const nextNomor = await nextReceiptNumber(
    db,
    activeBidangId,
    sanitizeBidangKode(bidangInfo?.kode),
    String(new Date().getFullYear())
  );

  return NextResponse.json({ data, nextNomor });
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
    const { nomorDokumen, tanggal, vendorId, vendorNama, noFaktur, tglFaktur, noBa, tglBa, keterangan, items } =
      body;

    if (!tanggal || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Tanggal dan rincian barang masuk wajib diisi" },
        { status: 400 }
      );
    }

    const rows = normalizeReceiptRows(items);
    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Tidak ada baris barang yang valid (periksa barang, jumlah, dan harga satuan)" },
        { status: 400 }
      );
    }

    const bidangRow = await db.query.bidang.findFirst({
      where: eq(schema.bidang.id, activeBidangId),
      columns: { kode: true },
    });
    const bidangKode = sanitizeBidangKode(bidangRow?.kode);
    const manualDocNo = nomorDokumen?.trim() || null;

    const createReceipt = () =>
      db.transaction(async (tx) => {
        await assertItemsBelongToBidang(
          tx,
          activeBidangId,
          rows.map((r) => r.itemId)
        );

        const docNo =
          manualDocNo ||
          (await nextReceiptNumber(tx, activeBidangId, bidangKode, String(tanggal).substring(0, 4)));

        const receiptId = newId("rcv");
        const now = Date.now();

        await tx.insert(schema.receipts).values({
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

        for (const row of rows) {
          const receiptItemId = newId("rcvi");
          await tx.insert(schema.receiptItems).values({
            id: receiptItemId,
            receiptId,
            itemId: row.itemId,
            jumlah: row.jumlah,
            hargaSatuan: row.hargaSatuan,
            jumlahHarga: row.jumlah * row.hargaSatuan,
          });
          await tx.insert(schema.fifoLayers).values({
            id: newId("layer"),
            bidangId: activeBidangId,
            itemId: row.itemId,
            receiptItemId,
            tanggal,
            hargaSatuan: row.hargaSatuan,
            jumlahAwal: row.jumlah,
            sisa: row.jumlah,
            status: "ACTIVE",
          });
        }

        return { receiptId, docNo, jumlahJenis: rows.length };
      });

    // Nomor dokumen manual tidak perlu diulang: kalau bentrok, memang salah input.
    const result = manualDocNo ? await createReceipt() : await withRetry(createReceipt);

    await recordActivityLog({
      userId: session.id,
      userName: session.nama,
      userRole: session.role,
      bidangId: activeBidangId,
      action: "INPUT_MASUK",
      description: `Mencatat penerimaan ${result.jumlahJenis} jenis barang (${result.docNo}) dari vendor ${vendorNama || "-"}.`,
      metadata: { receiptId: result.receiptId, nomorDokumen: result.docNo, vendorNama },
    });

    return NextResponse.json({ success: true, id: result.receiptId, nomorDokumen: result.docNo });
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
    const { id, nomorDokumen, tanggal, vendorId, vendorNama, noFaktur, tglFaktur, noBa, tglBa, keterangan, items } =
      body;

    if (!id) {
      return NextResponse.json({ error: "ID penerimaan wajib diisi" }, { status: 400 });
    }

    const incomingRows: ReceiptRowInput[] | null =
      Array.isArray(items) && items.length > 0 ? normalizeReceiptRows(items) : null;

    const result = await withRetry(() =>
      db.transaction(async (tx) => {
        const existing = await tx.query.receipts.findFirst({
          where: and(eq(schema.receipts.id, id), eq(schema.receipts.bidangId, activeBidangId)),
        });
        if (!existing) {
          throw new DataError("Data penerimaan tidak ditemukan di unit kerja Anda", 404);
        }

        const existingRows = await tx.query.receiptItems.findMany({
          where: eq(schema.receiptItems.receiptId, id),
        });
        const existingRowIds = existingRows.map((r) => r.id);
        const existingLayers = existingRowIds.length
          ? await tx.query.fifoLayers.findMany({
              where: inArray(schema.fifoLayers.receiptItemId, existingRowIds),
            })
          : [];
        const consumedLayers = existingLayers.filter((l) => l.jumlahAwal > l.sisa);

        if (incomingRows) {
          if (incomingRows.length === 0) {
            throw new DataError("Tidak ada baris barang yang valid pada dokumen ini");
          }
          await assertItemsBelongToBidang(
            tx,
            activeBidangId,
            incomingRows.map((r) => r.itemId)
          );

          if (consumedLayers.length === 0) {
            // Belum ada stok yang keluar: dokumen boleh diperbaiki menyeluruh.
            if (existingRowIds.length) {
              await tx
                .delete(schema.fifoLayers)
                .where(inArray(schema.fifoLayers.receiptItemId, existingRowIds));
              await tx.delete(schema.receiptItems).where(eq(schema.receiptItems.receiptId, id));
            }
            for (const row of incomingRows) {
              const receiptItemId = newId("rcvi");
              await tx.insert(schema.receiptItems).values({
                id: receiptItemId,
                receiptId: id,
                itemId: row.itemId,
                jumlah: row.jumlah,
                hargaSatuan: row.hargaSatuan,
                jumlahHarga: row.jumlah * row.hargaSatuan,
              });
              await tx.insert(schema.fifoLayers).values({
                id: newId("layer"),
                bidangId: activeBidangId,
                itemId: row.itemId,
                receiptItemId,
                tanggal: tanggal || existing.tanggal,
                hargaSatuan: row.hargaSatuan,
                jumlahAwal: row.jumlah,
                sisa: row.jumlah,
                status: "ACTIVE",
              });
            }
          } else {
            // Sebagian stok sudah keluar: rincian barang tidak boleh berubah,
            // karena akan menulis ulang harga/jumlah yang sudah dipakai BAST.
            const changed = describeReceiptRowChanges(existingRows, incomingRows);
            if (changed) {
              throw new DataError(
                `Rincian barang tidak dapat diubah karena stok dokumen ini sudah dikeluarkan lewat BAST (${changed}). Batalkan/perbaiki BAST terkait terlebih dahulu, lalu ubah faktur ini.`
              );
            }
            if (tanggal && tanggal !== existing.tanggal) {
              throw new DataError(
                "Tanggal penerimaan tidak dapat diubah karena stok dokumen ini sudah dikeluarkan lewat BAST. Batalkan BAST terkait terlebih dahulu."
              );
            }
          }
        }

        await tx
          .update(schema.receipts)
          .set({
            nomorDokumen: nomorDokumen ? String(nomorDokumen).trim() : existing.nomorDokumen,
            tanggal: tanggal || existing.tanggal,
            vendorId: vendorId !== undefined ? vendorId || null : existing.vendorId,
            vendorNama: vendorNama !== undefined ? vendorNama || null : existing.vendorNama,
            noFaktur: noFaktur !== undefined ? noFaktur || null : existing.noFaktur,
            tglFaktur: tglFaktur !== undefined ? tglFaktur || null : existing.tglFaktur,
            noBa: noBa !== undefined ? noBa || null : existing.noBa,
            tglBa: tglBa !== undefined ? tglBa || null : existing.tglBa,
            keterangan: keterangan !== undefined ? keterangan || null : existing.keterangan,
          })
          .where(eq(schema.receipts.id, id));

        return { docNo: nomorDokumen || existing.nomorDokumen };
      }),
      1
    );

    await recordActivityLog({
      userId: session.id,
      userName: session.nama,
      userRole: session.role,
      bidangId: activeBidangId,
      action: "UBAH_PENERIMAAN",
      description: `Memperbarui data penerimaan barang (${result.docNo}).`,
      metadata: { receiptId: id, nomorDokumen: result.docNo },
    });

    return NextResponse.json({ success: true, id, nomorDokumen: result.docNo });
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
    if (!id) return NextResponse.json({ error: "ID penerimaan diperlukan" }, { status: 400 });

    const result = await db.transaction(async (tx) => {
      const existing = await tx.query.receipts.findFirst({
        where: and(eq(schema.receipts.id, id), eq(schema.receipts.bidangId, activeBidangId)),
      });
      if (!existing) {
        throw new DataError("Data penerimaan tidak ditemukan", 404);
      }

      const existingRows = await tx.query.receiptItems.findMany({
        where: eq(schema.receiptItems.receiptId, id),
      });
      const existingRowIds = existingRows.map((r) => r.id);
      const layers = existingRowIds.length
        ? await tx.query.fifoLayers.findMany({
            where: inArray(schema.fifoLayers.receiptItemId, existingRowIds),
          })
        : [];

      if (layers.some((l) => l.jumlahAwal > l.sisa)) {
        throw new DataError(
          "Penerimaan ini tidak dapat dihapus karena sebagian/seluruh stok barang telah dikeluarkan pada BAST."
        );
      }

      if (existingRowIds.length) {
        await tx
          .delete(schema.fifoLayers)
          .where(inArray(schema.fifoLayers.receiptItemId, existingRowIds));
        await tx.delete(schema.receiptItems).where(eq(schema.receiptItems.receiptId, id));
      }
      await tx.delete(schema.receipts).where(eq(schema.receipts.id, id));

      return { nomorDokumen: existing.nomorDokumen };
    });

    await recordActivityLog({
      userId: session.id,
      userName: session.nama,
      userRole: session.role,
      bidangId: activeBidangId,
      action: "HAPUS_PENERIMAAN",
      description: `Menghapus dokumen penerimaan barang ${result.nomorDokumen}.`,
      metadata: { receiptId: id, nomorDokumen: result.nomorDokumen },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return errorResponse(err);
  }
}

/**
 * Bandingkan rincian tersimpan dengan rincian kiriman. Mengembalikan deskripsi
 * perbedaan pertama, atau null bila identik (barang, jumlah, harga).
 */
function describeReceiptRowChanges(
  stored: Array<{ itemId: string; jumlah: number; hargaSatuan: number }>,
  incoming: ReceiptRowInput[]
): string | null {
  // Kedua sisi dijumlahkan lebih dulu, sehingga dokumen lama yang menuliskan
  // barang sama dalam dua baris tetap dianggap tidak berubah.
  const summarize = (rows: Array<{ itemId: string; jumlah: number; hargaSatuan: number }>) => {
    const acc = new Map<string, number>();
    for (const r of rows) {
      const key = `${r.itemId}::${r.hargaSatuan}`;
      acc.set(key, (acc.get(key) || 0) + r.jumlah);
    }
    return acc;
  };

  const storedByKey = summarize(stored);
  const incomingByKey = summarize(incoming);

  if (storedByKey.size !== incomingByKey.size) {
    return "jumlah baris berbeda";
  }
  for (const [key, qty] of storedByKey) {
    const newQty = incomingByKey.get(key);
    if (newQty === undefined) return "ada barang/harga yang dihapus atau diubah";
    if (newQty !== qty) return "ada jumlah barang yang diubah";
  }
  return null;
}
