import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db, schema } from "@/db";
import { eq, and, desc, inArray, ne } from "drizzle-orm";
import { recordActivityLog } from "@/lib/activity-log";
import {
  DataError,
  errorResponse,
  newId,
  nextIssueNumber,
  normalizeIssueRows,
  withRetry,
  assertItemsBelongToBidang,
  assertIssueStock,
  deductFifo,
  restoreFifoUsages,
  sanitizeBidangKode,
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

  const issuesList = await db.query.issues.findMany({
    where: and(
      eq(schema.issues.bidangId, activeBidangId),
      // Dokumen penyesuaian stock opname tidak ditampilkan di daftar BAST;
      // riwayatnya ada di menu Stock Opname.
      ne(schema.issues.jenis, "PENYESUAIAN")
    ),
    orderBy: [desc(schema.issues.tanggal), desc(schema.issues.createdAt)],
  });

  const issueIds = issuesList.map((i) => i.id);
  const itemRows = issueIds.length
    ? await db.query.issueItems.findMany({ where: inArray(schema.issueItems.issueId, issueIds) })
    : [];

  const referencedItemIds = [...new Set(itemRows.map((i) => i.itemId))];
  const itemDetails = referencedItemIds.length
    ? await db.query.items.findMany({
        where: inArray(schema.items.id, referencedItemIds),
        columns: { id: true, nama: true },
      })
    : [];
  const itemNameMap = new Map(itemDetails.map((it) => [it.id, it.nama]));

  const data = issuesList.map((iss) => {
    const rows = itemRows.filter((i) => i.issueId === iss.id);
    return {
      ...iss,
      totalNilai: rows.reduce((sum, i) => sum + i.totalNilaiFifo, 0),
      items: rows.map((i) => ({ ...i, itemNama: itemNameMap.get(i.itemId) || "-" })),
    };
  });

  // Nomor dokumen saran untuk form barang keluar (boleh diganti mitra).
  const bidangInfo = await db.query.bidang.findFirst({
    where: eq(schema.bidang.id, activeBidangId),
    columns: { kode: true },
  });
  const nextNomor = await nextIssueNumber(
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

    // Baris dengan barang sama digabung supaya kebutuhan stok dihitung total,
    // bukan per baris (penyebab stok minus pada pengeluaran 5 + 5 dari stok 6).
    const rows = normalizeIssueRows(items);
    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Tidak ada baris barang yang valid (periksa barang dan jumlah)" },
        { status: 400 }
      );
    }

    const bidangKode = sanitizeBidangKode(
      (
        await db.query.bidang.findFirst({
          where: eq(schema.bidang.id, activeBidangId),
          columns: { kode: true },
        })
      )?.kode
    );
    const manualDocNo = nomorDokumen?.trim() || null;

    const createIssue = () =>
      db.transaction(async (tx) => {
        await assertItemsBelongToBidang(
          tx,
          activeBidangId,
          rows.map((r) => r.itemId)
        );
        await assertIssueStock(tx, activeBidangId, rows);

        const docNo =
          manualDocNo ||
          (await nextIssueNumber(tx, activeBidangId, bidangKode, String(tanggal).substring(0, 4)));

        const currentBidang = await tx.query.bidang.findFirst({
          where: eq(schema.bidang.id, activeBidangId),
        });

        const issueId = newId("iss");
        await tx.insert(schema.issues).values({
          id: issueId,
          bidangId: activeBidangId,
          nomorDokumen: docNo,
          tanggal,
          tglPenyerahan: tglPenyerahan || tanggal,
          penerima: String(penerima).trim(),
          keperluan: keperluan || null,
          keterangan: keterangan || null,
          namaPenyerah: currentBidang?.namaPengurus || namaPenyerah || session.nama,
          nipPenyerah: currentBidang?.nipPengurus || nipPenyerah || null,
          jabatanPenyerah: currentBidang?.jabatanPengurus || jabatanPenyerah || "Pengurus Barang",
          namaPenerima: namaPenerima || null,
          nipPenerima: nipPenerima || null,
          jabatanPenerima: jabatanPenerima || null,
          createdBy: session.nama,
          createdAt: Date.now(),
        });

        for (const row of rows) {
          const issueItemId = newId("issi");
          const { usageRows, totalValue } = await deductFifo(tx, {
            bidangId: activeBidangId,
            itemId: row.itemId,
            qty: row.jumlah,
            issueItemId,
          });

          await tx.insert(schema.issueItems).values({
            id: issueItemId,
            issueId,
            itemId: row.itemId,
            jumlah: row.jumlah,
            totalNilaiFifo: totalValue,
          });

          for (const usage of usageRows) {
            await tx.insert(schema.fifoUsages).values(usage);
          }
        }

        return { issueId, docNo, jumlahJenis: rows.length };
      });

    // Nomor dokumen manual tidak perlu diulang: kalau bentrok, memang salah input.
    const result = manualDocNo ? await createIssue() : await withRetry(createIssue);

    await recordActivityLog({
      userId: session.id,
      userName: session.nama,
      userRole: session.role,
      bidangId: activeBidangId,
      action: "INPUT_KELUAR",
      description: `Menerbitkan BAST pengeluaran barang (${result.docNo}) kepada ${penerima} sejumlah ${result.jumlahJenis} jenis item.`,
      metadata: { issueId: result.issueId, nomorDokumen: result.docNo, penerima },
    });

    return NextResponse.json({ success: true, id: result.issueId, nomorDokumen: result.docNo });
  } catch (err: unknown) {
    return errorResponse(err);
  }
}

export async function PUT(request: Request) {
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
    const {
      id,
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

    if (!id) {
      return NextResponse.json({ error: "ID pengeluaran (BAST) wajib diisi" }, { status: 400 });
    }

    const rows = Array.isArray(items) && items.length > 0 ? normalizeIssueRows(items) : null;
    if (rows && rows.length === 0) {
      return NextResponse.json({ error: "Tidak ada baris barang yang valid" }, { status: 400 });
    }

    const result = await withRetry(() =>
      db.transaction(async (tx) => {
        const existing = await tx.query.issues.findFirst({
          where: and(eq(schema.issues.id, id), eq(schema.issues.bidangId, activeBidangId)),
        });
        if (!existing) {
          throw new DataError("Dokumen BAST pengeluaran tidak ditemukan di unit kerja Anda", 404);
        }

        if (rows) {
          await assertItemsBelongToBidang(
            tx,
            activeBidangId,
            rows.map((r) => r.itemId)
          );

          // 1. Kembalikan seluruh potongan FIFO dokumen ini
          const oldIssueItems = await tx.query.issueItems.findMany({
            where: eq(schema.issueItems.issueId, id),
          });
          const oldIssueItemIds = oldIssueItems.map((i) => i.id);
          await restoreFifoUsages(tx, oldIssueItemIds);
          if (oldIssueItemIds.length) {
            await tx.delete(schema.issueItems).where(inArray(schema.issueItems.id, oldIssueItemIds));
          }

          // 2. Validasi ulang terhadap stok yang sudah dipulihkan
          await assertIssueStock(tx, activeBidangId, rows);

          // 3. Potong kembali sesuai rincian baru
          for (const row of rows) {
            const issueItemId = newId("issi");
            const { usageRows, totalValue } = await deductFifo(tx, {
              bidangId: activeBidangId,
              itemId: row.itemId,
              qty: row.jumlah,
              issueItemId,
            });

            await tx.insert(schema.issueItems).values({
              id: issueItemId,
              issueId: id,
              itemId: row.itemId,
              jumlah: row.jumlah,
              totalNilaiFifo: totalValue,
            });

            for (const usage of usageRows) {
              await tx.insert(schema.fifoUsages).values(usage);
            }
          }
        }

        await tx
          .update(schema.issues)
          .set({
            nomorDokumen: nomorDokumen ? String(nomorDokumen).trim() : existing.nomorDokumen,
            tanggal: tanggal || existing.tanggal,
            tglPenyerahan: tglPenyerahan || tanggal || existing.tglPenyerahan,
            penerima: penerima !== undefined ? String(penerima).trim() : existing.penerima,
            keperluan: keperluan !== undefined ? keperluan || null : existing.keperluan,
            keterangan: keterangan !== undefined ? keterangan || null : existing.keterangan,
            namaPenyerah: namaPenyerah !== undefined ? namaPenyerah || null : existing.namaPenyerah,
            nipPenyerah: nipPenyerah !== undefined ? nipPenyerah || null : existing.nipPenyerah,
            jabatanPenyerah:
              jabatanPenyerah !== undefined ? jabatanPenyerah || null : existing.jabatanPenyerah,
            namaPenerima: namaPenerima !== undefined ? namaPenerima || null : existing.namaPenerima,
            nipPenerima: nipPenerima !== undefined ? nipPenerima || null : existing.nipPenerima,
            jabatanPenerima:
              jabatanPenerima !== undefined ? jabatanPenerima || null : existing.jabatanPenerima,
          })
          .where(eq(schema.issues.id, id));

        return { docNo: nomorDokumen || existing.nomorDokumen };
      }),
      1
    );

    await recordActivityLog({
      userId: session.id,
      userName: session.nama,
      userRole: session.role,
      bidangId: activeBidangId,
      action: "UBAH_KELUAR",
      description: `Memperbarui BAST pengeluaran barang (${result.docNo}).`,
      metadata: { issueId: id, nomorDokumen: result.docNo },
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
    if (!id) return NextResponse.json({ error: "ID pengeluaran diperlukan" }, { status: 400 });

    const result = await db.transaction(async (tx) => {
      const existing = await tx.query.issues.findFirst({
        where: and(eq(schema.issues.id, id), eq(schema.issues.bidangId, activeBidangId)),
      });
      if (!existing) {
        throw new DataError("Data pengeluaran tidak ditemukan", 404);
      }

      const issueItems = await tx.query.issueItems.findMany({
        where: eq(schema.issueItems.issueId, id),
      });
      const issueItemIds = issueItems.map((i) => i.id);

      await restoreFifoUsages(tx, issueItemIds);
      if (issueItemIds.length) {
        await tx.delete(schema.issueItems).where(inArray(schema.issueItems.id, issueItemIds));
      }
      await tx.delete(schema.issues).where(eq(schema.issues.id, id));

      return { nomorDokumen: existing.nomorDokumen };
    });

    await recordActivityLog({
      userId: session.id,
      userName: session.nama,
      userRole: session.role,
      bidangId: activeBidangId,
      action: "HAPUS_KELUAR",
      description: `Membatalkan / menghapus dokumen BAST ${result.nomorDokumen}.`,
      metadata: { issueId: id, nomorDokumen: result.nomorDokumen },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return errorResponse(err);
  }
}
