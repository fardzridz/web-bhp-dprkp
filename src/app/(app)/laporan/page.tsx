"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  Printer,
  Calendar,
  Filter,
  Building,
  CheckCircle2,
  FileSpreadsheet,
} from "lucide-react";

type ReportType = "MUTASI" | "PENERIMAAN" | "PENGELUARAN";

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

interface PengeluaranRow {
  tanggal: string;
  nomorDokumen: string;
  penerima: string;
  keperluan: string;
  namaBarang: string;
  jumlah: number;
  satuan: string;
  hargaSatuan: number;
  jumlahHarga: number;
}

interface ReportResponse {
  type: ReportType;
  startDate: string;
  endDate: string;
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
  rows: unknown[];
}

export default function LaporanPage() {
  const [reportType, setReportType] = useState<ReportType>("MUTASI");
  const [year, setYear] = useState("2026");
  const [startDate, setStartDate] = useState("2026-01-01");
  const [endDate, setEndDate] = useState("2026-06-30");
  const [activePreset, setActivePreset] = useState("SEMESTER_1");

  const [reportData, setReportData] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(false);

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
    setLoading(true);
    try {
      const res = await fetch(
        `/api/reports?type=${reportType}&startDate=${startDate}&endDate=${endDate}`
      );
      const json = await res.json();
      if (res.ok) {
        setReportData(json);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [reportType, startDate, endDate]);

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
      {/* Title & Print Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center space-x-2.5">
            <FileText className="w-6 h-6 text-emerald-600" />
            <span>Laporan Resmi Persediaan (DPRKP)</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Cetak buku penerimaan (Lamp. 8), buku pengeluaran (Lamp. 9), dan laporan mutasi persediaan triwulan/semesteran.
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

      {/* Filter and Period Box */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 no-print">
        {/* Report Type Selector */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Pilih Jenis Dokumen Laporan:
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
                  Saldo Awal, Penambahan, Pengurangan & Saldo Akhir
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
              <FileText className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-bold text-sm">Buku Penerimaan Barang</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Format Resmi Lampiran 8 (Rekanan, Faktur & BA)
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setReportType("PENGELUARAN")}
              className={`p-3 rounded-xl border text-left transition flex items-start space-x-3 ${
                reportType === "PENGELUARAN"
                  ? "bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-900"
                  : "border-slate-200 hover:bg-slate-50 text-slate-700"
              }`}
            >
              <FileText className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-bold text-sm">Buku Pengeluaran Barang</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Format Resmi Lampiran 9 (BAST & Penyerahan)
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Quick Period Presets */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase mr-1">Periode:</span>
          {[
            { id: "TRIWULAN_1", label: "Triwulan I" },
            { id: "TRIWULAN_2", label: "Triwulan II" },
            { id: "TRIWULAN_3", label: "Triwulan III" },
            { id: "TRIWULAN_4", label: "Triwulan IV" },
            { id: "SEMESTER_1", label: "Semester I" },
            { id: "SEMESTER_2", label: "Semester II" },
            { id: "TAHUNAN", label: "1 Tahun Penuh" },
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

        {/* Custom Date Pickers */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
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
          <div className="flex items-end">
            <button
              type="button"
              onClick={fetchReport}
              className="w-full px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-medium rounded-xl text-xs transition"
            >
              Perbarui Tampilan Laporan
            </button>
          </div>
        </div>
      </div>

      {/* Render Document Area */}
      {reportData && (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm print:p-0 print:border-none print:shadow-none">
          {/* Government Official Kop Header */}
          <div className="text-center pb-4 mb-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-600">
              {reportType === "PENERIMAAN" ? "LAMPIRAN 8" : reportType === "PENGELUARAN" ? "LAMPIRAN 9" : "LAPORAN PERSURATAN & KEUANGAN"}
            </div>
            <h2 className="text-sm font-bold uppercase mt-1">
              {reportData.agency?.NAMA_INSTANSI || "DINAS PERUMAHAN RAKYAT DAN KAWASAN PERMUKIMAN"}
            </h2>
            <h3 className="text-xs uppercase font-semibold text-slate-600">
              LINGKUP: {reportData.bidang?.nama || "SELURUH BIDANG"} ({reportData.bidang?.kode || "-"})
            </h3>
            <h1 className="text-base font-extrabold uppercase mt-2 underline tracking-wide">
              {reportType === "MUTASI" && "LAPORAN MUTASI BARANG PERSEDIAAN HABIS PAKAI"}
              {reportType === "PENERIMAAN" && "BUKU PENERIMAAN BARANG PERSEDIAAN"}
              {reportType === "PENGELUARAN" && "BUKU PENGELUARAN BARANG PERSEDIAAN"}
            </h1>
            <p className="text-xs text-slate-600 mt-1">
              Periode: <strong>{formatDateIndo(startDate)}</strong> s.d. <strong>{formatDateIndo(endDate)}</strong>
            </p>
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
                        Tidak ada data mutasi persediaan pada periode ini.
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

          {/* Table: Penerimaan (Lampiran 8) */}
          {reportType === "PENERIMAAN" && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-slate-800 border-collapse">
                <thead className="bg-slate-100 text-slate-900 text-[11px] font-bold uppercase text-center border-b border-slate-800">
                  <tr>
                    <th rowSpan={2} className="border border-slate-800 p-2 w-10">No</th>
                    <th rowSpan={2} className="border border-slate-800 p-2 w-20">Tanggal</th>
                    <th rowSpan={2} className="border border-slate-800 p-2">Dari (Penyedia)</th>
                    <th colSpan={2} className="border border-slate-800 p-2">Dokumen Faktur</th>
                    <th colSpan={2} className="border border-slate-800 p-2">Dokumen BA Penerimaan</th>
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

          {/* Table: Pengeluaran (Lampiran 9) */}
          {reportType === "PENGELUARAN" && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-slate-800 border-collapse">
                <thead className="bg-slate-100 text-slate-900 text-[11px] font-bold uppercase text-center border-b border-slate-800">
                  <tr>
                    <th className="border border-slate-800 p-2 w-10">No</th>
                    <th className="border border-slate-800 p-2 w-20">Tanggal</th>
                    <th className="border border-slate-800 p-2">Nomor Dokumen / BAST</th>
                    <th className="border border-slate-800 p-2">Untuk / Penerima</th>
                    <th className="border border-slate-800 p-2">Nama Barang</th>
                    <th className="border border-slate-800 p-2 w-16">Banyak</th>
                    <th className="border border-slate-800 p-2 w-16">Satuan</th>
                    <th className="border border-slate-800 p-2 w-24">Harga Satuan</th>
                    <th className="border border-slate-800 p-2 w-28">Jumlah Harga</th>
                    <th className="border border-slate-800 p-2">Keperluan</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.rows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-6 text-center text-slate-400">
                        Tidak ada transaksi pengeluaran barang pada periode ini.
                      </td>
                    </tr>
                  ) : (
                    (reportData.rows as PengeluaranRow[]).map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="border border-slate-800 p-2 text-center">{idx + 1}</td>
                        <td className="border border-slate-800 p-2 text-center">{row.tanggal}</td>
                        <td className="border border-slate-800 p-2 font-mono text-[11px] font-semibold">{row.nomorDokumen}</td>
                        <td className="border border-slate-800 p-2 font-medium">{row.penerima}</td>
                        <td className="border border-slate-800 p-2 font-medium">{row.namaBarang}</td>
                        <td className="border border-slate-800 p-2 text-right font-bold">{row.jumlah}</td>
                        <td className="border border-slate-800 p-2 text-center">{row.satuan}</td>
                        <td className="border border-slate-800 p-2 text-right font-mono">{formatRupiah(row.hargaSatuan)}</td>
                        <td className="border border-slate-800 p-2 text-right font-mono font-bold">{formatRupiah(row.jumlahHarga)}</td>
                        <td className="border border-slate-800 p-2 text-slate-600">{row.keperluan || "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Official Signatures Footer */}
          <div className="mt-8 pt-4 grid grid-cols-2 gap-8 text-xs text-center text-slate-900 leading-relaxed break-inside-avoid">
            <div>
              <div className="font-semibold text-slate-700">MENGETAHUI</div>
              <div className="font-bold uppercase mt-0.5">
                {reportData.bidang?.jabatanAtasan || reportData.agency?.JABATAN_KEPALA || "KEPALA DINAS"}
              </div>
              <div className="h-20"></div>
              <div className="font-bold underline text-sm">
                {reportData.bidang?.namaAtasan || reportData.agency?.NAMA_KEPALA || "( ................................................ )"}
              </div>
              <div>NIP. {reportData.bidang?.nipAtasan || reportData.agency?.NIP_KEPALA || "................................"}</div>
              <div className="text-[11px] text-slate-500">{reportData.bidang?.pangkatAtasan || reportData.agency?.PANGKAT_KEPALA || ""}</div>
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
