"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Plus,
  Trash2,
  X,
  Check,
  AlertCircle,
  Printer,
  FileCheck,
  Building,
} from "lucide-react";

interface IssueRecord {
  id: string;
  nomorDokumen: string;
  tanggal: string;
  tglPenyerahan: string | null;
  penerima: string;
  keperluan: string | null;
  namaPenyerah: string | null;
  nipPenyerah: string | null;
  jabatanPenyerah: string | null;
  namaPenerima: string | null;
  nipPenerima: string | null;
  jabatanPenerima: string | null;
  totalNilai: number;
  items: Array<{
    id: string;
    itemNama: string;
    jumlah: number;
    totalNilaiFifo: number;
  }>;
}

interface ItemOption {
  id: string;
  kode: string;
  nama: string;
  satuanNama: string;
  stok: number;
}

interface BidangInfo {
  nama: string;
  kode: string;
  namaPengurus: string | null;
  nipPengurus: string | null;
  jabatanPengurus: string | null;
}

interface FormItemRow {
  itemId: string;
  jumlah: number;
}

export default function TransaksiKeluarPage() {
  const [issues, setIssues] = useState<IssueRecord[]>([]);
  const [items, setItems] = useState<ItemOption[]>([]);
  const [bidang, setBidang] = useState<BidangInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Detail Modal for viewing & printing BAST
  const [viewingIssue, setViewingIssue] = useState<IssueRecord | null>(null);

  // Form Fields
  const [formData, setFormData] = useState({
    nomorDokumen: "",
    tanggal: new Date().toISOString().split("T")[0],
    tglPenyerahan: new Date().toISOString().split("T")[0],
    penerima: "",
    keperluan: "",
    keterangan: "",
    namaPenyerah: "",
    nipPenyerah: "",
    jabatanPenyerah: "Pengurus Barang Pembantu",
    namaPenerima: "",
    nipPenerima: "",
    jabatanPenerima: "Penerima Barang",
  });

  const [formRows, setFormRows] = useState<FormItemRow[]>([
    { itemId: "", jumlah: 1 },
  ]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [issRes, iRes, meRes] = await Promise.all([
        fetch("/api/issues"),
        fetch("/api/items"),
        fetch("/api/auth/me"),
      ]);

      const issJson = await issRes.json();
      const iJson = await iRes.json();
      const meJson = await meRes.json();

      if (!issRes.ok) throw new Error(issJson.error);
      if (!iRes.ok) throw new Error(iJson.error);

      setIssues(issJson.data);
      setItems(iJson.data);
      if (meJson.activeBidang) {
        setBidang(meJson.activeBidang);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal memuat data transaksi pengeluaran");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreateModal = () => {
    // Pick the first item that has stock > 0
    const availableItem = items.find((it) => it.stok > 0) || items[0];

    setFormData({
      nomorDokumen: "",
      tanggal: new Date().toISOString().split("T")[0],
      tglPenyerahan: new Date().toISOString().split("T")[0],
      penerima: "",
      keperluan: "",
      keterangan: "",
      namaPenyerah: bidang?.namaPengurus || "",
      nipPenyerah: bidang?.nipPengurus || "",
      jabatanPenyerah: bidang?.jabatanPengurus || "Pengurus Barang Pembantu",
      namaPenerima: "",
      nipPenerima: "",
      jabatanPenerima: "Penerima Barang",
    });
    setFormRows([
      { itemId: availableItem?.id || "", jumlah: 1 },
    ]);
    setIsModalOpen(true);
  };

  const handleRowChange = (index: number, field: keyof FormItemRow, value: string | number) => {
    const updated = [...formRows];
    updated[index] = { ...updated[index], [field]: value };
    setFormRows(updated);
  };

  const addRow = () => {
    const availableItem = items.find((it) => it.stok > 0) || items[0];
    setFormRows([...formRows, { itemId: availableItem?.id || "", jumlah: 1 }]);
  };

  const removeRow = (index: number) => {
    if (formRows.length <= 1) return;
    setFormRows(formRows.filter((_, i) => i !== index));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          items: formRows,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      setIsModalOpen(false);
      fetchData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan pengeluaran");
    } finally {
      setSaving(false);
    }
  };

  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(num);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center space-x-2.5">
            <ArrowUpRight className="w-6 h-6 text-blue-600" />
            <span>Pengeluaran Barang (BAST & Bukti Serah Terima)</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Pencatatan distribusi barang persediaan ke seksi / pegawai beserta pemotongan stok metode FIFO.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          disabled={items.length === 0}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-sm transition shadow flex items-center space-x-2 self-start disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          <span>Buat Pengeluaran / BAST</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start space-x-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Issues Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Memuat data pengeluaran...</div>
        ) : issues.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            Belum ada transaksi pengeluaran barang di bidang ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Tanggal</th>
                  <th className="px-6 py-3.5">Nomor BAST</th>
                  <th className="px-6 py-3.5">Penerima / Seksi</th>
                  <th className="px-6 py-3.5">Keperluan</th>
                  <th className="px-6 py-3.5 text-right">Rincian Barang</th>
                  <th className="px-6 py-3.5 text-right">Nilai FIFO (Rp)</th>
                  <th className="px-6 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {issues.map((iss) => (
                  <tr key={iss.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-slate-800">
                      {iss.tanggal}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs font-semibold text-slate-900">
                      {iss.nomorDokumen}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-800">
                      {iss.penerima}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600 max-w-xs truncate">
                      {iss.keperluan || "Operasional Rutin"}
                    </td>
                    <td className="px-6 py-4 text-right text-xs font-medium text-slate-600">
                      {iss.items.length} jenis item
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-slate-800">
                      {formatRupiah(iss.totalNilai)}
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap space-x-2">
                      <button
                        onClick={() => setViewingIssue(iss)}
                        className="px-3 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold transition inline-flex items-center space-x-1"
                      >
                        <FileCheck className="w-3.5 h-3.5" />
                        <span>Lihat & Cetak BAST</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal View Detail & Print BAST */}
      {viewingIssue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl my-8 overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between no-print">
              <h3 className="font-bold text-slate-800 text-base flex items-center space-x-2">
                <FileCheck className="w-5 h-5 text-blue-600" />
                <span>Berita Acara Serah Terima (BAST): {viewingIssue.nomorDokumen}</span>
              </h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center space-x-1.5 transition shadow"
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak Dokumen</span>
                </button>
                <button onClick={() => setViewingIssue(null)} className="text-slate-400 hover:text-slate-600 p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Print Friendly BAST Document */}
            <div className="p-8 space-y-6 text-slate-900 font-sans print:p-0">
              <div className="text-center border-b-2 border-slate-800 pb-4">
                <h2 className="text-sm font-semibold tracking-wider uppercase text-slate-600">
                  PEMERINTAH KABUPATEN PASURUAN
                </h2>
                <h1 className="text-base font-bold uppercase tracking-wide">
                  DINAS PERUMAHAN RAKYAT DAN KAWASAN PERMUKIMAN
                </h1>
                <p className="text-xs text-slate-600 mt-0.5">
                  Kompleks Perkantoran Pemerintah Kabupaten Pasuruan, Jawa Timur
                </p>
                <div className="mt-3 font-bold text-sm tracking-wide border-t border-slate-300 pt-2 uppercase">
                  BERITA ACARA SERAH TERIMA BARANG (BAST)
                </div>
                <div className="text-xs font-mono font-medium text-slate-600">
                  Nomor: {viewingIssue.nomorDokumen}
                </div>
              </div>

              <div className="text-xs space-y-2 leading-relaxed">
                <p>
                  Pada hari ini tanggal <strong>{viewingIssue.tanggal}</strong>, kami yang bertanda tangan di bawah ini:
                </p>
                <div className="grid grid-cols-2 gap-4 bg-slate-50 print:bg-transparent p-3 rounded-lg border border-slate-200">
                  <div>
                    <div className="font-bold text-slate-700 mb-1">PIHAK PERTAMA (Yang Menyerahkan):</div>
                    <div>Nama: <strong>{viewingIssue.namaPenyerah || "-"}</strong></div>
                    <div>NIP: {viewingIssue.nipPenyerah || "-"}</div>
                    <div>Jabatan: {viewingIssue.jabatanPenyerah || "Pengurus Barang"}</div>
                  </div>
                  <div>
                    <div className="font-bold text-slate-700 mb-1">PIHAK KEDUA (Yang Menerima):</div>
                    <div>Nama / Unit: <strong>{viewingIssue.penerima}</strong></div>
                    <div>NIP: {viewingIssue.nipPenerima || "-"}</div>
                    <div>Jabatan: {viewingIssue.jabatanPenerima || "Penerima Barang"}</div>
                  </div>
                </div>
                <p>
                  PIHAK PERTAMA telah menyerahkan kepada PIHAK KEDUA, dan PIHAK KEDUA telah menerima barang persediaan untuk keperluan: <strong>{viewingIssue.keperluan || "Operasional"}</strong> dengan rincian sebagai berikut:
                </p>
              </div>

              <table className="w-full text-left text-xs border border-slate-300 border-collapse">
                <thead>
                  <tr className="bg-slate-100 print:bg-slate-200">
                    <th className="border border-slate-300 p-2 text-center w-12">No</th>
                    <th className="border border-slate-300 p-2">Rincian Nama Barang</th>
                    <th className="border border-slate-300 p-2 text-right w-24">Jumlah</th>
                    <th className="border border-slate-300 p-2 text-right w-36">Nilai FIFO (Rp)</th>
                  </tr>
                </thead>
                <tbody>
                  {viewingIssue.items.map((it, idx) => (
                    <tr key={it.id}>
                      <td className="border border-slate-300 p-2 text-center">{idx + 1}</td>
                      <td className="border border-slate-300 p-2 font-medium">{it.itemNama}</td>
                      <td className="border border-slate-300 p-2 text-right font-bold">{it.jumlah}</td>
                      <td className="border border-slate-300 p-2 text-right font-mono">{formatRupiah(it.totalNilaiFifo)}</td>
                    </tr>
                  ))}
                  <tr className="font-bold bg-slate-50 print:bg-slate-100">
                    <td colSpan={3} className="border border-slate-300 p-2 text-right">Total Nilai Penyerahan:</td>
                    <td className="border border-slate-300 p-2 text-right font-mono text-emerald-800">{formatRupiah(viewingIssue.totalNilai)}</td>
                  </tr>
                </tbody>
              </table>

              <p className="text-xs text-slate-600">
                Demikian Berita Acara Serah Terima Barang ini dibuat dengan sebenarnya dalam rangkap secukupnya untuk dipergunakan sebagaimana mestinya.
              </p>

              {/* Tanda Tangan */}
              <div className="grid grid-cols-2 gap-8 text-xs text-center pt-4">
                <div>
                  <div className="font-medium text-slate-600">Yang Menerima (PIHAK KEDUA)</div>
                  <div className="font-semibold text-slate-800 mt-1">{viewingIssue.jabatanPenerima || "Penerima Barang"}</div>
                  <div className="h-16"></div>
                  <div className="font-bold underline text-slate-900">{viewingIssue.penerima}</div>
                  <div className="text-slate-500">NIP. {viewingIssue.nipPenerima || "................................"}</div>
                </div>

                <div>
                  <div className="font-medium text-slate-600">Yang Menyerahkan (PIHAK PERTAMA)</div>
                  <div className="font-semibold text-slate-800 mt-1">{viewingIssue.jabatanPenyerah || "Pengurus Barang Pembantu"}</div>
                  <div className="h-16"></div>
                  <div className="font-bold underline text-slate-900">{viewingIssue.namaPenyerah || "( ................................ )"}</div>
                  <div className="text-slate-500">NIP. {viewingIssue.nipPenyerah || "................................"}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Add Pengeluaran Baru */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl my-8 overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-base flex items-center space-x-2">
                <ArrowUpRight className="w-5 h-5 text-blue-600" />
                <span>Buat Pengeluaran Barang / BAST Baru</span>
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Tanggal Pengeluaran *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.tanggal}
                    onChange={(e) => setFormData({ ...formData, tanggal: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Penerima / Seksi *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Seksi Prasarana & Sarana"
                    value={formData.penerima}
                    onChange={(e) => setFormData({ ...formData, penerima: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Nomor BAST (Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="Otomatis"
                    value={formData.nomorDokumen}
                    onChange={(e) => setFormData({ ...formData, nomorDokumen: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Keperluan Penyerahan Barang
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Kebutuhan operasional kantor dan administrasi pelayanan"
                  value={formData.keperluan}
                  onChange={(e) => setFormData({ ...formData, keperluan: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              {/* TTD Pihak Pertama & Kedua */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-bold text-slate-700 uppercase mb-2">Pihak Pertama (Penyerah)</div>
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Nama Penyerah"
                      value={formData.namaPenyerah}
                      onChange={(e) => setFormData({ ...formData, namaPenyerah: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                    />
                    <input
                      type="text"
                      placeholder="NIP Penyerah"
                      value={formData.nipPenyerah}
                      onChange={(e) => setFormData({ ...formData, nipPenyerah: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <div className="text-xs font-bold text-slate-700 uppercase mb-2">Pihak Kedua (Penerima)</div>
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Nama Penerima (opsional jika perorangan)"
                      value={formData.namaPenerima}
                      onChange={(e) => setFormData({ ...formData, namaPenerima: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                    />
                    <input
                      type="text"
                      placeholder="NIP Penerima (opsional)"
                      value={formData.nipPenerima}
                      onChange={(e) => setFormData({ ...formData, nipPenerima: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Daftar Barang yang Dikeluarkan
                  </label>
                  <button
                    type="button"
                    onClick={addRow}
                    className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Baris Barang</span>
                  </button>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-600 font-semibold uppercase">
                      <tr>
                        <th className="p-3 w-3/4">Nama Barang (Stok Tersedia)</th>
                        <th className="p-3 w-32">Jumlah Keluar</th>
                        <th className="p-3 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {formRows.map((row, idx) => {
                        const selectedItem = items.find((i) => i.id === row.itemId);
                        const isOverStock = selectedItem && row.jumlah > selectedItem.stok;
                        return (
                          <tr key={idx}>
                            <td className="p-2">
                              <select
                                required
                                value={row.itemId}
                                onChange={(e) => handleRowChange(idx, "itemId", e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                              >
                                {items.map((it) => (
                                  <option key={it.id} value={it.id}>
                                    {it.nama} ({it.satuanNama}) — Stok: {it.stok}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                min="1"
                                step="any"
                                required
                                value={row.jumlah}
                                onChange={(e) => handleRowChange(idx, "jumlah", Number(e.target.value))}
                                className={`w-full px-2.5 py-1.5 rounded-lg border text-xs ${
                                  isOverStock
                                    ? "border-rose-500 bg-rose-50 text-rose-800 font-bold"
                                    : "border-slate-300"
                                }`}
                              />
                              {isOverStock && (
                                <span className="text-[10px] text-rose-600">
                                  Melebihi stok ({selectedItem.stok})
                                </span>
                              )}
                            </td>
                            <td className="p-2 text-center">
                              {formRows.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeRow(idx)}
                                  className="text-slate-400 hover:text-rose-500 p-1"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition shadow flex items-center space-x-2"
                >
                  <Check className="w-4 h-4" />
                  <span>{saving ? "Memotong Stok FIFO..." : "Simpan Pengeluaran & BAST"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
