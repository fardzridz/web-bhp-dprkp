import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { errorResponse } from "@/lib/inventory";
import { averageUnitValue } from "@/lib/stock";
import { computeStockAsOf } from "../stock-as-of";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Kertas kerja opname: stok & nilai sistem per barang pada tanggal tertentu. */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session || (!session.activeBidangId && !session.bidangId)) {
    return NextResponse.json({ error: "Unauthorized / Bidang belum dipilih" }, { status: 401 });
  }

  const activeBidangId =
    session.role === "SUPERADMIN"
      ? session.activeBidangId!
      : (session.bidangId || session.activeBidangId)!;

  try {
    const { searchParams } = new URL(request.url);
    const tanggal = searchParams.get("tanggal") || todayISO();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
      return NextResponse.json({ error: "Tanggal tidak sah (format YYYY-MM-DD)." }, { status: 400 });
    }

    const items = await db.query.items.findMany({
      where: eq(schema.items.bidangId, activeBidangId),
      orderBy: (i, { asc: ascFn }) => [ascFn(i.nama)],
    });

    const categories = await db.query.categories.findMany({
      where: eq(schema.categories.bidangId, activeBidangId),
      columns: { id: true, nama: true },
    });
    const categoryMap = new Map(categories.map((c) => [c.id, c.nama]));
    const units = await db.query.units.findMany({ columns: { id: true, nama: true } });
    const unitMap = new Map(units.map((u) => [u.id, u.nama]));

    const summaries = await computeStockAsOf(
      db,
      activeBidangId,
      tanggal,
      items.map((i) => i.id)
    );

    const rows = items.map((item) => {
      const summary = summaries.get(item.id);
      const stokSistem = summary?.closingQty ?? 0;
      const nilaiSistem = summary?.closingValue ?? 0;
      return {
        itemId: item.id,
        kode: item.kode,
        nama: item.nama,
        kategori: item.kategoriId ? categoryMap.get(item.kategoriId) || "-" : "-",
        satuan: item.satuanId ? unitMap.get(item.satuanId) || "-" : "-",
        stokSistem,
        nilaiSistem,
        hargaSatuanSistem: averageUnitValue(stokSistem, nilaiSistem),
      };
    });

    return NextResponse.json({
      tanggal,
      rows,
      summary: {
        jumlahBarang: rows.length,
        totalNilaiSistem: rows.reduce((s, r) => s + r.nilaiSistem, 0),
      },
    });
  } catch (err: unknown) {
    return errorResponse(err);
  }
}
