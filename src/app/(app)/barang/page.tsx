"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Package,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  AlertCircle,
  Search,
  Upload,
  Layers,
  Boxes,
} from "lucide-react";

interface ItemData {
  id: string;
  kode: string;
  nama: string;
  kategoriId: string | null;
  kategoriNama: string;
  satuanId: string | null;
  satuanNama: string;
  stok: number;
  nilaiPersediaan: number;
  stokMinimum: number;
  status: string;
}

interface CategoryOption {
  id: string;
  nama: string;
}

interface UnitOption {
  id: string;
  nama: string;
}

export default function MasterBarangPage() {
  const [items, setItems] = useState<ItemData[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [bidangKode, setBidangKode] = useState<string>("BRG");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Filters
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form Fields
  const [formData, setFormData] = useState({
    kode: "",
    nama: "",
    kategoriId: "",
    satuanId: "",
    stokMinimum: 0,
    status: "ACTIVE",
  });

  // Import Text Area
  const [importText, setImportText] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<{ total: number; added: number; skipped: number } | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [itemRes, catRes, unitRes, meRes] = await Promise.all([
        fetch("/api/items"),
        fetch("/api/categories"),
        fetch("/api/units"),
        fetch("/api/auth/me"),
      ]);

      const itemJson = await itemRes.json();
      const catJson = await catRes.json();
      const unitJson = await unitRes.json();
      const meJson = await meRes.json();

      if (!itemRes.ok) throw new Error(itemJson.error);
      if (!catRes.ok) throw new Error(catJson.error);
      if (!unitRes.ok) throw new Error(unitJson.error);

      setItems(itemJson.data);
      setCategories(catJson.data);
      setUnits(unitJson.data);
      if (meJson.activeBidang?.kode) {
        setBidangKode(meJson.activeBidang.kode.toUpperCase());
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal memuat data master barang");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreateModal = () => {
    setEditingId(null);
    setFormData({
      kode: "",
      nama: "",
      kategoriId: categories[0]?.id || "",
      satuanId: units[0]?.id || "",
      stokMinimum: 0,
      status: "ACTIVE",
    });
    setIsModalOpen(true);
  };

  const openEditModal = (item: ItemData) => {
    setEditingId(item.id);
    setFormData({
      kode: item.kode,
      nama: item.nama,
      kategoriId: item.kategoriId || "",
      satuanId: item.satuanId || "",
      stokMinimum: item.stokMinimum || 0,
      status: item.status || "ACTIVE",
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const url = "/api/items";
      const method = editingId ? "PUT" : "POST";
      const body = editingId ? { id: editingId, ...formData } : formData;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      setIsModalOpen(false);
      fetchData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan barang");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, nama: string) => {
    if (!confirm(`Hapus barang "${nama}"?`)) return;

    try {
      const res = await fetch(`/api/items?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Gagal menghapus barang");
    }
  };

  // Process TSV/Excel copy-paste or JSON
  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportLoading(true);
    setImportResult(null);

    try {
      let parsedItems: Array<{ nama: string; satuan?: string; kategori?: string; stokMinimum?: number }> = [];

      const trimmed = importText.trim();
      if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
        parsedItems = JSON.parse(trimmed);
      } else {
        // Tab-separated or comma-separated lines (e.g. from Excel)
        const lines = trimmed.split("\n");
        for (const line of lines) {
          const cols = line.split("\t").map((c) => c.trim());
          if (cols.length >= 1 && cols[0]) {
            parsedItems.push({
              nama: cols[0],
              satuan: cols[1] || "buah",
              kategori: cols[2] || "Alat Tulis Kantor",
              stokMinimum: cols[3] ? Number(cols[3]) : 0,
            });
          }
        }
      }

      if (parsedItems.length === 0) {
        throw new Error("Tidak ada data yang dapat dibaca. Format: Nama [TAB] Satuan [TAB] Kategori");
      }

      const res = await fetch("/api/items/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: parsedItems }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      setImportResult({ total: json.total, added: json.added, skipped: json.skipped });
      fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Gagal import");
    } finally {
      setImportLoading(false);
    }
  };

  // Filtered List
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchSearch =
        item.nama.toLowerCase().includes(search.toLowerCase()) ||
        item.kode.toLowerCase().includes(search.toLowerCase());
      const matchCategory = filterCategory ? item.kategoriId === filterCategory : true;
      return matchSearch && matchCategory;
    });
  }, [items, search, filterCategory]);

  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(num);
  };

  return (
    <div className="space-y-6">
      {/* Header & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center space-x-2.5">
            <Package className="w-6 h-6 text-emerald-600" />
            <span>Master Barang (Katalog Bidang)</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Daftar seluruh item barang persediaan milik bidang aktif dengan stok dan valuasi FIFO.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start">
          <button
            onClick={() => {
              setImportText("");
              setImportResult(null);
              setIsImportOpen(true);
            }}
            className="px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-medium rounded-xl text-sm transition shadow-sm flex items-center space-x-2"
          >
            <Upload className="w-4 h-4 text-slate-500" />
            <span>Import Excel / Salin Data</span>
          </button>
          <button
            onClick={openCreateModal}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl text-sm transition shadow flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Barang</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start space-x-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full sm:max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Cari nama atau kode barang..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
          />
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 w-full sm:w-auto"
          >
            <option value="">Semua Kategori</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nama}
              </option>
            ))}
          </select>
          <span className="text-xs text-slate-500 whitespace-nowrap">
            Total: <strong>{filteredItems.length}</strong> barang
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Memuat katalog barang...</div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            Tidak ada barang yang sesuai dengan pencarian atau filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Kode</th>
                  <th className="px-6 py-3.5">Nama Barang Persediaan</th>
                  <th className="px-6 py-3.5">Kategori</th>
                  <th className="px-6 py-3.5">Satuan</th>
                  <th className="px-6 py-3.5 text-right">Stok Fisik</th>
                  <th className="px-6 py-3.5 text-right">Nilai Persediaan</th>
                  <th className="px-6 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-6 py-4 font-mono text-xs font-semibold text-slate-600">
                      {item.kode}
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-900">
                      {item.nama}
                      {item.stok <= item.stokMinimum && (
                        <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-rose-100 text-rose-700 font-bold border border-rose-200">
                          Menipis
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-700">
                        {item.kategoriNama}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600 text-xs font-medium">
                      {item.satuanNama}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-slate-800">
                      {item.stok}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-xs text-slate-800">
                      {formatRupiah(item.nilaiPersediaan)}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => openEditModal(item)}
                        className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                        title="Edit Barang"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id, item.nama)}
                        className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title="Hapus Barang"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Add / Edit Barang */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg my-8 overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-base flex items-center space-x-2">
                <Package className="w-5 h-5 text-emerald-600" />
                <span>{editingId ? "Edit Master Barang" : "Tambah Barang Baru"}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Kode Barang
                  </label>
                  <input
                    type="text"
                    placeholder={`Otomatis (${bidangKode}-0001)`}
                    value={formData.kode}
                    onChange={(e) => setFormData({ ...formData, kode: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 text-sm font-mono uppercase"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Awalan bidang: <strong className="text-emerald-700">{bidangKode}</strong> (Bisa dikosongkan untuk auto / diisi kode aset khusus)
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Nama Barang *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Kertas HVS 70 gsm F4"
                    value={formData.nama}
                    onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Kategori Barang
                  </label>
                  <select
                    value={formData.kategoriId}
                    onChange={(e) => setFormData({ ...formData, kategoriId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 text-sm bg-white"
                  >
                    <option value="">-- Pilih Kategori --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nama}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Satuan
                  </label>
                  <select
                    value={formData.satuanId}
                    onChange={(e) => setFormData({ ...formData, satuanId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 text-sm bg-white"
                  >
                    <option value="">-- Pilih Satuan --</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nama}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Batas Minimum Stok
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.stokMinimum}
                    onChange={(e) => setFormData({ ...formData, stokMinimum: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 text-sm bg-white"
                  >
                    <option value="ACTIVE">Aktif</option>
                    <option value="INACTIVE">Nonaktif</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end space-x-3">
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
                  <span>{saving ? "Menyimpan..." : "Simpan Barang"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Import Excel / TSV */}
      {isImportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl my-8 overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-base flex items-center space-x-2">
                <Upload className="w-5 h-5 text-emerald-600" />
                <span>Import Master Barang dari Excel / Salin Tabel</span>
              </h3>
              <button
                onClick={() => setIsImportOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleImportSubmit} className="p-6 space-y-4">
              <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs leading-relaxed">
                <strong>Petunjuk:</strong> Anda dapat langsung menyalin (Copy & Paste) kolom dari tabel Excel ke kotak di bawah.
                <br />
                Format kolom per baris: <code>Nama Barang [TAB] Satuan [TAB] Kategori [TAB] Stok Minimum</code>
                <br />
                Contoh:
                <br />
                <code>Kertas HVS 70 gsm F4 [TAB] rim [TAB] Kertas dan Cover [TAB] 5</code>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Tempel (Paste) Teks dari Excel atau JSON
                </label>
                <textarea
                  rows={8}
                  required
                  placeholder={"Amplop putih 90\tbox\tAlat Tulis Kantor\t2\nBinderclips Joyko 260\tpak\tAlat Tulis Kantor\t1"}
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {importResult && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
                  Proses Selesai: <strong>{importResult.added}</strong> barang ditambahkan,{" "}
                  <strong>{importResult.skipped}</strong> dilewati (karena sudah ada), dari total{" "}
                  <strong>{importResult.total}</strong> baris.
                </div>
              )}

              <div className="pt-2 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsImportOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-medium"
                >
                  Tutup
                </button>
                <button
                  type="submit"
                  disabled={importLoading}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition shadow flex items-center space-x-2"
                >
                  <Upload className="w-4 h-4" />
                  <span>{importLoading ? "Mengimpor..." : "Jalankan Import"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
