"use client";

import { useState, useEffect } from "react";
import { formatRupiah, formatResmi } from "@/lib/format";
import {
  Boxes,
  Printer,
  Layers,
  CheckSquare,
  Square,
  Loader2,
  ChevronDown,
  Filter,
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

  // Multi-select & Batch Print State
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [batchCards, setBatchCards] = useState<StockCardData[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchTitle, setBatchTitle] = useState("");

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
    if (selectedItemId && !isBatchMode) {
      fetchStockCard(selectedItemId);
    }
  }, [selectedItemId, isBatchMode]);

  // Checkbox Selection
  const toggleSelectAll = () => {
    if (selectedItemIds.length === items.length) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(items.map((i: ItemOption) => i.id));
    }
  };

  const toggleSelectItem = (id: string) => {
    setSelectedItemIds((prev: string[]) =>
      prev.includes(id) ? prev.filter((item: string) => item !== id) : [...prev, id]
    );
  };

  // Cetak Single Item
  const handlePrintSingle = () => {
    if (!cardData) return;
    setBatchCards([cardData]);
    setBatchTitle(cardData.item.nama);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  // Cetak Semua Barang
  const handlePrintAll = async () => {
    setBatchLoading(true);
    try {
      const res = await fetch("/api/stock-card?all=true");
      const json = await res.json();
      if (res.ok && json.cards) {
        setBatchCards(json.cards);
        setBatchTitle("Semua Barang");
        setTimeout(() => {
          window.print();
        }, 300);
      } else {
        alert("Gagal memuat data semua barang");
      }
    } catch (err) {
      alert("Terjadi kesalahan saat memuat data kartu stok");
    } finally {
      setBatchLoading(false);
    }
  };

  // Cetak Barang Terpilih
  const handlePrintSelected = async () => {
    if (selectedItemIds.length === 0) {
      alert("Pilih minimal 1 barang terlebih dahulu!");
      return;
    }
    setBatchLoading(true);
    try {
      const res = await fetch(`/api/stock-card?itemIds=${selectedItemIds.join(",")}`);
      const json = await res.json();
      if (res.ok && json.cards) {
        setBatchCards(json.cards);
        setBatchTitle(`${json.cards.length} Barang Terpilih`);
        setTimeout(() => {
          window.print();
        }, 300);
      } else {
        alert("Gagal memuat barang terpilih");
      }
    } catch (err) {
      alert("Terjadi kesalahan saat memuat kartu stok terpilih");
    } finally {
      setBatchLoading(false);
    }
  };

  // Komponen Cetak Sesuai Format Gambar Dokumen
  const renderOfficialPrintCard = (c: StockCardData, index: number) => {
    // 1. Tentukan Saldo Awal (jika ada di baris pertama berlabel 'SALDO AWAL')
    const firstRow = c.ledger[0];
    const isBaseline = firstRow && firstRow.nomorDokumen === "SALDO AWAL";

    const saldoAwalTanggal = isBaseline ? firstRow.tanggal : (c.ledger[0]?.tanggal || "Awal Tahun");
    const saldoAwalQty = isBaseline ? firstRow.inQty : 0;
    const saldoAwalNilai = isBaseline ? firstRow.inNilai : 0;

    // 2. Total Mutasi Penerimaan Tahun Berjalan (di luar saldo awal)
    const penerimaanLedger = c.ledger.filter(
      (r, idx) => !(idx === 0 && isBaseline) && r.tipe === "IN"
    );
    const totalPenerimaanQty = penerimaanLedger.reduce((sum, r) => sum + r.inQty, 0);
    const totalPenerimaanNilai = penerimaanLedger.reduce((sum, r) => sum + r.inNilai, 0);

    // 3. Total Pengeluaran (Persediaan Digunakan / Beban Persediaan)
    const pengeluaranLedger = c.ledger.filter((r) => r.tipe === "OUT");
    const totalPengeluaranQty = pengeluaranLedger.reduce((sum, r) => sum + r.outQty, 0);
    const totalPengeluaranNilai = pengeluaranLedger.reduce((sum, r) => sum + r.outNilai, 0);

    // 4. Saldo Akhir
    const saldoAkhirTanggal = c.ledger.length > 0 ? c.ledger[c.ledger.length - 1].tanggal : "-";
    const saldoAkhirQty = c.currentStock;
    const saldoAkhirNilai = c.currentValue;

    // 5. Total Akumulasi Mutasi Seluruh Tabel
    const totalTabelInQty = c.ledger.reduce((sum, r) => sum + r.inQty, 0);
    const totalTabelOutQty = c.ledger.reduce((sum, r) => sum + r.outQty, 0);
    const totalTabelInNilai = c.ledger.reduce((sum, r) => sum + r.inNilai, 0);

    // Jumlah baris kosong pelengkap agar tampak seperti formulir akuntansi kertas resmi
    const barisKosongCount = Math.max(0, 10 - c.ledger.length);

    return (
      <div
        key={c.item.id || index}
        className="print-page bg-white p-8 text-black text-xs font-sans print:p-0 print:m-0"
        style={{ pageBreakAfter: "always" }}
      >
        {/* Header Lembar */}
        <div className="relative mb-4">
          <div className="absolute left-0 top-0 text-sm font-bold text-slate-800">
            {index + 1}
          </div>
          <div className="text-center font-bold text-base tracking-wide uppercase">
            Kartu Barang
          </div>
        </div>

        {/* Metadata Barang */}
        <div className="mb-3 space-y-1 text-[11px] font-medium text-slate-900">
          <div className="flex">
            <span className="w-28">Nama Barang</span>
            <span className="w-4">:</span>
            <span className="font-bold">{c.item.nama}</span>
          </div>
          <div className="flex">
            <span className="w-28">Satuan</span>
            <span className="w-4">:</span>
            <span>{c.item.satuanNama}</span>
          </div>
        </div>

        {/* Tabel Mutasi Utama */}
        <table className="w-full border-collapse border border-black text-[11px]">
          <thead>
            <tr className="bg-slate-100/70 text-center font-bold border-b border-black">
              <th rowSpan={2} className="border border-black px-2 py-2 w-24">
                Tanggal
              </th>
              <th rowSpan={2} className="border border-black px-2 py-2 w-32">
                Harga Pembelian per satuan
              </th>
              <th colSpan={3} className="border border-black px-2 py-1">
                Jumlah Barang
              </th>
              <th rowSpan={2} className="border border-black px-2 py-2 w-36">
                Nilai Penerimaan Barang Persediaan
              </th>
            </tr>
            <tr className="bg-slate-100/70 text-center font-bold border-b border-black">
              <th className="border border-black px-2 py-1 w-16">Masuk</th>
              <th className="border border-black px-2 py-1 w-16">Keluar</th>
              <th className="border border-black px-2 py-1 w-16">Sisa</th>
            </tr>
          </thead>
          <tbody>
            {c.ledger.map((row, rIdx) => (
              <tr key={rIdx} className="border-b border-black">
                <td className="border border-black px-2 py-1 text-center whitespace-nowrap">
                  {row.tanggal}
                </td>
                <td className="border border-black px-2 py-1 text-right font-mono">
                  {row.inQty > 0 ? formatResmi(row.hargaSatuan) : ""}
                </td>
                <td className="border border-black px-2 py-1 text-center font-semibold">
                  {row.inQty > 0 ? row.inQty : ""}
                </td>
                <td className="border border-black px-2 py-1 text-center font-semibold">
                  {row.outQty > 0 ? row.outQty : ""}
                </td>
                <td className="border border-black px-2 py-1 text-center font-semibold">
                  {row.saldoQty}
                </td>
                <td className="border border-black px-2 py-1 text-right font-mono">
                  <div className="flex justify-between">
                    <span>Rp</span>
                    <span>{row.inNilai > 0 ? formatResmi(row.inNilai) : "-"}</span>
                  </div>
                </td>
              </tr>
            ))}

            {/* Baris Kosong Tambahan */}
            {Array.from({ length: barisKosongCount }).map((_, kIdx) => (
              <tr key={`empty-${kIdx}`} className="border-b border-black h-6">
                <td className="border border-black px-2 py-1 text-center"></td>
                <td className="border border-black px-2 py-1 text-right"></td>
                <td className="border border-black px-2 py-1 text-center"></td>
                <td className="border border-black px-2 py-1 text-center"></td>
                <td className="border border-black px-2 py-1 text-center"></td>
                <td className="border border-black px-2 py-1 text-right font-mono text-slate-400">
                  <div className="flex justify-between">
                    <span>Rp</span>
                    <span>-</span>
                  </div>
                </td>
              </tr>
            ))}

            {/* Baris Total / Jumlah */}
            <tr className="bg-slate-100/70 font-bold border-t-2 border-black">
              <td colSpan={2} className="border border-black px-3 py-1.5 text-center uppercase">
                Jumlah
              </td>
              <td className="border border-black px-2 py-1.5 text-center font-bold">
                {totalTabelInQty}
              </td>
              <td className="border border-black px-2 py-1.5 text-center font-bold">
                {totalTabelOutQty}
              </td>
              <td className="border border-black px-2 py-1.5 text-center font-bold">
                {saldoAkhirQty}
              </td>
              <td className="border border-black px-2 py-1.5 text-right font-mono font-bold">
                <div className="flex justify-between">
                  <span>Rp</span>
                  <span>{formatResmi(totalTabelInNilai)}</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Rekapitulasi Bagian Bawah */}
        <div className="mt-4 space-y-3">
          {/* 1. Ringkasan Saldo Awal - Akhir */}
          <table className="w-full border-collapse border border-black text-[11px]">
            <thead>
              <tr className="bg-slate-100/70 text-center font-bold border-b border-black">
                <th className="border border-black px-3 py-1 text-left">Keterangan</th>
                <th className="border border-black px-2 py-1 w-28 text-center">Jumlah</th>
                <th className="border border-black px-3 py-1 w-44 text-right">Nilai</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-black">
                <td className="border border-black px-3 py-1 font-medium">
                  Saldo Awal {saldoAwalTanggal}
                </td>
                <td className="border border-black px-2 py-1 text-center font-bold">
                  {saldoAwalQty}
                </td>
                <td className="border border-black px-3 py-1 text-right font-mono">
                  <div className="flex justify-between">
                    <span>Rp</span>
                    <span>{formatResmi(saldoAwalNilai)}</span>
                  </div>
                </td>
              </tr>
              <tr className="border-b border-black">
                <td className="border border-black px-3 py-1 font-medium">
                  Nilai Penerimaan Barang Persediaan Tahun Berjalan
                </td>
                <td className="border border-black px-2 py-1 text-center font-bold">
                  {totalPenerimaanQty}
                </td>
                <td className="border border-black px-3 py-1 text-right font-mono">
                  <div className="flex justify-between">
                    <span>Rp</span>
                    <span>{totalPenerimaanNilai > 0 ? formatResmi(totalPenerimaanNilai) : "-"}</span>
                  </div>
                </td>
              </tr>
              <tr className="bg-slate-50 font-bold border-b border-black">
                <td className="border border-black px-3 py-1">
                  Saldo Akhir {saldoAkhirTanggal}
                </td>
                <td className="border border-black px-2 py-1 text-center">
                  {saldoAkhirQty}
                </td>
                <td className="border border-black px-3 py-1 text-right font-mono">
                  <div className="flex justify-between">
                    <span>Rp</span>
                    <span>{formatResmi(saldoAkhirNilai)}</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* 2. Rincian Lapisan FIFO */}
          <table className="w-full border-collapse border border-black text-[11px]">
            <thead>
              <tr className="bg-slate-100/70 border-b border-black font-bold">
                <th colSpan={3} className="border border-black px-3 py-1 text-left">
                  Rincian: Metode Penilaian FIFO ☑
                </th>
              </tr>
              <tr className="bg-slate-50 text-center font-bold border-b border-black">
                <th className="border border-black px-2 py-1 w-32">Jumlah Barang</th>
                <th className="border border-black px-2 py-1 w-36">Harga Satuan</th>
                <th className="border border-black px-3 py-1 text-right">Nilai</th>
              </tr>
            </thead>
            <tbody>
              {c.activeLayers.length === 0 ? (
                <tr className="border-b border-black">
                  <td className="border border-black px-2 py-1 text-center">0</td>
                  <td className="border border-black px-2 py-1 text-center">-</td>
                  <td className="border border-black px-3 py-1 text-right font-mono">
                    <div className="flex justify-between">
                      <span>Rp</span>
                      <span>-</span>
                    </div>
                  </td>
                </tr>
              ) : (
                c.activeLayers.map((l, lIdx) => (
                  <tr key={lIdx} className="border-b border-black">
                    <td className="border border-black px-2 py-1 text-center font-bold">
                      {l.sisa}
                    </td>
                    <td className="border border-black px-2 py-1 text-right font-mono">
                      {formatResmi(l.hargaSatuan)}
                    </td>
                    <td className="border border-black px-3 py-1 text-right font-mono">
                      <div className="flex justify-between">
                        <span>Rp</span>
                        <span>{formatResmi(l.sisa * l.hargaSatuan)}</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
              {/* Garis kosong pelengkap FIFO jika cuma 1 layer */}
              {c.activeLayers.length < 3 &&
                Array.from({ length: 3 - c.activeLayers.length }).map((_, fIdx) => (
                  <tr key={`fifo-emp-${fIdx}`} className="border-b border-black h-5">
                    <td className="border border-black px-2 py-1"></td>
                    <td className="border border-black px-2 py-1"></td>
                    <td className="border border-black px-3 py-1 text-right font-mono text-slate-300">
                      <div className="flex justify-between">
                        <span>Rp</span>
                        <span>-</span>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>

          {/* 3. Beban Persediaan */}
          <table className="w-full border-collapse border border-black text-[11px] font-bold">
            <tbody>
              <tr className="bg-slate-100/70 border border-black">
                <td className="border border-black px-3 py-1.5">
                  Persediaan Yang Digunakan (Beban Persediaan)
                </td>
                <td className="border border-black px-2 py-1.5 w-28 text-center font-bold">
                  {totalPengeluaranQty}
                </td>
                <td className="border border-black px-3 py-1.5 w-44 text-right font-mono font-bold">
                  <div className="flex justify-between">
                    <span>Rp</span>
                    <span>{totalPengeluaranNilai > 0 ? formatResmi(totalPengeluaranNilai) : "-"}</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Printable Area (Hanya Muncul Pas Window.Print) */}
      <div className="hidden print:block print:w-full">
        <style dangerouslySetInnerHTML={{ __html: `
          @page {
            size: portrait;
            margin: 12mm 15mm;
          }
          @media print {
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .print-page {
              page-break-after: always;
              break-after: page;
            }
          }
        ` }} />
        {batchCards.length > 0 ? (
          batchCards.map((card, i) => renderOfficialPrintCard(card, i))
        ) : cardData ? (
          renderOfficialPrintCard(cardData, 0)
        ) : null}
      </div>

      {/* Header Layar */}
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

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsBatchMode(!isBatchMode)}
            className={`px-3.5 py-2 font-medium rounded-xl text-sm transition flex items-center space-x-1.5 border shadow-sm ${
              isBatchMode
                ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
            }`}
          >
            <Filter className="w-4 h-4" />
            <span>{isBatchMode ? "Tutup Mode Pilih" : "Pilih Banyak Barang"}</span>
          </button>

          <button
            onClick={handlePrintAll}
            disabled={batchLoading}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium rounded-xl text-sm transition shadow flex items-center space-x-2"
          >
            {batchLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Printer className="w-4 h-4" />
            )}
            <span>Cetak Semua Barang ({items.length})</span>
          </button>

          {!isBatchMode && (
            <button
              onClick={handlePrintSingle}
              disabled={!cardData || loading}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-medium rounded-xl text-sm transition shadow flex items-center space-x-2"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Kartu Ini</span>
            </button>
          )}
        </div>
      </div>

      {/* Mode Batch Print Toolbar */}
      {isBatchMode && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 no-print space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2 text-sm text-emerald-950 font-semibold">
              <button
                onClick={toggleSelectAll}
                className="flex items-center space-x-1.5 hover:text-emerald-700"
              >
                {selectedItemIds.length === items.length && items.length > 0 ? (
                  <CheckSquare className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
                <span>
                  {selectedItemIds.length === items.length
                    ? "Batal Pilih Semua"
                    : "Pilih Semua Barang"}
                </span>
              </button>
              <span className="text-slate-400">|</span>
              <span>Terpilih: {selectedItemIds.length} dari {items.length} barang</span>
            </div>

            <button
              onClick={handlePrintSelected}
              disabled={selectedItemIds.length === 0 || batchLoading}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition shadow flex items-center space-x-2 self-start"
            >
              {batchLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Printer className="w-4 h-4" />
              )}
              <span>Cetak {selectedItemIds.length} Barang Terpilih Sekaligus</span>
            </button>
          </div>

          {/* Grid Checkbox Barang */}
          <div className="max-h-52 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 pt-2 border-t border-emerald-200">
            {items.map((it) => {
              const isChecked = selectedItemIds.includes(it.id);
              return (
                <div
                  key={it.id}
                  onClick={() => toggleSelectItem(it.id)}
                  className={`p-2.5 rounded-xl border text-xs cursor-pointer flex items-center space-x-2 transition ${
                    isChecked
                      ? "bg-white border-emerald-500 shadow-sm font-semibold text-emerald-950"
                      : "bg-emerald-100/40 border-emerald-200/60 text-slate-700 hover:bg-white"
                  }`}
                >
                  {isChecked ? (
                    <CheckSquare className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  )}
                  <div className="truncate">
                    <p className="truncate">{it.nama}</p>
                    <p className="text-[10px] text-slate-400 font-normal">
                      {it.kode} • Stok: {it.stok} {it.satuanNama}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Select Item Card Single Mode */}
      {!isBatchMode && (
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
      )}

      {loading && !cardData && (
        <div className="p-12 text-center text-slate-400 text-sm no-print">
          Memuat data kartu stok...
        </div>
      )}

      {cardData && (
        <div className="space-y-6 no-print">
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
            <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-5">
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

          {/* Chronological Ledger Table (Layar Monitor) */}
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
        </div>
      )}
    </div>
  );
}
