"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  Printer,
  Calendar,
  Building2,
  FileSpreadsheet,
  Boxes,
  ArrowDownLeft,
} from "lucide-react";

type ReportType = "MUTASI" | "PENERIMAAN" | "KARTU_BARANG";

interface MutasiRow {
  id: string;
  kode: string;
  nama: string;
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

interface PenerimaanRow {
  tanggal: string;
  vendor: string;
  noFaktur: string;
  tglFaktur: string;
  noBa: string;
  tglBa: string;
  namaBarang: string;
  jumlah: number;
  satuan: string;
  hargaSatuan: number;
  jumlahHarga: number;
}

interface KartuRow {
  tanggal: string;
  nomorDokumen: string;
  keterangan: string;
  inQty: number;
  hargaSatuan: number;
  inNilai: number;
  outQty: number;
  outNilai: number;
  saldoQty: number;
  saldoNilai: number;
}

interface ItemOption {
  id: string;
  kode: string;
  nama: string;
  satuan: string;
}

interface BidangTab {
  id: string;
  nama: string;
  kode: string;
}

interface ReportResponse {
  type: ReportType;
  startDate?: string;
  endDate?: string;
  agency?: Record<string, string>;
  bidang?: {
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
  item?: {
    id: string;
    kode: string;
    nama: string;
    satuanNama: string;
    kategoriNama: string;
  } | null;
  itemsList?: ItemOption[];
  currentStock?: number;
  currentValue?: number;
  rows: unknown[];
}

export default function LaporanPage() {
  const [reportType, setReportType] = useState<ReportType>("MUTASI");
  const [bidangTabs, setBidangTabs] = useState<BidangTab[]>([]);
  const [activeBidangId, setActiveBidangId] = useState<string>("");
  const [selectedItemId, setSelectedItemId] = useState<string>("");

  const [year, setYear] = useState("2026");
  const [startDate, setStartDate] = useState("2026-01-01");
  const [endDate, setEndDate] = useState("2026-06-30");
  const [activePreset, setActivePreset] = useState("SEMESTER_1");

  const [reportData, setReportData] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchInitialData = async () => {
    try {
      const [bRes, meRes] = await Promise.all([
        fetch("/api/bidang"),
        fetch("/api/auth/me"),
      ]);
      const bJson = await bRes.json();
      const meJson = await meRes.json();

      if (bJson.data) setBidangTabs(bJson.data);
      if (meJson.activeBidang?.id) {
        setActiveBidangId(meJson.activeBidang.id);
      } else if (bJson.data?.length > 0) {
        setActiveBidangId(bJson.data[0].id);
      }
    } catch {
      // silent
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const applyPreset = (preset: string, y = year) => {
    setActivePreset(preset);
    if (preset === "TRIWULAN_1") {
      setStartDate(`${y}-01-01`);
      setEndDate(`${y}-03-31`);
    } else if (preset === "TRIWULAN_2") {
      setStartDate(`${y}-04-01`);
      setEndDate(`${y}-06-30`);
    } else if (preset === "TRIWULAN_3") {
      setStartDate(`${y}-07-01`);
      setEndDate(`${y}-09-30`);
    } else if (preset === "TRIWULAN_4") {
      setStartDate(`${y}-10-01`);
      setEndDate(`${y}-12-31`);
    } else if (preset === "SEMESTER_1") {
      setStartDate(`${y}-01-01`);
      setEndDate(`${y}-06-30`);
    } else if (preset === "SEMESTER_2") {
      setStartDate(`${y}-07-01`);
      setEndDate(`${y}-12-31`);
    } else if (preset === "TAHUNAN") {
      setStartDate(`${y}-01-01`);
      setEndDate(`${y}-12-31`);
    }
  };

  const fetchReport = async () => {
    if (!activeBidangId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        type: reportType,
        bidangId: activeBidangId,
        startDate,
        endDate,
      });
      if (reportType === "KARTU_BARANG" && selectedItemId) {
        params.set("itemId", selectedItemId);
      }

      const res = await fetch(`/api/reports?${params.toString()}`);
      const json = await res.json();
      if (res.ok) {
        setReportData(json);
        if (json.itemsList && json.itemsList.length > 0 && !selectedItemId) {
          setSelectedItemId(json.itemsList[0].id);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [reportType, activeBidangId, startDate, endDate, selectedItemId]);

  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(num);
  };

  const formatDateIndo = (dStr: string) => {
    if (!dStr) return "-";
    const d = new Date(dStr);
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(d);
  };

  return (
    <div className="space-y-6">
      {/* Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center space-x-2.5">
            <FileText className="w-6 h-6 text-emerald-600" />
            <span>Laporan Resmi Persediaan BHP</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Buku Penerimaan, Kartu Barang, dan Laporan Mutasi Persediaan per Unit Kerja beserta tanda tangan resmi.
          </p>
        </div>
        <button
          onClick={() => window.print()}
          disabled={!reportData || loading}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-sm transition shadow flex items-center space-x-2 self-start disabled:opacity-50"
        >
          <Printer className="w-4 h-4" />
          <span>Cetak Dokumen Resmi</span>
        </button>
      </div>

      {/* 1. Sub-Menu Per Unit Kerja (Bidang) */}
      {bidangTabs.length > 0 && (
        <div className="bg-slate-100 p-1.5 rounded-2xl flex items-center space-x-1.5 overflow-x-auto no-print">
          <span className="text-[11px] font-bold text-slate-500 uppercase px-3 whitespace-nowrap">
            Laporan Bidang:
          </span>
          {bidangTabs.map((b) => {
            const isSelected = activeBidangId === b.id;
            return (
              <button
                key={b.id}
                onClick={() => {
                  setActiveBidangId(b.id);
                  setSelectedItemId("");
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 whitespace-nowrap ${
                  isSelected
                    ? "bg-white text-emerald-800 shadow-sm border border-slate-200/80"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                }`}
              >
                <Building2 className={`w-3.5 h-3.5 ${isSelected ? "text-emerald-600" : "text-slate-400"}`} />
                <span>{b.nama}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                    isSelected ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {b.kode}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* 2. Tiga Jenis Dokumen (Buku Penerimaan, Kartu Barang, Laporan Mutasi) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 no-print">
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Pilih Format Dokumen:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setReportType("MUTASI")}
              className={`p-3 rounded-xl border text-left transition flex items-start space-x-3 ${
                reportType === "MUTASI"
                  ? "bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-900"
                  : "border-slate-200 hover:bg-slate-50 text-slate-700"
              }`}
            >
              <FileSpreadsheet className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-bold text-sm">Laporan Mutasi Persediaan</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Saldo Awal, Masuk, Keluar & Saldo Akhir per Periode
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setReportType("PENERIMAAN")}
              className={`p-3 rounded-xl border text-left transition flex items-start space-x-3 ${
                reportType === "PENERIMAAN"
                  ? "bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-900"
                  : "border-slate-200 hover:bg-slate-50 text-slate-700"
              }`}
            >
              <ArrowDownLeft className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-bold text-sm">Buku Penerimaan Barang</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Rekapitulasi Barang Masuk, Rekanan, Faktur & BA
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setReportType("KARTU_BARANG")}
              className={`p-3 rounded-xl border text-left transition flex items-start space-x-3 ${
                reportType === "KARTU_BARANG"
                  ? "bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-900"
                  : "border-slate-200 hover:bg-slate-50 text-slate-700"
              }`}
            >
              <Boxes className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-bold text-sm">Kartu Barang (Lampiran 11)</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Catatan Mutasi & Saldo per Satuan Item Barang
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Item Selector if Kartu Barang */}
        {reportType === "KARTU_BARANG" && reportData?.itemsList && reportData.itemsList.length > 0 && (
          <div className="pt-2 border-t border-slate-100 flex items-center gap-3">
            <label className="text-xs font-bold text-slate-700 uppercase whitespace-nowrap">
              Pilih Item Barang:
            </label>
            <select
              value={selectedItemId || reportData.item?.id || ""}
              onChange={(e) => setSelectedItemId(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium bg-white focus:ring-2 focus:ring-emerald-500"
            >
              {reportData.itemsList.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.kode} — {it.nama} ({it.satuan})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Period Presets (For Mutasi & Penerimaan) */}
        {reportType !== "KARTU_BARANG" && (
          <>
            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase mr-1">Periode:</span>
              {[
                { id: "TRIWULAN_1", label: "Triwulan I" },
                { id: "TRIWULAN_2", label: "Triwulan II" },
                { id: "TRIWULAN_3", label: "Triwulan III" },
                { id: "TRIWULAN_4", label: "Triwulan IV" },
                { id: "SEMESTER_1", label: "Semester I" },
                { id: "SEMESTER_2", label: "Semester II" },
                { id: "TAHUNAN", label: "1 Tahun" },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    activePreset === p.id
                      ? "bg-emerald-600 text-white font-semibold shadow-sm"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 max-w-md">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">
                  Dari Tanggal
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setActivePreset("CUSTOM");
                    setStartDate(e.target.value);
                  }}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">
                  Sampai Tanggal
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setActivePreset("CUSTOM");
                    setEndDate(e.target.value);
                  }}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs"
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* 3. Lembar Dokumen Siap Cetak */}
      {reportData && (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm print:p-0 print:border-none print:shadow-none">
          {/* Kop Dokumen Dinas */}
          <div className="text-center pb-4 mb-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              PEMERINTAH KABUPATEN PASURUAN
            </div>
            <h2 className="text-sm font-bold uppercase mt-0.5 text-slate-900">
              {reportData.agency?.NAMA_INSTANSI || "DINAS PERUMAHAN RAKYAT DAN KAWASAN PERMUKIMAN"}
            </h2>
            <h3 className="text-xs uppercase font-semibold text-emerald-800 mt-0.5">
              UNIT KERJA: {reportData.bidang?.nama || "DINAS"} ({reportData.bidang?.kode || "-"})
            </h3>
            <h1 className="text-base font-extrabold uppercase mt-2 underline tracking-wide">
              {reportType === "MUTASI" && "LAPORAN MUTASI BARANG PERSEDIAAN HABIS PAKAI"}
              {reportType === "PENERIMAAN" && "BUKU PENERIMAAN BARANG PERSEDIAAN"}
              {reportType === "KARTU_BARANG" && "KARTU BARANG PERSEDIAAN (LAMPIRAN 11)"}
            </h1>
            {reportType !== "KARTU_BARANG" ? (
              <p className="text-xs text-slate-600 mt-1">
                Periode: <strong>{formatDateIndo(startDate)}</strong> s.d. <strong>{formatDateIndo(endDate)}</strong>
              </p>
            ) : (
              reportData.item && (
                <p className="text-xs text-slate-700 mt-1 font-medium">
                  Nama Barang: <strong>{reportData.item.nama}</strong> ({reportData.item.kode}) • Satuan: <strong>{reportData.item.satuanNama}</strong>
                </p>
              )
            )}
          </div>

          {/* Table: Mutasi */}
          {reportType === "MUTASI" && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-slate-800 border-collapse">
                <thead className="bg-slate-100 text-slate-900 text-[11px] font-bold uppercase text-center border-b border-slate-800">
                  <tr>
                    <th rowSpan={2} className="border border-slate-800 p-2 w-10">No</th>
                    <th rowSpan={2} className="border border-slate-800 p-2">Rincian Nama Persediaan</th>
                    <th rowSpan={2} className="border border-slate-800 p-2 w-16">Satuan</th>
                    <th colSpan={2} className="border border-slate-800 p-2">Saldo Awal</th>
                    <th colSpan={2} className="border border-slate-800 p-2">Penambahan</th>
                    <th colSpan={2} className="border border-slate-800 p-2">Pengurangan</th>
                    <th colSpan={2} className="border border-slate-800 p-2">Saldo Akhir</th>
                  </tr>
                  <tr className="border-b border-slate-800 text-[10px]">
                    <th className="border border-slate-800 p-1.5 w-16">Jml</th>
                    <th className="border border-slate-800 p-1.5 w-24">Nilai (Rp)</th>
                    <th className="border border-slate-800 p-1.5 w-16">Jml</th>
                    <th className="border border-slate-800 p-1.5 w-24">Nilai (Rp)</th>
                    <th className="border border-slate-800 p-1.5 w-16">Jml</th>
                    <th className="border border-slate-800 p-1.5 w-24">Nilai (Rp)</th>
                    <th className="border border-slate-800 p-1.5 w-16">Jml</th>
                    <th className="border border-slate-800 p-1.5 w-24">Nilai (Rp)</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.rows.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="p-6 text-center text-slate-400">
                        Tidak ada data mutasi persediaan pada unit kerja ini.
                      </td>
                    </tr>
                  ) : (
                    (reportData.rows as MutasiRow[]).map((row, idx) => (
                      <tr key={row.id} className="hover:bg-slate-50">
                        <td className="border border-slate-800 p-2 text-center">{idx + 1}</td>
                        <td className="border border-slate-800 p-2 font-medium">{row.nama}</td>
                        <td className="border border-slate-800 p-2 text-center text-slate-600">{row.satuan}</td>
                        <td className="border border-slate-800 p-2 text-right">{row.openingQty}</td>
                        <td className="border border-slate-800 p-2 text-right font-mono">{formatRupiah(row.openingValue)}</td>
                        <td className="border border-slate-800 p-2 text-right font-semibold text-emerald-800">{row.incomingQty}</td>
                        <td className="border border-slate-800 p-2 text-right font-mono text-emerald-800">{formatRupiah(row.incomingValue)}</td>
                        <td className="border border-slate-800 p-2 text-right font-semibold text-blue-800">{row.outgoingQty}</td>
                        <td className="border border-slate-800 p-2 text-right font-mono text-blue-800">{formatRupiah(row.outgoingValue)}</td>
                        <td className="border border-slate-800 p-2 text-right font-bold">{row.closingQty}</td>
                        <td className="border border-slate-800 p-2 text-right font-mono font-bold">{formatRupiah(row.closingValue)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Table: Penerimaan */}
          {reportType === "PENERIMAAN" && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-slate-800 border-collapse">
                <thead className="bg-slate-100 text-slate-900 text-[11px] font-bold uppercase text-center border-b border-slate-800">
                  <tr>
                    <th rowSpan={2} className="border border-slate-800 p-2 w-10">No</th>
                    <th rowSpan={2} className="border border-slate-800 p-2 w-20">Tanggal</th>
                    <th rowSpan={2} className="border border-slate-800 p-2">Dari (Penyedia)</th>
                    <th colSpan={2} className="border border-slate-800 p-2">Faktur</th>
                    <th colSpan={2} className="border border-slate-800 p-2">BA Penerimaan</th>
                    <th rowSpan={2} className="border border-slate-800 p-2">Nama Barang</th>
                    <th rowSpan={2} className="border border-slate-800 p-2 w-16">Banyak</th>
                    <th rowSpan={2} className="border border-slate-800 p-2 w-16">Satuan</th>
                    <th rowSpan={2} className="border border-slate-800 p-2 w-24">Harga Satuan</th>
                    <th rowSpan={2} className="border border-slate-800 p-2 w-28">Jumlah Harga</th>
                  </tr>
                  <tr className="border-b border-slate-800 text-[10px]">
                    <th className="border border-slate-800 p-1.5 w-24">Nomor</th>
                    <th className="border border-slate-800 p-1.5 w-20">Tanggal</th>
                    <th className="border border-slate-800 p-1.5 w-24">Nomor</th>
                    <th className="border border-slate-800 p-1.5 w-20">Tanggal</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.rows.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="p-6 text-center text-slate-400">
                        Tidak ada transaksi penerimaan barang pada periode ini.
                      </td>
                    </tr>
                  ) : (
                    (reportData.rows as PenerimaanRow[]).map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="border border-slate-800 p-2 text-center">{idx + 1}</td>
                        <td className="border border-slate-800 p-2 text-center">{row.tanggal}</td>
                        <td className="border border-slate-800 p-2 font-medium">{row.vendor}</td>
                        <td className="border border-slate-800 p-2 font-mono text-[11px]">{row.noFaktur}</td>
                        <td className="border border-slate-800 p-2 text-center">{row.tglFaktur || "-"}</td>
                        <td className="border border-slate-800 p-2 font-mono text-[11px]">{row.noBa}</td>
                        <td className="border border-slate-800 p-2 text-center">{row.tglBa || "-"}</td>
                        <td className="border border-slate-800 p-2 font-medium">{row.namaBarang}</td>
                        <td className="border border-slate-800 p-2 text-right font-bold">{row.jumlah}</td>
                        <td className="border border-slate-800 p-2 text-center">{row.satuan}</td>
                        <td className="border border-slate-800 p-2 text-right font-mono">{formatRupiah(row.hargaSatuan)}</td>
                        <td className="border border-slate-800 p-2 text-right font-mono font-bold">{formatRupiah(row.jumlahHarga)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Table: Kartu Barang (Lampiran 11) */}
          {reportType === "KARTU_BARANG" && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-slate-800 border-collapse">
                <thead className="bg-slate-100 text-slate-900 text-[11px] font-bold uppercase text-center border-b border-slate-800">
                  <tr>
                    <th rowSpan={2} className="border border-slate-800 p-2 w-20">Tanggal</th>
                    <th rowSpan={2} className="border border-slate-800 p-2">No. Dokumen & Keterangan</th>
                    <th colSpan={3} className="border border-slate-800 p-2">Penerimaan (Masuk)</th>
                    <th colSpan={3} className="border border-slate-800 p-2">Pengeluaran (Keluar)</th>
                    <th colSpan={2} className="border border-slate-800 p-2">Saldo Sisa</th>
                  </tr>
                  <tr className="border-b border-slate-800 text-[10px]">
                    <th className="border border-slate-800 p-1.5 w-16">Banyak</th>
                    <th className="border border-slate-800 p-1.5 w-24">Harga Satuan</th>
                    <th className="border border-slate-800 p-1.5 w-24">Jumlah (Rp)</th>
                    <th className="border border-slate-800 p-1.5 w-16">Banyak</th>
                    <th className="border border-slate-800 p-1.5 w-24">Harga Satuan</th>
                    <th className="border border-slate-800 p-1.5 w-24">Jumlah (Rp)</th>
                    <th className="border border-slate-800 p-1.5 w-16">Banyak</th>
                    <th className="border border-slate-800 p-1.5 w-24">Jumlah (Rp)</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.rows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-6 text-center text-slate-400">
                        Belum ada mutasi barang untuk item ini.
                      </td>
                    </tr>
                  ) : (
                    (reportData.rows as KartuRow[]).map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="border border-slate-800 p-2 text-center">{row.tanggal}</td>
                        <td className="border border-slate-800 p-2">
                          <div className="font-semibold font-mono text-[11px]">{row.nomorDokumen}</div>
                          <div className="text-[10px] text-slate-600">{row.keterangan}</div>
                        </td>
                        <td className="border border-slate-800 p-2 text-right">{row.inQty > 0 ? row.inQty : "-"}</td>
                        <td className="border border-slate-800 p-2 text-right font-mono">{row.inQty > 0 ? formatRupiah(row.hargaSatuan) : "-"}</td>
                        <td className="border border-slate-800 p-2 text-right font-mono">{row.inNilai > 0 ? formatRupiah(row.inNilai) : "-"}</td>
                        <td className="border border-slate-800 p-2 text-right">{row.outQty > 0 ? row.outQty : "-"}</td>
                        <td className="border border-slate-800 p-2 text-right font-mono">{row.outQty > 0 ? formatRupiah(row.hargaSatuan) : "-"}</td>
                        <td className="border border-slate-800 p-2 text-right font-mono">{row.outNilai > 0 ? formatRupiah(row.outNilai) : "-"}</td>
                        <td className="border border-slate-800 p-2 text-right font-bold">{row.saldoQty}</td>
                        <td className="border border-slate-800 p-2 text-right font-mono font-bold">{formatRupiah(row.saldoNilai)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Official Signatures Footer (Seng TTD Iku) */}
          <div className="mt-8 pt-4 grid grid-cols-2 gap-8 text-xs text-center text-slate-900 leading-relaxed break-inside-avoid">
            <div>
              <div className="font-semibold text-slate-700">MENGETAHUI</div>
              <div className="font-bold uppercase mt-0.5">
                {reportData.bidang?.jabatanAtasan || "ATASAN LANGSUNG"}
              </div>
              <div className="h-20"></div>
              <div className="font-bold underline text-sm">
                {reportData.bidang?.namaAtasan || "( ................................................ )"}
              </div>
              <div>NIP. {reportData.bidang?.nipAtasan || "................................"}</div>
              <div className="text-[11px] text-slate-500">{reportData.bidang?.pangkatAtasan || ""}</div>
            </div>

            <div>
              <div className="text-slate-700">
                {reportData.agency?.TEMPAT_TTD || "Pasuruan"}, {formatDateIndo(endDate)}
              </div>
              <div className="font-bold uppercase mt-0.5">
                {reportData.bidang?.jabatanPengurus || "PENGURUS BARANG PEMBANTU"}
              </div>
              <div className="h-20"></div>
              <div className="font-bold underline text-sm">
                {reportData.bidang?.namaPengurus || "( ................................................ )"}
              </div>
              <div>NIP. {reportData.bidang?.nipPengurus || "................................"}</div>
              <div className="text-[11px] text-slate-500">{reportData.bidang?.pangkatPengurus || ""}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
