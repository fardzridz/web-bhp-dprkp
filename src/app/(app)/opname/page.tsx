"use client";

import { useState, useEffect, useMemo } from "react";
import NumberInput from "@/components/NumberInput";
import BeritaAcaraOpname from "@/components/BeritaAcaraOpname";
import { formatAngka, formatRupiah } from "@/lib/format";
import { daftarUnitKerja } from "@/lib/unit";
import { susunBlokBA } from "@/lib/opname-ba";
import {
  ClipboardCheck,
  RefreshCw,
  Save,
  Printer,
  Trash2,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

interface WorksheetRow {
  itemId: string;
  kode: string;
  nama: string;
  kategori: string;
  satuan: string;
  stokSistem: number;
  nilaiSistem: number;
  hargaSatuanSistem: number;
}

interface OpnameItem {
  id: string;
  itemId: string;
  kode: string;
  nama: string;
  kategori: string;
  satuan: string;
  stokSistem: number;
  nilaiSistem: number;
  jumlahFisik: number;
  nilaiFisik: number;
  selisihJumlah: number;
  selisihNilai: number;
  kondisi: string | null;
  keterangan: string | null;
}

interface OpnameRecord {
  id: string;
  nomorDokumen: string;
  /** Nomor Berita Acara resmi yang diisi manual (boleh kosong). */
  nomorBa: string | null;
  /** Tanggal penandatanganan BA (boleh beda dari tanggal opname). */
  tanggalBa: string | null;
  tanggal: string;
  keterangan: string | null;
  createdBy: string | null;
  posted: boolean;
  totalSelisihNilai: number;
  totalNilaiFisik: number;
  jumlahBarisSelisih: number;
  items: OpnameItem[];
}

interface BidangInfo {
  id: string;
  nama: string;
  kode: string;
  namaAtasan: string | null;
  nipAtasan: string | null;
  jabatanAtasan: string | null;
  pangkatAtasan: string | null;
  namaPengurus: string | null;
  nipPengurus: string | null;
  jabatanPengurus: string | null;
  pangkatPengurus: string | null;
}

interface InputRow {
  /** null = belum diisi (bukan 0), supaya kolom bisa benar-benar dikosongkan. */
  jumlahFisik: number | null;
  kondisi: string;
  keterangan: string;
  hargaSatuan: number | null;
}

const KONDISI_OPTIONS = ["Baik", "Rusak Ringan", "Rusak Berat"];

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function OpnamePage() {
  const [tanggal, setTanggal] = useState(todayISO());
  const [keterangan, setKeterangan] = useState("");
  const [posting, setPosting] = useState(true);
  const [worksheet, setWorksheet] = useState<WorksheetRow[]>([]);
  const [inputs, setInputs] = useState<Record<string, InputRow>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [onlyFilled, setOnlyFilled] = useState(true);
  const [search, setSearch] = useState("");

  const [history, setHistory] = useState<OpnameRecord[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [printing, setPrinting] = useState<OpnameRecord | null>(null);
  const [bidang, setBidang] = useState<BidangInfo | null>(null);
  const [agency, setAgency] = useState<Record<string, string>>({});
  // Nomor Berita Acara resmi (diisi manual dari kantor)
  const [nomorBa, setNomorBa] = useState("");
  const [tanggalBa, setTanggalBa] = useState("");
  const [baDraft, setBaDraft] = useState<Record<string, string>>({});
  const [tanggalBaDraft, setTanggalBaDraft] = useState<Record<string, string>>({});
  const [menyimpanNomorBa, setMenyimpanNomorBa] = useState<string | null>(null);

  const loadWorksheet = async (tanggalTarget: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/opname/worksheet?tanggal=${tanggalTarget}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setWorksheet(json.rows || []);
      setInputs({});
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal memuat stok sistem");
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      const res = await fetch("/api/opname");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setHistory(json.data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal memuat riwayat opname");
    }
  };

  const loadContext = async () => {
    try {
      const [meRes, setRes] = await Promise.all([fetch("/api/auth/me"), fetch("/api/settings")]);
      const meJson = await meRes.json();
      const setJson = await setRes.json();
      if (meJson.activeBidang) setBidang(meJson.activeBidang);
      if (setJson.data) setAgency(setJson.data);
    } catch {
      // konteks TTD gagal dimuat: cetak tetap bisa, blok TTD memakai data bidang
    }
  };

  useEffect(() => {
    loadWorksheet(todayISO());
    loadHistory();
    loadContext();
  }, []);

  const setRow = (itemId: string, patch: Partial<InputRow>) => {
    setInputs((prev) => {
      const current: InputRow = prev[itemId] || {
        jumlahFisik: null,
        kondisi: "Baik",
        keterangan: "",
        hargaSatuan: null,
      };
      return { ...prev, [itemId]: { ...current, ...patch } };
    });
  };

  const filledRows = useMemo(
    () =>
      worksheet
        .map((row) => {
          const input = inputs[row.itemId];
          if (!input || input.jumlahFisik === null) return null;
          const jumlahFisik = input.jumlahFisik;
          if (!Number.isFinite(jumlahFisik) || jumlahFisik < 0) return null;
          const hargaPakai =
            row.hargaSatuanSistem > 0 ? row.hargaSatuanSistem : input.hargaSatuan ?? 0;
          const nilaiFisik = jumlahFisik * hargaPakai;
          return {
            row,
            jumlahFisik,
            kondisi: input.kondisi,
            keterangan: input.keterangan,
            hargaSatuan: input.hargaSatuan ?? 0,
            selisihJumlah: jumlahFisik - row.stokSistem,
            selisihNilai: nilaiFisik - row.nilaiSistem,
            butuhHarga: row.hargaSatuanSistem <= 0 && (input.hargaSatuan ?? 0) <= 0,
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null),
    [worksheet, inputs]
  );

  const totalSelisihNilai = filledRows.reduce((s, r) => s + r.selisihNilai, 0);
  const adaSelisih = filledRows.some((r) => Math.abs(r.selisihJumlah) > 1e-9);

  const visibleRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return worksheet.filter((row) => {
      if (keyword && !`${row.kode} ${row.nama} ${row.kategori}`.toLowerCase().includes(keyword)) return false;
      if (!onlyFilled) return true;
      const diisi = inputs[row.itemId]?.jumlahFisik;
      return row.stokSistem > 0 || (diisi !== null && diisi !== undefined);
    });
  }, [worksheet, search, onlyFilled, inputs]);

  const handleSave = async () => {
    if (filledRows.length === 0) {
      setError("Belum ada barang yang diisi hasil hitung fisiknya.");
      return;
    }
    if (posting && filledRows.some((r) => r.butuhHarga)) {
      setError(
        "Ada barang tanpa nilai persediaan yang hasil fisiknya lebih besar dari catatan. Isi kolom Harga Satuan untuk barang tersebut."
      );
      return;
    }
    if (posting && !adaSelisih) {
      setNotice("Semua hasil hitung fisik sama dengan catatan sistem, jadi tidak ada penyesuaian stok yang dibuat.");
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch("/api/opname", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tanggal,
          keterangan,
          posting,
          nomorBa,
          tanggalBa,
          rows: filledRows.map((r) => ({
            itemId: r.row.itemId,
            jumlahFisik: r.jumlahFisik,
            kondisi: r.kondisi,
            keterangan: r.keterangan,
            hargaSatuan: r.hargaSatuan,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      setNotice(
        `Stock opname ${json.nomorDokumen} tersimpan: ${json.barangKurang} barang dikurangi, ${json.barangLebih} barang ditambah, nilai selisih ${formatRupiah(json.nilaiLebih - json.nilaiKurang)}${json.posted ? " (penyesuaian sudah diposting)" : " (tanpa posting)"}.`
      );
      setNomorBa("");
      setTanggalBa("");
      await loadWorksheet(tanggal);
      await loadHistory();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan stock opname");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (record: OpnameRecord) => {
    if (!confirm(`Batalkan stock opname ${record.nomorDokumen} beserta penyesuaian stoknya?`)) return;
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/opname?id=${record.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setNotice(`Stock opname ${record.nomorDokumen} dibatalkan.`);
      await loadWorksheet(tanggal);
      await loadHistory();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal membatalkan stock opname");
    }
  };

  const openPrint = (record: OpnameRecord) => {
    setPrinting(record);
  };

  /** Menyimpan nomor Berita Acara resmi pada dokumen opname tertentu. */
  const simpanNomorBa = async (record: OpnameRecord) => {
    const nilai = baDraft[record.id] ?? record.nomorBa ?? "";
    const tanggalNilai = tanggalBaDraft[record.id] ?? record.tanggalBa ?? "";
    setMenyimpanNomorBa(record.id);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/opname", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: record.id, nomorBa: nilai, tanggalBa: tanggalNilai }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setNotice(
        `Berita Acara ${record.nomorDokumen} disimpan: nomor ${json.nomorBa || "(kosong)"}, tanggal ${json.tanggalBa || "(mengikuti tanggal opname)"}.`
      );
      await loadHistory();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan nomor Berita Acara");
    } finally {
      setMenyimpanNomorBa(null);
    }
  };

  // Cetak setelah lembar Berita Acara selesai dirender.
  useEffect(() => {
    if (!printing) return;
    const timer = setTimeout(() => window.print(), 150);
    return () => clearTimeout(timer);
  }, [printing]);

  // Unit kerja resmi pada Berita Acara (dari Pengaturan).
  const unitKerja = useMemo(() => daftarUnitKerja(agency.UNIT_KERJA), [agency.UNIT_KERJA]);

  /**
   * Blok Berita Acara: per kategori, dengan baris untuk SELURUH unit kerja.
   * Unit yang tidak ikut diopname pada dokumen ini ditulis "-", persis seperti
   * dokumen resmi. Bila nama bidang tidak ada di daftar unit resmi, baris unit
   * tambahan ditampilkan agar nilainya tidak hilang.
   */
  const blokBA = useMemo(() => {
    if (!printing) return [];
    return susunBlokBA(printing.items, unitKerja, bidang?.nama || "");
  }, [printing, unitKerja, bidang]);

  const totalBA = blokBA.reduce((s, b) => s + b.jumlah, 0);

  return (
    <div className="space-y-6">
      <div className="no-print">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center space-x-2.5">
          <ClipboardCheck className="w-6 h-6 text-emerald-600" />
          <span>Stock Opname (Hitung Fisik Persediaan)</span>
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Isi jumlah barang hasil hitung fisik di gudang. Sistem membandingkan dengan catatan, menghitung selisih, lalu
          mencatat penyesuaian stok bila diperlukan.
        </p>
      </div>

      <div className="no-print p-4 rounded-xl bg-sky-50 border border-sky-200 text-sky-900 text-xs flex items-start space-x-2">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-sky-600" />
        <span>
          Kolom <strong>Stok Sistem</strong> dihitung pada tanggal opname (saldo awal + barang masuk − barang keluar).
          Barang yang tidak diisi <strong>dianggap tidak dihitung</strong> dan tidak diubah. Selisih kosong = fisik
          sama dengan catatan.
        </span>
      </div>

      {notice && (
        <div className="no-print p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
          {notice}
        </div>
      )}
      {error && (
        <div className="no-print p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start space-x-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Form opname */}
      <div className="no-print bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Tanggal opname *</label>
            <input
              type="date"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Keterangan</label>
            <input
              type="text"
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
              placeholder="Contoh: Opname akhir Semester I 2026"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Nomor Berita Acara</label>
            <input
              type="text"
              value={nomorBa}
              onChange={(e) => setNomorBa(e.target.value)}
              placeholder="602.21/…/423.109/2026"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Diisi manual sesuai nomor resmi dari kantor; boleh dikosongkan dan diisi belakangan.
            </p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Tanggal BA</label>
            <input
              type="date"
              value={tanggalBa}
              onChange={(e) => setTanggalBa(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Tanggal tanda tangan BA (mis. 2 Januari). Kosongkan bila sama dengan tanggal opname.
            </p>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => loadWorksheet(tanggal)}
              className="w-full px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium flex items-center justify-center space-x-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Muat stok sistem</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center space-x-2 text-xs text-slate-700">
            <input type="checkbox" checked={posting} onChange={(e) => setPosting(e.target.checked)} />
            <span>
              Posting penyesuaian stok setelah disimpan{" "}
              <span className="text-slate-500">(matikan bila hanya mencatat hasil hitung)</span>
            </span>
          </label>
          <label className="flex items-center space-x-2 text-xs text-slate-700">
            <input type="checkbox" checked={onlyFilled} onChange={(e) => setOnlyFilled(e.target.checked)} />
            <span>Tampilkan hanya barang berstok / yang sudah diisi</span>
          </label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari barang..."
            className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
          />
        </div>

        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="max-h-[28rem] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 font-semibold uppercase sticky top-0">
                <tr>
                  <th className="p-2">Kode</th>
                  <th className="p-2">Nama Barang</th>
                  <th className="p-2">Satuan</th>
                  <th className="p-2 text-right">Stok Sistem</th>
                  <th className="p-2 text-right">Nilai Sistem</th>
                  <th className="p-2 w-28">Jumlah Fisik</th>
                  <th className="p-2 w-36">Kondisi</th>
                  <th className="p-2 w-32 text-right">Harga Satuan</th>
                  <th className="p-2 text-right">Selisih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400">
                      Memuat stok sistem...
                    </td>
                  </tr>
                ) : visibleRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400">
                      Tidak ada barang yang ditampilkan. Tambahkan barang di Master Barang atau ubah filter.
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((row) => {
                    const input = inputs[row.itemId];
                    const jumlahFisik = input?.jumlahFisik ?? null;
                    const selisih = jumlahFisik !== null ? jumlahFisik - row.stokSistem : null;
                    const butuhHarga = row.hargaSatuanSistem <= 0;
                    return (
                      <tr key={row.itemId} className={selisih !== null && Math.abs(selisih) > 1e-9 ? "bg-amber-50" : ""}>
                        <td className="p-2 font-mono text-slate-500">{row.kode}</td>
                        <td className="p-2">
                          <div className="font-medium text-slate-800">{row.nama}</div>
                          <div className="text-[10px] text-slate-500">{row.kategori}</div>
                        </td>
                        <td className="p-2 text-slate-600">{row.satuan}</td>
                        <td className="p-2 text-right">{formatAngka(row.stokSistem)}</td>
                        <td className="p-2 text-right font-mono">{formatRupiah(row.nilaiSistem)}</td>
                        <td className="p-2">
                          <NumberInput
                            mode="qty"
                            value={jumlahFisik}
                            onChange={(nilai) => setRow(row.itemId, { jumlahFisik: nilai })}
                            placeholder="0"
                            className="w-full px-2 py-1 rounded-lg border border-slate-300 text-xs text-right"
                          />
                        </td>
                        <td className="p-2">
                          <select
                            value={input?.kondisi ?? "Baik"}
                            onChange={(e) => setRow(row.itemId, { kondisi: e.target.value })}
                            className="w-full px-2 py-1 rounded-lg border border-slate-300 text-xs bg-white"
                          >
                            {KONDISI_OPTIONS.map((k) => (
                              <option key={k} value={k}>
                                {k}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          {butuhHarga ? (
                            <NumberInput
                              value={input?.hargaSatuan ?? null}
                              onChange={(nilai) => setRow(row.itemId, { hargaSatuan: nilai })}
                              placeholder="wajib"
                              className="w-full px-2 py-1 rounded-lg border border-amber-400 text-xs font-mono text-right"
                              title="Barang ini belum punya nilai persediaan; isi harga satuan untuk menghitung nilai tambahan"
                            />
                          ) : (
                            <div className="text-right font-mono text-slate-500">
                              {formatRupiah(row.hargaSatuanSistem)}
                            </div>
                          )}
                        </td>
                        <td
                          className={`p-2 text-right font-semibold ${
                            selisih === null
                              ? "text-slate-400"
                              : Math.abs(selisih) < 1e-9
                                ? "text-emerald-700"
                                : selisih < 0
                                  ? "text-rose-700"
                                  : "text-blue-700"
                          }`}
                        >
                          {selisih === null ? "-" : `${selisih > 0 ? "+" : ""}${formatAngka(selisih)}`}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-slate-600">
            <strong>{filledRows.length}</strong> barang dihitung •{" "}
            {filledRows.filter((r) => Math.abs(r.selisihJumlah) > 1e-9).length} barang berselisih • total selisih nilai{" "}
            <span className={totalSelisihNilai < 0 ? "text-rose-700 font-semibold" : "text-blue-700 font-semibold"}>
              {formatRupiah(totalSelisihNilai)}
            </span>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || filledRows.length === 0}
            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition shadow flex items-center space-x-2 disabled:opacity-50 self-start"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? "Menyimpan..." : "Simpan Hasil Stock Opname"}</span>
          </button>
        </div>
      </div>

      {/* Riwayat */}
      <div className="no-print bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Riwayat Stock Opname</h2>
        </div>
        {history.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">Belum ada dokumen stock opname.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {history.map((record) => (
              <div key={record.id}>
                <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setExpandedId(expandedId === record.id ? null : record.id)}
                    className="flex items-start space-x-2 text-left"
                  >
                    {expandedId === record.id ? (
                      <ChevronDown className="w-4 h-4 mt-0.5 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 mt-0.5 text-slate-400" />
                    )}
                    <span>
                      <span className="font-mono font-semibold text-slate-800">{record.nomorDokumen}</span>
                      <span className="text-xs text-slate-500 ml-2">{record.tanggal}</span>
                      {record.posted ? (
                        <span className="ml-2 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold">
                          disesuaikan
                        </span>
                      ) : (
                        <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-semibold">
                          catatan saja
                        </span>
                      )}
                      <span className="block text-xs text-slate-500 mt-0.5">
                        {record.jumlahBarisSelisih} barang berselisih • nilai fisik {formatRupiah(record.totalNilaiFisik)}{" "}
                        • selisih {formatRupiah(record.totalSelisihNilai)}
                        {record.keterangan ? ` • ${record.keterangan}` : ""}
                      </span>
                      <span className="block text-xs text-slate-500 mt-0.5">
                        Nomor Berita Acara:{" "}
                        <span className="font-mono text-slate-700">{record.nomorBa || "(belum diisi)"}</span>
                      </span>
                    </span>
                  </button>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => openPrint(record)}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium inline-flex items-center space-x-1"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Cetak BA</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(record)}
                      className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 inline-flex items-center"
                      title="Batalkan opname"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {expandedId === record.id && (
                  <div className="px-6 pb-4">
                    <table className="w-full text-left text-xs border border-slate-200">
                      <thead className="bg-slate-50 text-slate-500 uppercase font-semibold">
                        <tr>
                          <th className="p-2">Kode</th>
                          <th className="p-2">Nama Barang</th>
                          <th className="p-2 text-right">Stok Sistem</th>
                          <th className="p-2 text-right">Jumlah Fisik</th>
                          <th className="p-2">Kondisi</th>
                          <th className="p-2 text-right">Selisih</th>
                          <th className="p-2 text-right">Selisih Nilai</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {record.items.map((item) => (
                          <tr key={item.id}>
                            <td className="p-2 font-mono text-slate-500">{item.kode}</td>
                            <td className="p-2">{item.nama}</td>
                            <td className="p-2 text-right">{formatAngka(item.stokSistem)}</td>
                            <td className="p-2 text-right font-semibold">{formatAngka(item.jumlahFisik)}</td>
                            <td className="p-2">{item.kondisi || "-"}</td>
                            <td
                              className={`p-2 text-right font-semibold ${
                                Math.abs(item.selisihJumlah) < 1e-9
                                  ? "text-slate-400"
                                  : item.selisihJumlah < 0
                                    ? "text-rose-700"
                                    : "text-blue-700"
                              }`}
                            >
                              {item.selisihJumlah > 0 ? "+" : ""}
                              {formatAngka(item.selisihJumlah)}
                            </td>
                            <td className="p-2 text-right font-mono">{formatRupiah(item.selisihNilai)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="mt-3 flex flex-wrap items-end gap-2 text-xs">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                          Nomor Berita Acara (resmi)
                        </label>
                        <input
                          type="text"
                          value={baDraft[record.id] ?? record.nomorBa ?? ""}
                          onChange={(e) => setBaDraft({ ...baDraft, [record.id]: e.target.value })}
                          placeholder="602.21/…/423.109/2026"
                          className="w-72 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                          Tanggal BA
                        </label>
                        <input
                          type="date"
                          value={tanggalBaDraft[record.id] ?? record.tanggalBa ?? ""}
                          onChange={(e) => setTanggalBaDraft({ ...tanggalBaDraft, [record.id]: e.target.value })}
                          className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => simpanNomorBa(record)}
                        disabled={menyimpanNomorBa === record.id}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold disabled:opacity-50"
                      >
                        {menyimpanNomorBa === record.id ? "Menyimpan..." : "Simpan nomor"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lembar Berita Acara resmi untuk dicetak */}
      {printing && (
        <div className="hidden print:block">
          <BeritaAcaraOpname
            instansi={agency.NAMA_INSTANSI || bidang?.nama || "Dinas Perumahan Rakyat dan Kawasan Permukiman"}
            kabKota={agency.KAB_KOTA || "Kota Pasuruan"}
            provinsi={agency.PROVINSI || "Jawa Timur"}
            logoSrc="/logo-pasuruan.png"
            tahun={(printing.tanggal || "").slice(0, 4)}
            nomorBa={printing.nomorBa || ""}
            tanggalOpname={printing.tanggal}
            keterangan={printing.keterangan}
            pemeriksa={{
              nama: agency.NAMA_PENGURUS || bidang?.namaPengurus || "",
              nip: agency.NIP_PENGURUS || bidang?.nipPengurus || "",
              pangkat: agency.PANGKAT_PENGURUS || "",
            }}
            penatausahaan={{
              nama: agency.NAMA_PENATAUSAHAAN || bidang?.namaAtasan || "",
              nip: agency.NIP_PENATAUSAHAAN || bidang?.nipAtasan || "",
              pangkat: agency.PANGKAT_PENATAUSAHAAN || "",
            }}
            kepala={{
              nama: agency.NAMA_KEPALA || "",
              nip: agency.NIP_KEPALA || "",
              jabatan: agency.JABATAN_KEPALA || "Kepala Dinas",
            }}
            blok={blokBA}
            total={totalBA}
            tempatTtd={agency.TEMPAT_TTD || "Pasuruan"}
            tanggalTtd={printing.tanggalBa || printing.tanggal}
          />
        </div>
      )}
    </div>
  );
}
