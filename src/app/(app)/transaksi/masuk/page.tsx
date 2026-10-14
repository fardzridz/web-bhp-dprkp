"use client";

import { useState, useEffect } from "react";
import {
  ArrowDownLeft,
  Plus,
  Trash2,
  X,
  Check,
  AlertCircle,
  Calendar,
  Building,
  FileText,
} from "lucide-react";

interface ReceiptRecord {
  id: string;
  nomorDokumen: string;
  tanggal: string;
  vendorNama: string | null;
  noFaktur: string | null;
  tglFaktur: string | null;
  noBa: string | null;
  tglBa: string | null;
  keterangan: string | null;
  totalNilai: number;
  items: Array<{
    id: string;
    itemNama: string;
    jumlah: number;
    hargaSatuan: number;
    jumlahHarga: number;
  }>;
}

interface ItemOption {
  id: string;
  kode: string;
  nama: string;
  satuanNama: string;
}

interface VendorOption {
  id: string;
  nama: string;
}

interface FormItemRow {
  itemId: string;
  jumlah: number;
  hargaSatuan: number;
}

export default function TransaksiMasukPage() {
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
  const [items, setItems] = useState<ItemOption[]>([]);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Detail Modal for viewing
  const [viewingReceipt, setViewingReceipt] = useState<ReceiptRecord | null>(null);

  // Form Fields
  const [formData, setFormData] = useState({
    nomorDokumen: "",
    tanggal: new Date().toISOString().split("T")[0],
    vendorId: "",
    vendorNama: "",
    noFaktur: "",
    tglFaktur: new Date().toISOString().split("T")[0],
    noBa: "",
    tglBa: new Date().toISOString().split("T")[0],
    keterangan: "",
  });

  const [formRows, setFormRows] = useState<FormItemRow[]>([
    { itemId: "", jumlah: 1, hargaSatuan: 0 },
  ]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [rRes, iRes, vRes] = await Promise.all([
        fetch("/api/receipts"),
        fetch("/api/items"),
        fetch("/api/vendors"),
      ]);

      const rJson = await rRes.json();
      const iJson = await iRes.json();
      const vJson = await vRes.json();

      if (!rRes.ok) throw new Error(rJson.error);
      if (!iRes.ok) throw new Error(iJson.error);
      if (!vRes.ok) throw new Error(vJson.error);

      setReceipts(rJson.data);
      setItems(iJson.data);
      setVendors(vJson.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal memuat data transaksi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreateModal = () => {
    setFormData({
      nomorDokumen: "",
      tanggal: new Date().toISOString().split("T")[0],
      vendorId: vendors[0]?.id || "",
      vendorNama: vendors[0]?.nama || "",
      noFaktur: "",
      tglFaktur: new Date().toISOString().split("T")[0],
      noBa: "",
      tglBa: new Date().toISOString().split("T")[0],
      keterangan: "",
    });
    setFormRows([
      { itemId: items[0]?.id || "", jumlah: 1, hargaSatuan: 0 },
    ]);
    setIsModalOpen(true);
  };

  const handleRowChange = (index: number, field: keyof FormItemRow, value: string | number) => {
    const updated = [...formRows];
    updated[index] = { ...updated[index], [field]: value };
    setFormRows(updated);
  };

  const addRow = () => {
    setFormRows([...formRows, { itemId: items[0]?.id || "", jumlah: 1, hargaSatuan: 0 }]);
  };

  const removeRow = (index: number) => {
    if (formRows.length <= 1) return;
    setFormRows(formRows.filter((_, i) => i !== index));
  };

  const totalBelanja = formRows.reduce(
    (sum, r) => sum + (Number(r.jumlah) || 0) * (Number(r.hargaSatuan) || 0),
    0
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const selectedVendor = vendors.find((v) => v.id === formData.vendorId);
      const payload = {
        ...formData,
        vendorNama: selectedVendor?.nama || formData.vendorNama,
        items: formRows,
      };

      const res = await fetch("/api/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      setIsModalOpen(false);
      fetchData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan transaksi");
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
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center space-x-2.5">
            <ArrowDownLeft className="w-6 h-6 text-emerald-600" />
            <span>Penerimaan Barang Masuk (Faktur & BA)</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Pencatatan barang persediaan masuk dari penyedia / rekanan beserta nomor faktur dan dokumen BA.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          disabled={items.length === 0}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl text-sm transition shadow flex items-center space-x-2 self-start disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          <span>Catat Penerimaan Baru</span>
        </button>
      </div>

      {items.length === 0 && !loading && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          Master Barang di bidang ini masih kosong. Silakan tambahkan barang di menu <strong>Master Barang</strong> terlebih dahulu.
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start space-x-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Receipts Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Memuat data penerimaan...</div>
        ) : receipts.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            Belum ada transaksi penerimaan barang di bidang ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Tanggal</th>
                  <th className="px-6 py-3.5">No. Dokumen / Ref</th>
                  <th className="px-6 py-3.5">Penyedia / Vendor</th>
                  <th className="px-6 py-3.5">Faktur & BA</th>
                  <th className="px-6 py-3.5 text-right">Rincian Barang</th>
                  <th className="px-6 py-3.5 text-right">Total Nilai</th>
                  <th className="px-6 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {receipts.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-slate-800">
                      {r.tanggal}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs font-semibold text-slate-900">
                      {r.nomorDokumen}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-800">
                      {r.vendorNama || "-"}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600">
                      <div>Faktur: <span className="font-mono">{r.noFaktur || "-"}</span></div>
                      <div>BA: <span className="font-mono">{r.noBa || "-"}</span></div>
                    </td>
                    <td className="px-6 py-4 text-right text-xs font-medium text-slate-600">
                      {r.items.length} jenis item
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-slate-800">
                      {formatRupiah(r.totalNilai)}
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => setViewingReceipt(r)}
                        className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition"
                      >
                        Detail
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal View Detail */}
      {viewingReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl my-8 overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-base">
                Rincian Penerimaan: {viewingReceipt.nomorDokumen}
              </h3>
              <button onClick={() => setViewingReceipt(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div><strong>Tanggal Penerimaan:</strong> {viewingReceipt.tanggal}</div>
                <div><strong>Vendor:</strong> {viewingReceipt.vendorNama || "-"}</div>
                <div><strong>No Faktur:</strong> {viewingReceipt.noFaktur || "-"} ({viewingReceipt.tglFaktur || "-"})</div>
                <div><strong>No BA Penerimaan:</strong> {viewingReceipt.noBa || "-"} ({viewingReceipt.tglBa || "-"})</div>
                {viewingReceipt.keterangan && (
                  <div className="col-span-2"><strong>Keterangan:</strong> {viewingReceipt.keterangan}</div>
                )}
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-semibold uppercase">
                    <tr>
                      <th className="p-3">Nama Barang</th>
                      <th className="p-3 text-right">Jumlah</th>
                      <th className="p-3 text-right">Harga Satuan</th>
                      <th className="p-3 text-right">Jumlah Harga</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {viewingReceipt.items.map((it) => (
                      <tr key={it.id}>
                        <td className="p-3 font-medium text-slate-800">{it.itemNama}</td>
                        <td className="p-3 text-right">{it.jumlah}</td>
                        <td className="p-3 text-right font-mono">{formatRupiah(it.hargaSatuan)}</td>
                        <td className="p-3 text-right font-mono font-bold">{formatRupiah(it.jumlahHarga)}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 font-bold">
                      <td colSpan={3} className="p-3 text-right">Total Keseluruhan:</td>
                      <td className="p-3 text-right font-mono text-emerald-700">{formatRupiah(viewingReceipt.totalNilai)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Add Penerimaan Baru */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl my-8 overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-base flex items-center space-x-2">
                <ArrowDownLeft className="w-5 h-5 text-emerald-600" />
                <span>Input Barang Masuk Baru</span>
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-5">
              {/* Meta Informasi Dokumen */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Tanggal Penerimaan *
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
                    Penyedia / Rekanan *
                  </label>
                  <select
                    value={formData.vendorId}
                    onChange={(e) => setFormData({ ...formData, vendorId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                  >
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.nama}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Nomor Dokumen (Opsional)
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

              {/* Faktur & BA */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                    No. Faktur Pembelian
                  </label>
                  <input
                    type="text"
                    placeholder="003.2/400-3/104/2026"
                    value={formData.noFaktur}
                    onChange={(e) => setFormData({ ...formData, noFaktur: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                    Tgl Faktur
                  </label>
                  <input
                    type="date"
                    value={formData.tglFaktur}
                    onChange={(e) => setFormData({ ...formData, tglFaktur: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                    No. B.A. Penerimaan
                  </label>
                  <input
                    type="text"
                    placeholder="BA/01/BHP/2026"
                    value={formData.noBa}
                    onChange={(e) => setFormData({ ...formData, noBa: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                    Tgl B.A. Penerimaan
                  </label>
                  <input
                    type="date"
                    value={formData.tglBa}
                    onChange={(e) => setFormData({ ...formData, tglBa: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
              </div>

              {/* Multi-Row Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Daftar Barang yang Diterima
                  </label>
                  <button
                    type="button"
                    onClick={addRow}
                    className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Baris Barang</span>
                  </button>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-600 font-semibold uppercase">
                      <tr>
                        <th className="p-3 w-1/2">Nama Barang Persediaan</th>
                        <th className="p-3 w-28">Jumlah</th>
                        <th className="p-3 w-36">Harga Satuan (Rp)</th>
                        <th className="p-3 text-right">Subtotal</th>
                        <th className="p-3 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {formRows.map((row, idx) => (
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
                                  {it.nama} ({it.satuanNama})
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
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              required
                              value={row.hargaSatuan}
                              onChange={(e) => handleRowChange(idx, "hargaSatuan", Number(e.target.value))}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-mono"
                            />
                          </td>
                          <td className="p-2 text-right font-mono font-semibold text-slate-800">
                            {formatRupiah((row.jumlah || 0) * (row.hargaSatuan || 0))}
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
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 font-bold">
                        <td colSpan={3} className="p-3 text-right text-slate-700">
                          Total Nilai Belanja:
                        </td>
                        <td className="p-3 text-right font-mono text-emerald-700 text-sm">
                          {formatRupiah(totalBelanja)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Keterangan Tambahan
                </label>
                <input
                  type="text"
                  placeholder="Keterangan pengadaan / sumber dana"
                  value={formData.keterangan}
                  onChange={(e) => setFormData({ ...formData, keterangan: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
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
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition shadow flex items-center space-x-2"
                >
                  <Check className="w-4 h-4" />
                  <span>{saving ? "Menyimpan & Update Stok..." : "Simpan Penerimaan"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
