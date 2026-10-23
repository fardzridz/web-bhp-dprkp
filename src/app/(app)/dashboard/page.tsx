import { getSession } from "@/lib/session";
import { db, schema } from "@/db";
import { eq, desc, and } from "drizzle-orm";
import { formatRupiah } from "@/lib/format";
import Link from "next/link";
import {
  Package,
  Boxes,
  ArrowDownLeft,
  ArrowUpRight,
  AlertTriangle,
  FileText,
  Building2,
} from "lucide-react";

export default async function DashboardPage() {
  const session = await getSession();
  const activeBidangId = session?.role === "SUPERADMIN" ? session?.activeBidangId : (session?.bidangId || session?.activeBidangId);

  if (!activeBidangId) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
        <Building2 className="w-12 h-12 text-slate-400 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-800">Belum ada Bidang yang dipilih</h2>
        <p className="text-sm text-slate-500 mt-1">
          Silakan pilih bidang kerja Anda melalui dropdown di bagian atas.
        </p>
      </div>
    );
  }

  // 1. Fetch active bidang data
  const bidang = await db.query.bidang.findFirst({
    where: eq(schema.bidang.id, activeBidangId),
  });

  // 2. Count Master Items for this bidang
  const items = await db.query.items.findMany({
    where: eq(schema.items.bidangId, activeBidangId),
  });

  // 3. Calculate stock & inventory value from active FIFO layers
  const fifoList = await db.query.fifoLayers.findMany({
    where: and(
      eq(schema.fifoLayers.bidangId, activeBidangId),
      eq(schema.fifoLayers.status, "ACTIVE")
    ),
  });

  const stockByItemId: Record<string, number> = {};
  let totalInventoryValue = 0;

  for (const layer of fifoList) {
    stockByItemId[layer.itemId] = (stockByItemId[layer.itemId] || 0) + layer.sisa;
    totalInventoryValue += layer.sisa * layer.hargaSatuan;
  }

  // 4. Critical Stock items (stock <= minStock)
  const lowStockItems = items.filter((item) => {
    const currentStock = stockByItemId[item.id] || 0;
    return currentStock <= (item.stokMinimum || 0);
  });

  // 5. Recent Receipts
  const recentReceipts = await db.query.receipts.findMany({
    where: eq(schema.receipts.bidangId, activeBidangId),
    orderBy: [desc(schema.receipts.createdAt)],
    limit: 5,
  });

  // 6. Recent Issues
  const recentIssues = await db.query.issues.findMany({
    where: eq(schema.issues.bidangId, activeBidangId),
    orderBy: [desc(schema.issues.createdAt)],
    limit: 5,
  });

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-emerald-800 to-teal-900 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 bg-emerald-700/60 px-3 py-1 rounded-full text-xs font-medium text-emerald-200 mb-2 border border-emerald-600/40">
              <Building2 className="w-3.5 h-3.5" />
              <span>Lingkup Bidang: {bidang?.nama} ({bidang?.kode})</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              Selamat Datang, {session?.nama}
            </h1>
            <p className="text-sm text-emerald-100/90 mt-1 max-w-2xl">
              Pengelolaan dan Penatausahaan Barang Habis Pakai (BHP) Persediaan DPRKP Kota Pasuruan.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/transaksi/masuk"
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-semibold rounded-xl text-sm transition shadow-md flex items-center space-x-2"
            >
              <ArrowDownLeft className="w-4 h-4" />
              <span>Barang Masuk</span>
            </Link>
            <Link
              href="/transaksi/keluar"
              className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-800 font-semibold rounded-xl text-sm transition shadow-md flex items-center space-x-2"
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>Buat BAST</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Total Master Barang
            </div>
            <div className="text-2xl font-bold text-slate-800 mt-0.5">
              {items.length}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">Katalog bidang ini</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <Boxes className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Nilai Persediaan FIFO
            </div>
            <div className="text-xl font-bold text-slate-800 mt-0.5 truncate">
              {formatRupiah(totalInventoryValue)}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">Saldo fisik saat ini</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
            <ArrowDownLeft className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Riwayat Penerimaan
            </div>
            <div className="text-2xl font-bold text-slate-800 mt-0.5">
              {recentReceipts.length}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">Transaksi masuk</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
            <ArrowUpRight className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Riwayat Pengeluaran
            </div>
            <div className="text-2xl font-bold text-slate-800 mt-0.5">
              {recentIssues.length}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">Dokumen BAST</div>
          </div>
        </div>
      </div>

      {/* Low Stock Warning if any */}
      {lowStockItems.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-center space-x-2 text-amber-800 font-semibold text-sm mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Perhatian: Ada {lowStockItems.length} Barang Mencapai Batas Minimum / Kosong</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {lowStockItems.slice(0, 6).map((item) => (
              <span
                key={item.id}
                className="px-2.5 py-1 bg-white border border-amber-200 text-amber-900 rounded-lg text-xs"
              >
                <strong>{item.nama}</strong>: Sisa {stockByItemId[item.id] || 0}
              </span>
            ))}
            {lowStockItems.length > 6 && (
              <span className="text-xs text-amber-700 self-center">
                +{lowStockItems.length - 6} lainnya
              </span>
            )}
          </div>
        </div>
      )}

      {/* Recent Transactions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-800 flex items-center space-x-2">
              <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
              <span>Penerimaan Terakhir</span>
            </h2>
            <Link href="/transaksi/masuk" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">
              Lihat Semua &rarr;
            </Link>
          </div>
          {recentReceipts.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              Belum ada transaksi penerimaan barang di bidang ini.
            </div>
          ) : (
            <div className="space-y-3">
              {recentReceipts.map((r) => (
                <div key={r.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-sm text-slate-800">
                      {r.nomorDokumen}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Vendor: {r.vendorNama || "-"} • No Faktur: {r.noFaktur || "-"}
                    </div>
                  </div>
                  <div className="text-xs text-slate-400 font-medium">
                    {r.tanggal}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-800 flex items-center space-x-2">
              <ArrowUpRight className="w-4 h-4 text-blue-600" />
              <span>Pengeluaran / BAST Terakhir</span>
            </h2>
            <Link href="/transaksi/keluar" className="text-xs font-semibold text-blue-600 hover:text-blue-700">
              Lihat Semua &rarr;
            </Link>
          </div>
          {recentIssues.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              Belum ada transaksi pengeluaran barang di bidang ini.
            </div>
          ) : (
            <div className="space-y-3">
              {recentIssues.map((iss) => (
                <div key={iss.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-sm text-slate-800">
                      {iss.nomorDokumen}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Penerima: {iss.penerima} • {iss.keperluan || "Operasional"}
                    </div>
                  </div>
                  <div className="text-xs text-slate-400 font-medium">
                    {iss.tanggal}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Report Links */}
      <div className="bg-slate-900 rounded-2xl p-6 text-white flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-emerald-400">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-base">Cetak Laporan Resmi Persediaan</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Cetak Buku Penerimaan (Lamp. 8), Buku Pengeluaran (Lamp. 9), Kartu Barang (Lamp. 11), dan Laporan Mutasi Triwulan / Semester.
            </p>
          </div>
        </div>
        <Link
          href="/laporan"
          className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition shadow"
        >
          Buka Modul Laporan
        </Link>
      </div>
    </div>
  );
}
