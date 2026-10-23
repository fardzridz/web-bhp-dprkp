import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db, schema } from "@/db";
import { eq, and, lte, gte, asc, inArray } from "drizzle-orm";
import {
  groupBaselinesByItem,
  groupMovementsByItem,
  pickBaseline,
  summarizeMovements,
  type Movement,
} from "@/lib/stock";
import { buildLedger, collectItemLedger } from "@/lib/inventory";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isSuperAdmin = session.role === "SUPERADMIN";
  const { searchParams } = new URL(request.url);
  const requestedBidangId = searchParams.get("bidangId");

  let activeBidangId = requestedBidangId || session.activeBidangId;

  // Non-superadmin is strictly restricted to their own assigned bidang
  if (!isSuperAdmin) {
    activeBidangId = session.bidangId || session.activeBidangId;
    if (!activeBidangId) {
      return NextResponse.json({ error: "Bidang pengguna tidak terdaftar" }, { status: 403 });
    }
  }

  const isAllBidang = isSuperAdmin && (
    activeBidangId === "ALL" ||
    activeBidangId === "all" ||
    activeBidangId === "semua" ||
    activeBidangId === "SEMUA" ||
    !activeBidangId
  );

  const type = searchParams.get("type") || "MUTASI";
  const startDate = searchParams.get("startDate") || "2026-01-01";
  const endDate = searchParams.get("endDate") || "2026-12-31";

  // 1. Fetch SKPD and Bidang metadata for signature blocks
  const agencyRows = await db.query.agencySettings.findMany();
  const agency: Record<string, string> = {};
  for (const r of agencyRows) agency[r.key] = r.value;

  const allBidangList = await db.query.bidang.findMany({
    orderBy: (b, { asc }) => [asc(b.nama)],
  });
  const bidangMap: Record<string, typeof allBidangList[0]> = {};
  for (const b of allBidangList) bidangMap[b.id] = b;

  let reportBidang: {
    id?: string;
    nama?: string;
    kode?: string;
    namaAtasan?: string;
    nipAtasan?: string;
    jabatanAtasan?: string;
    pangkatAtasan?: string;
    namaPengurus?: string;
    nipPengurus?: string;
    jabatanPengurus?: string;
    pangkatPengurus?: string;
  };

  if (isAllBidang) {
    const sekr = allBidangList.find((b) => b.kode === "SEKR" || b.id === "sekretariat");
    reportBidang = {
      id: "ALL",
      nama: "Semua Bidang (Gabungan SKPD)",
      kode: "SEMUA",
      namaAtasan: agency.NAMA_KEPALA || "Ir. H. Hari Apriyanto",
      nipAtasan: agency.NIP_KEPALA || "19680415 199803 1 005",
      jabatanAtasan: agency.JABATAN_KEPALA || "Kepala Dinas Perumahan Rakyat dan Kawasan Permukiman",
      pangkatAtasan: agency.PANGKAT_KEPALA || "Pembina Utama Muda (IV/c)",
      namaPengurus: agency.NAMA_PENGURUS || sekr?.namaPengurus || "Ahmad Zainuri, S.AP",
      nipPengurus: agency.NIP_PENGURUS || sekr?.nipPengurus || "19850612 201001 1 012",
      jabatanPengurus: agency.JABATAN_PENGURUS || "Pengurus Barang Pengguna",
      pangkatPengurus: agency.PANGKAT_PENGURUS || sekr?.pangkatPengurus || "Penata (III/c)",
    };
  } else {
    const b = bidangMap[activeBidangId!];
    if (!b) {
      return NextResponse.json({ error: "Bidang tidak ditemukan" }, { status: 404 });
    }
    reportBidang = {
      id: b.id,
      nama: b.nama,
      kode: b.kode,
      namaAtasan: b.namaAtasan || undefined,
      nipAtasan: b.nipAtasan || undefined,
      jabatanAtasan: b.jabatanAtasan || undefined,
      pangkatAtasan: b.pangkatAtasan || undefined,
      namaPengurus: b.namaPengurus || undefined,
      nipPengurus: b.nipPengurus || undefined,
      jabatanPengurus: b.jabatanPengurus || undefined,
      pangkatPengurus: b.pangkatPengurus || undefined,
    };
  }

  const allItems = isAllBidang
    ? await db.query.items.findMany({
        orderBy: (i, { asc }) => [asc(i.nama)],
      })
    : await db.query.items.findMany({
        where: eq(schema.items.bidangId, activeBidangId!),
        orderBy: (i, { asc }) => [asc(i.nama)],
      });

  const categories = await db.query.categories.findMany();
  const categoryMap: Record<string, string> = {};
  for (const c of categories) categoryMap[c.id] = c.nama;

  const units = await db.query.units.findMany();
  const unitMap: Record<string, string> = {};
  for (const u of units) unitMap[u.id] = u.nama;

  // 2. Branch according to report type
  // Dokumen penyesuaian stock opname dipisahkan dari Lampiran 8/9 (bukan
  // penerimaan dari penyedia maupun pengeluaran ke pengguna barang).
  const opnameLinks = isAllBidang
    ? await db.query.stockAdjustments.findMany({ columns: { issueId: true, receiptId: true } })
    : await db.query.stockAdjustments.findMany({
        where: eq(schema.stockAdjustments.bidangId, activeBidangId!),
        columns: { issueId: true, receiptId: true },
      });
  const opnameReceiptIds = new Set(
    opnameLinks.map((a) => a.receiptId).filter((id): id is string => Boolean(id))
  );
  const opnameIssueIds = new Set(
    opnameLinks.map((a) => a.issueId).filter((id): id is string => Boolean(id))
  );

  if (type === "MUTASI") {
    // Receipts
    const allReceipts = isAllBidang
      ? await db.query.receipts.findMany()
      : await db.query.receipts.findMany({
          where: eq(schema.receipts.bidangId, activeBidangId!),
        });
    const receiptMap: Record<string, typeof allReceipts[0]> = {};
    for (const r of allReceipts) receiptMap[r.id] = r;

    const allReceiptItems = await db.query.receiptItems.findMany();

    // Issues
    const allIssues = isAllBidang
      ? await db.query.issues.findMany()
      : await db.query.issues.findMany({
          where: eq(schema.issues.bidangId, activeBidangId!),
        });
    const issueMap: Record<string, typeof allIssues[0]> = {};
    for (const i of allIssues) issueMap[i.id] = i;

    const allIssueItems = await db.query.issueItems.findMany();

    // Saldo awal (baseline) & hasil stock opname terakhir per barang.
    // Aturan resmi: saldo akhir = saldo awal + penambahan - pengurangan (lib/stock.ts).
    const baselineRows = isAllBidang
      ? await db.query.openingBalances.findMany({
          columns: { itemId: true, tanggal: true, jumlah: true, hargaSatuan: true },
        })
      : await db.query.openingBalances.findMany({
          where: eq(schema.openingBalances.bidangId, activeBidangId!),
          columns: { itemId: true, tanggal: true, jumlah: true, hargaSatuan: true },
        });
    const baselinesByItem = groupBaselinesByItem(baselineRows);

    const adjustmentRows = isAllBidang
      ? await db.query.stockAdjustments.findMany({ columns: { id: true, tanggal: true } })
      : await db.query.stockAdjustments.findMany({
          where: eq(schema.stockAdjustments.bidangId, activeBidangId!),
          columns: { id: true, tanggal: true },
        });
    const adjustmentMap = new Map(adjustmentRows.map((a) => [a.id, a]));
    const adjustmentItemRows = adjustmentRows.length
      ? await db.query.stockAdjustmentItems.findMany({
          where: inArray(
            schema.stockAdjustmentItems.adjustmentId,
            adjustmentRows.map((a) => a.id)
          ),
        })
      : [];
    const opnameByItem = new Map<string, (typeof adjustmentItemRows)[number]>();
    const opnameDateByItem = new Map<string, string>();
    for (const row of adjustmentItemRows) {
      const parent = adjustmentMap.get(row.adjustmentId);
      if (!parent || parent.tanggal > endDate) continue;
      const currentDate = opnameDateByItem.get(row.itemId);
      if (!currentDate || parent.tanggal > currentDate) {
        opnameByItem.set(row.itemId, row);
        opnameDateByItem.set(row.itemId, parent.tanggal);
      }
    }

    // Kumpulkan seluruh pergerakan dokumen (penerimaan, BAST, penyesuaian opname).
    const inScope = new Set(allItems.map((i) => i.id));
    const movements: Movement[] = [];

    for (const ri of allReceiptItems) {
      const parent = receiptMap[ri.receiptId];
      if (!parent || !inScope.has(ri.itemId)) continue;
      movements.push({
        itemId: ri.itemId,
        tanggal: parent.tanggal,
        tipe: "IN",
        jumlah: ri.jumlah,
        nilai: ri.jumlahHarga,
      });
    }

    for (const ii of allIssueItems) {
      const parent = issueMap[ii.issueId];
      if (!parent || !inScope.has(ii.itemId)) continue;
      movements.push({
        itemId: ii.itemId,
        tanggal: parent.tanggal,
        tipe: "OUT",
        jumlah: ii.jumlah,
        nilai: ii.totalNilaiFifo,
      });
    }

    const movementsByItem = groupMovementsByItem(movements);

    // Identitas barang untuk baris laporan.
    const itemMeta = allItems.map((item) => {
      const b = bidangMap[item.bidangId];
      return {
        id: item.id,
        bidangId: item.bidangId,
        bidangNama: b?.nama || item.bidangId,
        bidangKode: b?.kode || "-",
        kode: item.kode,
        nama: item.nama,
        kategori: item.kategoriId ? categoryMap[item.kategoriId] || "-" : "-",
        satuan: item.satuanId ? unitMap[item.satuanId] || "-" : "-",
      };
    });

    let totalOpeningQty = 0;
    let totalOpeningValue = 0;
    let totalIncomingQty = 0;
    let totalIncomingValue = 0;
    let totalOutgoingQty = 0;
    let totalOutgoingValue = 0;
    let totalClosingQty = 0;
    let totalClosingValue = 0;
    let totalOpnameQty = 0;
    let totalOpnameValue = 0;
    let totalSelisihQty = 0;
    let totalSelisihValue = 0;
    let opnameItems = 0;
    let negativeItems = 0;

    // Saldo negatif TIDAK dipangkas jadi 0 (itu menyembunyikan kesalahan),
    // tetapi ditandai agar terlihat pada laporan.
    const rows = itemMeta.map((meta) => {
      const summary = summarizeMovements(
        pickBaseline(baselinesByItem.get(meta.id) || [], endDate),
        movementsByItem.get(meta.id) || [],
        startDate,
        endDate
      );

      const opname = opnameByItem.get(meta.id);
      const opnameQty = opname ? opname.jumlahFisik : null;
      const opnameValue = opname ? opname.nilaiFisik : null;
      const selisihQty = opnameQty === null ? null : summary.closingQty - opnameQty;
      const selisihValue = opnameValue === null ? null : summary.closingValue - opnameValue;
      const negative = summary.closingQty < 0;
      if (negative) negativeItems += 1;

      if (opname) {
        opnameItems += 1;
        totalOpnameQty += opname.jumlahFisik;
        totalOpnameValue += opname.nilaiFisik;
        totalSelisihQty += selisihQty ?? 0;
        totalSelisihValue += selisihValue ?? 0;
      }

      totalOpeningQty += summary.openingQty;
      totalOpeningValue += summary.openingValue;
      totalIncomingQty += summary.incomingQty;
      totalIncomingValue += summary.incomingValue;
      totalOutgoingQty += summary.outgoingQty;
      totalOutgoingValue += summary.outgoingValue;
      totalClosingQty += summary.closingQty;
      totalClosingValue += summary.closingValue;

      return {
        ...meta,
        ...summary,
        opnameQty,
        opnameValue,
        opnameKondisi: opname?.kondisi ?? null,
        opnameTanggal: opnameDateByItem.get(meta.id) ?? null,
        selisihQty,
        selisihValue,
        negative,
      };
    });

    if (isAllBidang) {
      rows.sort((a, b) => {
        const cmp = a.bidangNama.localeCompare(b.bidangNama);
        if (cmp !== 0) return cmp;
        return a.nama.localeCompare(b.nama);
      });
    } else {
      rows.sort((a, b) => a.nama.localeCompare(b.nama));
    }

    return NextResponse.json({
      type: "MUTASI",
      isAllBidang,
      startDate,
      endDate,
      agency,
      bidang: reportBidang,
      totals: {
        openingQty: totalOpeningQty,
        openingValue: totalOpeningValue,
        incomingQty: totalIncomingQty,
        incomingValue: totalIncomingValue,
        outgoingQty: totalOutgoingQty,
        outgoingValue: totalOutgoingValue,
        closingQty: totalClosingQty,
        closingValue: totalClosingValue,
        negativeItems,
        opnameItems,
        opnameQty: totalOpnameQty,
        opnameValue: totalOpnameValue,
        selisihQty: totalSelisihQty,
        selisihValue: totalSelisihValue,
      },
      rows,
    });
  }

  if (type === "PENERIMAAN") {
    // Buku Penerimaan Barang (Lampiran 8) — dokumen penyesuaian stock opname
    // tidak dimasukkan karena bukan penerimaan dari penyedia.
    const rawReceipts = isAllBidang
      ? await db.query.receipts.findMany({
          where: and(
            gte(schema.receipts.tanggal, startDate),
            lte(schema.receipts.tanggal, endDate)
          ),
          orderBy: [asc(schema.receipts.tanggal), asc(schema.receipts.createdAt)],
        })
      : await db.query.receipts.findMany({
          where: and(
            eq(schema.receipts.bidangId, activeBidangId!),
            gte(schema.receipts.tanggal, startDate),
            lte(schema.receipts.tanggal, endDate)
          ),
          orderBy: [asc(schema.receipts.tanggal), asc(schema.receipts.createdAt)],
        });
    const receiptsList = rawReceipts.filter((r) => !opnameReceiptIds.has(r.id));

    const itemMap: Record<string, { nama: string; satuan: string; kategori: string; bidangId: string }> = {};
    for (const item of allItems) {
      itemMap[item.id] = {
        nama: item.nama,
        kategori: item.kategoriId ? categoryMap[item.kategoriId] || "-" : "-",
        satuan: item.satuanId ? unitMap[item.satuanId] || "-" : "-",
        bidangId: item.bidangId,
      };
    }

    const flatRows = [];
    let totalJumlah = 0;
    let totalJumlahHarga = 0;

    for (const r of receiptsList) {
      const items = await db.query.receiptItems.findMany({
        where: eq(schema.receiptItems.receiptId, r.id),
      });

      const b = bidangMap[r.bidangId];
      for (const it of items) {
        const meta = itemMap[it.itemId] || { nama: "-", satuan: "-", kategori: "-", bidangId: r.bidangId };
        totalJumlah += it.jumlah;
        totalJumlahHarga += it.jumlahHarga;
        flatRows.push({
          tanggal: r.tanggal,
          bidangId: r.bidangId,
          bidangNama: b?.nama || r.bidangId,
          bidangKode: b?.kode || "-",
          vendor: r.vendorNama || "-",
          noFaktur: r.noFaktur || "-",
          tglFaktur: r.tglFaktur || "",
          noBa: r.noBa || "-",
          tglBa: r.tglBa || "",
          namaBarang: meta.nama,
          kategori: meta.kategori,
          satuan: meta.satuan,
          jumlah: it.jumlah,
          hargaSatuan: it.hargaSatuan,
          jumlahHarga: it.jumlahHarga,
          keterangan: r.keterangan || "",
        });
      }
    }

    return NextResponse.json({
      type: "PENERIMAAN",
      isAllBidang,
      startDate,
      endDate,
      agency,
      bidang: reportBidang,
      totals: {
        jumlah: totalJumlah,
        jumlahHarga: totalJumlahHarga,
      },
      rows: flatRows,
    });
  }

  if (type === "PENGELUARAN") {
    // Buku Pengeluaran Barang (Lampiran 9) — dokumen penyesuaian stock opname
    // tidak dimasukkan karena bukan penyerahan barang ke pengguna.
    const rawIssues = isAllBidang
      ? await db.query.issues.findMany({
          where: and(
            gte(schema.issues.tanggal, startDate),
            lte(schema.issues.tanggal, endDate)
          ),
          orderBy: [asc(schema.issues.tanggal), asc(schema.issues.createdAt)],
        })
      : await db.query.issues.findMany({
          where: and(
            eq(schema.issues.bidangId, activeBidangId!),
            gte(schema.issues.tanggal, startDate),
            lte(schema.issues.tanggal, endDate)
          ),
          orderBy: [asc(schema.issues.tanggal), asc(schema.issues.createdAt)],
        });
    const issuesList = rawIssues.filter(
      (iss) => iss.jenis !== "PENYESUAIAN" && !opnameIssueIds.has(iss.id)
    );

    const itemMap: Record<string, { nama: string; satuan: string; kategori: string; bidangId: string }> = {};
    for (const item of allItems) {
      itemMap[item.id] = {
        nama: item.nama,
        kategori: item.kategoriId ? categoryMap[item.kategoriId] || "-" : "-",
        satuan: item.satuanId ? unitMap[item.satuanId] || "-" : "-",
        bidangId: item.bidangId,
      };
    }

    const flatRows = [];
    let totalJumlah = 0;
    let totalJumlahHarga = 0;

    for (const iss of issuesList) {
      const items = await db.query.issueItems.findMany({
        where: eq(schema.issueItems.issueId, iss.id),
      });

      const b = bidangMap[iss.bidangId];
      for (const it of items) {
        const meta = itemMap[it.itemId] || { nama: "-", satuan: "-", kategori: "-", bidangId: iss.bidangId };
        const unitPrice = it.jumlah > 0 ? it.totalNilaiFifo / it.jumlah : 0;
        totalJumlah += it.jumlah;
        totalJumlahHarga += it.totalNilaiFifo;
        flatRows.push({
          tanggal: iss.tanggal,
          bidangId: iss.bidangId,
          bidangNama: b?.nama || iss.bidangId,
          bidangKode: b?.kode || "-",
          nomorDokumen: iss.nomorDokumen,
          penerima: iss.penerima,
          keperluan: iss.keperluan || "",
          tglPenyerahan: iss.tglPenyerahan || iss.tanggal,
          namaBarang: meta.nama,
          kategori: meta.kategori,
          satuan: meta.satuan,
          jumlah: it.jumlah,
          hargaSatuan: unitPrice,
          jumlahHarga: it.totalNilaiFifo,
          keterangan: iss.keterangan || "",
        });
      }
    }

    return NextResponse.json({
      type: "PENGELUARAN",
      isAllBidang,
      startDate,
      endDate,
      agency,
      bidang: reportBidang,
      totals: {
        jumlah: totalJumlah,
        jumlahHarga: totalJumlahHarga,
      },
      rows: flatRows,
    });
  }

  if (type === "KARTU_BARANG") {
    const requestedItemId = searchParams.get("itemId");
    const targetItem = requestedItemId
      ? allItems.find((i) => i.id === requestedItemId)
      : allItems[0];

    const allItemsList = allItems.map((it) => {
      const b = bidangMap[it.bidangId];
      return {
        id: it.id,
        bidangId: it.bidangId,
        bidangNama: b?.nama || it.bidangId,
        bidangKode: b?.kode || "-",
        kode: it.kode,
        nama: it.nama,
        satuan: it.satuanId ? unitMap[it.satuanId] || "-" : "-",
      };
    });

    if (!targetItem) {
      return NextResponse.json({
        type: "KARTU_BARANG",
        isAllBidang,
        itemsList: allItemsList,
        item: null,
        agency,
        bidang: reportBidang,
        rows: [],
      });
    }

    const itemBidang = bidangMap[targetItem.bidangId];

    // Kolektor yang sama dengan Kartu Stok: memuat baris saldo awal, penerimaan,
    // pengeluaran, dan penyesuaian stock opname agar angkanya konsisten.
    const ledgerRows = buildLedger(
      await collectItemLedger(db, targetItem.bidangId, targetItem.id)
    );
    const lastRow = ledgerRows.length > 0 ? ledgerRows[ledgerRows.length - 1] : undefined;
    const currentStock = lastRow?.saldoQty ?? 0;
    const currentValue = lastRow?.saldoNilai ?? 0;

    const ledger = ledgerRows.map((e) => ({
      tanggal: e.tanggal,
      tipe: e.tipe,
      nomorDokumen: e.nomorDokumen,
      keterangan: e.keterangan,
      inQty: e.tipe === "IN" ? e.qty : 0,
      hargaSatuan: e.hargaSatuan,
      inNilai: e.tipe === "IN" ? e.totalNilai : 0,
      outQty: e.tipe === "OUT" ? e.qty : 0,
      outNilai: e.tipe === "OUT" ? e.totalNilai : 0,
      saldoQty: e.saldoQty,
      saldoNilai: e.saldoNilai,
    }));

    return NextResponse.json({
      type: "KARTU_BARANG",
      isAllBidang,
      itemsList: allItemsList,
      item: {
        ...targetItem,
        bidangId: targetItem.bidangId,
        bidangNama: itemBidang?.nama || targetItem.bidangId,
        bidangKode: itemBidang?.kode || "-",
        satuanNama: targetItem.satuanId ? unitMap[targetItem.satuanId] || "-" : "-",
        kategoriNama: targetItem.kategoriId ? categoryMap[targetItem.kategoriId] || "-" : "-",
      },
      currentStock,
      currentValue,
      agency,
      bidang: isAllBidang ? reportBidang : (itemBidang || reportBidang),
      rows: ledger,
    });
  }

  return NextResponse.json({ error: "Tipe laporan tidak dikenali" }, { status: 400 });
}
