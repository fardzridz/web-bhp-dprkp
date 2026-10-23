"use client";

import { useState, useEffect } from "react";
import { formatRupiah } from "@/lib/format";
import {
  Boxes,
  Printer,
  Calendar,
  Layers,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
} from "lucide-react";

interface ItemOption {
  id: string;
  kode: string;
  nama: string;
  satuanNama: string;
  stok: number;
}

interface StockCardData {
  item: {
    id: string;
    kode: string;
    nama: string;
    satuanNama: string;
  };
  currentStock: number;
  currentValue: number;
  activeLayers: Array<{
    id: string;
    tanggal: string;
    hargaSatuan: number;
    jumlahAwal: number;
    sisa: number;
  }>;
  ledger: Array<{
    tanggal: string;
    tipe: "IN" | "OUT";
    nomorDokumen: string;
    keterangan: string;
    inQty: number;
    hargaSatuan: number;
    inNilai: number;
    outQty: number;
    outNilai: number;
    saldoQty: number;
    saldoNilai: number;
  }>;
}

export default function KartuStokPage() {
  const [items, setItems] = useState<ItemOption[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [cardData, setCardData] = useState<StockCardData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchItems = async () => {
    try {
      const res = await fetch("/api/items");
      const json = await res.json();
      if (res.ok && json.data.length > 0) {
        setItems(json.data);
        setSelectedItemId(json.data[0].id);
      }
    } catch {
      // silent
    }
  };

  const fetchStockCard = async (itemId: string) => {
    if (!itemId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/stock-card?itemId=${itemId}`);
      const json = await res.json();
      if (res.ok) {
        setCardData(json);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  useEffect(() => {
    if (selectedItemId) {
      fetchStockCard(selectedItemId);
    }
  }, [selectedItemId]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center space-x-2.5">
            <Boxes className="w-6 h-6 text-emerald-600" />
            <span>Kartu Stok & Persediaan (FIFO)</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Buku catatan mutasi barang, riwayat masuk/keluar, dan pergerakan saldo persediaan fisik.
          </p>
        </div>
        <button
          onClick={() => window.print()}
          disabled={!cardData}
          className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl text-sm transition shadow flex items-center space-x-2 self-start disabled:opacity-50"
        >
          <Printer className="w-4 h-4" />
          <span>Cetak Kartu Barang</span>
        </button>
      </div>

      {/* Select Item Card */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center gap-4 no-print">
        <label className="text-xs font-bold text-slate-700 uppercase whitespace-nowrap">
          Pilih Barang:
        </label>
        <select
          value={selectedItemId}
          onChange={(e) => setSelectedItemId(e.target.value)}
          className="w-full sm:max-w-md px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white font-medium focus:ring-2 focus:ring-emerald-500"
        >
          {items.map((it) => (
            <option key={it.id} value={it.id}>
              {it.kode} — {it.nama} (Stok: {it.stok} {it.satuanNama})
            </option>
          ))}
        </select>
      </div>

      {cardData && (
        <>
          {/* Item Summary Card */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Barang & Satuan
              </div>
              <div className="text-lg font-bold text-slate-900 mt-1">
                {cardData.item.nama}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Kode: <span className="font-mono">{cardData.item.kode}</span> • Satuan: <strong>{cardData.item.satuanNama}</strong>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Sisa Stok Fisik
              </div>
              <div className="text-2xl font-bold text-emerald-700 mt-1">
                {cardData.currentStock} {cardData.item.satuanNama}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">Tersedia di gudang / ruangan</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Nilai Persediaan
              </div>
              <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
                {formatRupiah(cardData.currentValue)}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">Berdasarkan batch FIFO aktif</div>
            </div>
          </div>

          {/* Active FIFO Layers Breakdown */}
          {cardData.activeLayers.length > 0 && (
            <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-5 no-print">
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-900 mb-3 flex items-center space-x-2">
                <Layers className="w-4 h-4 text-emerald-700" />
                <span>Lapisan Harga FIFO Aktif (Active FIFO Layers)</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {cardData.activeLayers.map((l) => (
                  <div key={l.id} className="bg-white p-3 rounded-xl border border-emerald-200 shadow-sm text-xs">
                    <div className="text-slate-500">Batch: <strong>{l.tanggal}</strong></div>
                    <div className="text-sm font-bold text-slate-800 mt-1">
                      {l.sisa} {cardData.item.satuanNama} @ {formatRupiah(l.hargaSatuan)}
                    </div>
                    <div className="text-[11px] text-emerald-700 font-mono mt-0.5">
                      Nilai: {formatRupiah(l.sisa * l.hargaSatuan)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chronological Ledger Table (Lampiran 11 format) */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="font-bold text-sm text-slate-800 uppercase tracking-wide">
                Buku Catatan Persediaan Barang (Ledger Mutasi)
              </div>
              <div className="text-xs text-slate-500">
                Total Mutasi: {cardData.ledger.length} kali
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700 border-collapse">
                <thead className="bg-slate-100 text-slate-600 font-semibold uppercase border-b border-slate-200">
                  <tr>
                    <th rowSpan={2} className="px-4 py-3 border-r border-slate-200 text-center">Tanggal</th>
                    <th rowSpan={2} className="px-4 py-3 border-r border-slate-200">No. Dokumen & Keterangan</th>
                    <th colSpan={3} className="px-4 py-2 border-r border-slate-200 text-center bg-emerald-50 text-emerald-900">
                      Penerimaan (Masuk)
                    </th>
                    <th colSpan={3} className="px-4 py-2 border-r border-slate-200 text-center bg-blue-50 text-blue-900">
                      Pengeluaran (Keluar)
                    </th>
                    <th colSpan={2} className="px-4 py-2 text-center bg-slate-200 text-slate-800">
                      Saldo Sisa
                    </th>
                  </tr>
                  <tr className="border-b border-slate-200 text-[10px]">
                    <th className="px-3 py-1.5 text-right border-r border-slate-200 bg-emerald-50">Banyak</th>
                    <th className="px-3 py-1.5 text-right border-r border-slate-200 bg-emerald-50">Harga Satuan</th>
                    <th className="px-3 py-1.5 text-right border-r border-slate-200 bg-emerald-50">Jumlah (Rp)</th>
                    <th className="px-3 py-1.5 text-right border-r border-slate-200 bg-blue-50">Banyak</th>
                    <th className="px-3 py-1.5 text-right border-r border-slate-200 bg-blue-50">Harga Satuan</th>
                    <th className="px-3 py-1.5 text-right border-r border-slate-200 bg-blue-50">Jumlah (Rp)</th>
                    <th className="px-3 py-1.5 text-right border-r border-slate-200 bg-slate-100">Banyak</th>
                    <th className="px-3 py-1.5 text-right bg-slate-100">Jumlah (Rp)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cardData.ledger.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-6 py-8 text-center text-slate-400">
                        Belum ada mutasi penerimaan atau pengeluaran untuk barang ini.
                      </td>
                    </tr>
                  ) : (
                    cardData.ledger.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-3 whitespace-nowrap text-center font-medium border-r border-slate-100">
                          {row.tanggal}
                        </td>
                        <td className="px-4 py-3 border-r border-slate-100">
                          <div className="font-semibold text-slate-900 font-mono text-[11px]">
                            {row.nomorDokumen}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {row.keterangan}
                          </div>
                        </td>

                        {/* In */}
                        <td className="px-3 py-3 text-right font-medium text-emerald-700 border-r border-slate-100">
                          {row.inQty > 0 ? row.inQty : "-"}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-slate-600 border-r border-slate-100">
                          {row.inQty > 0 ? formatRupiah(row.hargaSatuan) : "-"}
                        </td>
                        <td className="px-3 py-3 text-right font-mono font-semibold text-emerald-800 border-r border-slate-100">
                          {row.inNilai > 0 ? formatRupiah(row.inNilai) : "-"}
                        </td>

                        {/* Out */}
                        <td className="px-3 py-3 text-right font-medium text-blue-700 border-r border-slate-100">
                          {row.outQty > 0 ? row.outQty : "-"}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-slate-600 border-r border-slate-100">
                          {row.outQty > 0 ? formatRupiah(row.hargaSatuan) : "-"}
                        </td>
                        <td className="px-3 py-3 text-right font-mono font-semibold text-blue-800 border-r border-slate-100">
                          {row.outNilai > 0 ? formatRupiah(row.outNilai) : "-"}
                        </td>

                        {/* Balance */}
                        <td className="px-3 py-3 text-right font-bold text-slate-900 border-r border-slate-100">
                          {row.saldoQty}
                        </td>
                        <td className="px-3 py-3 text-right font-mono font-bold text-slate-900">
                          {formatRupiah(row.saldoNilai)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
