import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db, schema } from "@/db";
import { eq, and, lte, gte, asc } from "drizzle-orm";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || !session.activeBidangId) {
    return NextResponse.json({ error: "Unauthorized / Bidang belum dipilih" }, { status: 401 });
  }

  const activeBidangId = session.activeBidangId;
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "MUTASI";
  const startDate = searchParams.get("startDate") || "2026-01-01";
  const endDate = searchParams.get("endDate") || "2026-12-31";

  // 1. Fetch SKPD and Bidang metadata for signature blocks
  const agencyRows = await db.query.agencySettings.findMany();
  const agency: Record<string, string> = {};
  for (const r of agencyRows) agency[r.key] = r.value;

  const bidang = await db.query.bidang.findFirst({
    where: eq(schema.bidang.id, activeBidangId),
  });

  const allItems = await db.query.items.findMany({
    where: eq(schema.items.bidangId, activeBidangId),
    orderBy: (i, { asc }) => [asc(i.nama)],
  });

  const categories = await db.query.categories.findMany({
    where: eq(schema.categories.bidangId, activeBidangId),
  });
  const categoryMap: Record<string, string> = {};
  for (const c of categories) categoryMap[c.id] = c.nama;

  const units = await db.query.units.findMany();
  const unitMap: Record<string, string> = {};
  for (const u of units) unitMap[u.id] = u.nama;

  // 2. Branch according to report type
  if (type === "MUTASI") {
    // Calculate Opening, Incoming, Outgoing, Closing per item
    // Receipts
    const allReceipts = await db.query.receipts.findMany({
      where: eq(schema.receipts.bidangId, activeBidangId),
    });
    const receiptMap: Record<string, typeof allReceipts[0]> = {};
    for (const r of allReceipts) receiptMap[r.id] = r;

    const allReceiptItems = await db.query.receiptItems.findMany();

    // Issues
    const allIssues = await db.query.issues.findMany({
      where: eq(schema.issues.bidangId, activeBidangId),
    });
    const issueMap: Record<string, typeof allIssues[0]> = {};
    for (const i of allIssues) issueMap[i.id] = i;

    const allIssueItems = await db.query.issueItems.findMany();

    // Aggregates
    interface ItemMutation {
      id: string;
      kode: string;
      nama: string;
      kategori: string;
      satuan: string;
      openingQty: number;
      openingValue: number;
      incomingQty: number;
      incomingValue: number;
      outgoingQty: number;
      outgoingValue: number;
      closingQty: number;
      closingValue: number;
    }

    const mutationMap: Record<string, ItemMutation> = {};
    for (const item of allItems) {
      mutationMap[item.id] = {
        id: item.id,
        kode: item.kode,
        nama: item.nama,
        kategori: item.kategoriId ? categoryMap[item.kategoriId] || "-" : "-",
        satuan: item.satuanId ? unitMap[item.satuanId] || "-" : "-",
        openingQty: 0,
        openingValue: 0,
        incomingQty: 0,
        incomingValue: 0,
        outgoingQty: 0,
        outgoingValue: 0,
        closingQty: 0,
        closingValue: 0,
      };
    }

    // Process receipts
    for (const ri of allReceiptItems) {
      const parent = receiptMap[ri.receiptId];
      if (!parent || !mutationMap[ri.itemId]) continue;

      if (parent.tanggal < startDate) {
        mutationMap[ri.itemId].openingQty += ri.jumlah;
        mutationMap[ri.itemId].openingValue += ri.jumlahHarga;
      } else if (parent.tanggal <= endDate) {
        mutationMap[ri.itemId].incomingQty += ri.jumlah;
        mutationMap[ri.itemId].incomingValue += ri.jumlahHarga;
      }
    }

    // Process issues
    for (const ii of allIssueItems) {
      const parent = issueMap[ii.issueId];
      if (!parent || !mutationMap[ii.itemId]) continue;

      if (parent.tanggal < startDate) {
        mutationMap[ii.itemId].openingQty -= ii.jumlah;
        mutationMap[ii.itemId].openingValue -= ii.totalNilaiFifo;
      } else if (parent.tanggal <= endDate) {
        mutationMap[ii.itemId].outgoingQty += ii.jumlah;
        mutationMap[ii.itemId].outgoingValue += ii.totalNilaiFifo;
      }
    }

    // Finalize closing
    const rows = Object.values(mutationMap).map((m) => {
      const closingQty = m.openingQty + m.incomingQty - m.outgoingQty;
      const closingValue = m.openingValue + m.incomingValue - m.outgoingValue;
      return {
        ...m,
        closingQty: Math.max(0, closingQty),
        closingValue: Math.max(0, closingValue),
      };
    });

    return NextResponse.json({
      type: "MUTASI",
      startDate,
      endDate,
      agency,
      bidang,
      rows,
    });
  }

  if (type === "PENERIMAAN") {
    // Buku Penerimaan Barang (Lampiran 8)
    const receiptsList = await db.query.receipts.findMany({
      where: and(
        eq(schema.receipts.bidangId, activeBidangId),
        gte(schema.receipts.tanggal, startDate),
        lte(schema.receipts.tanggal, endDate)
      ),
      orderBy: [asc(schema.receipts.tanggal), asc(schema.receipts.createdAt)],
    });

    const itemMap: Record<string, { nama: string; satuan: string; kategori: string }> = {};
    for (const item of allItems) {
      itemMap[item.id] = {
        nama: item.nama,
        kategori: item.kategoriId ? categoryMap[item.kategoriId] || "-" : "-",
        satuan: item.satuanId ? unitMap[item.satuanId] || "-" : "-",
      };
    }

    const flatRows = [];
    for (const r of receiptsList) {
      const items = await db.query.receiptItems.findMany({
        where: eq(schema.receiptItems.receiptId, r.id),
      });

      for (const it of items) {
        const meta = itemMap[it.itemId] || { nama: "-", satuan: "-", kategori: "-" };
        flatRows.push({
          tanggal: r.tanggal,
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
      startDate,
      endDate,
      agency,
      bidang,
      rows: flatRows,
    });
  }

  if (type === "PENGELUARAN") {
    // Buku Pengeluaran Barang (Lampiran 9)
    const issuesList = await db.query.issues.findMany({
      where: and(
        eq(schema.issues.bidangId, activeBidangId),
        gte(schema.issues.tanggal, startDate),
        lte(schema.issues.tanggal, endDate)
      ),
      orderBy: [asc(schema.issues.tanggal), asc(schema.issues.createdAt)],
    });

    const itemMap: Record<string, { nama: string; satuan: string; kategori: string }> = {};
    for (const item of allItems) {
      itemMap[item.id] = {
        nama: item.nama,
        kategori: item.kategoriId ? categoryMap[item.kategoriId] || "-" : "-",
        satuan: item.satuanId ? unitMap[item.satuanId] || "-" : "-",
      };
    }

    const flatRows = [];
    for (const iss of issuesList) {
      const items = await db.query.issueItems.findMany({
        where: eq(schema.issueItems.issueId, iss.id),
      });

      for (const it of items) {
        const meta = itemMap[it.itemId] || { nama: "-", satuan: "-", kategori: "-" };
        const unitPrice = it.jumlah > 0 ? it.totalNilaiFifo / it.jumlah : 0;
        flatRows.push({
          tanggal: iss.tanggal,
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
      startDate,
      endDate,
      agency,
      bidang,
      rows: flatRows,
    });
  }

  return NextResponse.json({ error: "Tipe laporan tidak dikenali" }, { status: 400 });
}
