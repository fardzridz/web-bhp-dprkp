"use client";

import { useState, useEffect } from "react";
import { Layers, Ruler, Plus, Pencil, Trash2, X, Check, AlertCircle } from "lucide-react";

interface CategoryItem {
  id: string;
  nama: string;
  createdAt: number;
}

interface UnitItem {
  id: string;
  nama: string;
  createdAt: number;
}

export default function KategoriSatuanPage() {
  const [activeTab, setActiveTab] = useState<"kategori" | "satuan">("kategori");

  // Kategori State
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loadingCat, setLoadingCat] = useState(true);
  const [errorCat, setErrorCat] = useState<string | null>(null);
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [namaCat, setNamaCat] = useState("");
  const [savingCat, setSavingCat] = useState(false);

  // Satuan State
  const [units, setUnits] = useState<UnitItem[]>([]);
  const [loadingUnit, setLoadingUnit] = useState(true);
  const [errorUnit, setErrorUnit] = useState<string | null>(null);
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [namaUnit, setNamaUnit] = useState("");
  const [savingUnit, setSavingUnit] = useState(false);

  // Fetch Kategori
  const fetchCategories = async () => {
    try {
      setLoadingCat(true);
      const res = await fetch("/api/categories");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setCategories(json.data);
    } catch (err: unknown) {
      setErrorCat(err instanceof Error ? err.message : "Gagal memuat kategori");
    } finally {
      setLoadingCat(false);
    }
  };

  // Fetch Satuan
  const fetchUnits = async () => {
    try {
      setLoadingUnit(true);
      const res = await fetch("/api/units");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setUnits(json.data);
    } catch (err: unknown) {
      setErrorUnit(err instanceof Error ? err.message : "Gagal memuat satuan");
    } finally {
      setLoadingUnit(false);
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchUnits();
  }, []);

  // Kategori Handlers
  const openCreateCat = () => {
    setEditingCatId(null);
    setNamaCat("");
    setIsCatModalOpen(true);
  };

  const openEditCat = (c: CategoryItem) => {
    setEditingCatId(c.id);
    setNamaCat(c.nama);
    setIsCatModalOpen(true);
  };

  const handleSaveCat = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCat(true);
    setErrorCat(null);

    try {
      const url = "/api/categories";
      const method = editingCatId ? "PUT" : "POST";
      const body = editingCatId ? { id: editingCatId, nama: namaCat } : { nama: namaCat };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      setIsCatModalOpen(false);
      fetchCategories();
    } catch (err: unknown) {
      setErrorCat(err instanceof Error ? err.message : "Gagal menyimpan kategori");
    } finally {
      setSavingCat(false);
    }
  };

  const handleDeleteCat = async (id: string, catNama: string) => {
    if (!confirm(`Hapus kategori "${catNama}"?`)) return;

    try {
      const res = await fetch(`/api/categories?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      fetchCategories();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Gagal menghapus kategori");
    }
  };

  // Satuan Handlers
  const openCreateUnit = () => {
    setEditingUnitId(null);
    setNamaUnit("");
    setIsUnitModalOpen(true);
  };

  const openEditUnit = (u: UnitItem) => {
    setEditingUnitId(u.id);
    setNamaUnit(u.nama);
    setIsUnitModalOpen(true);
  };

  const handleSaveUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingUnit(true);
    setErrorUnit(null);

    try {
      const url = "/api/units";
      const method = editingUnitId ? "PUT" : "POST";
      const body = editingUnitId ? { id: editingUnitId, nama: namaUnit } : { nama: namaUnit };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      setIsUnitModalOpen(false);
      fetchUnits();
    } catch (err: unknown) {
      setErrorUnit(err instanceof Error ? err.message : "Gagal menyimpan satuan");
    } finally {
      setSavingUnit(false);
    }
  };

  const handleDeleteUnit = async (id: string, unitNama: string) => {
    if (!confirm(`Hapus satuan "${unitNama}"?`)) return;

    try {
      const res = await fetch(`/api/units?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      fetchUnits();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Gagal menghapus satuan");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center space-x-2.5">
            <Layers className="w-6 h-6 text-emerald-600" />
            <span>Kategori & Satuan Barang</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Kelola data referensi kelompok barang dan unit satuan pengukuran persediaan BHP.
          </p>
        </div>
        {activeTab === "kategori" ? (
          <button
            onClick={openCreateCat}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl text-sm transition shadow flex items-center space-x-2 self-start"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Kategori</span>
          </button>
        ) : (
          <button
            onClick={openCreateUnit}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl text-sm transition shadow flex items-center space-x-2 self-start"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Satuan</span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab("kategori")}
          className={`pb-3 px-4 text-sm font-semibold flex items-center space-x-2 border-b-2 transition-colors ${
            activeTab === "kategori"
              ? "border-emerald-600 text-emerald-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Kategori Barang ({categories.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("satuan")}
          className={`pb-3 px-4 text-sm font-semibold flex items-center space-x-2 border-b-2 transition-colors ${
            activeTab === "satuan"
              ? "border-emerald-600 text-emerald-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Ruler className="w-4 h-4" />
          <span>Satuan Barang ({units.length})</span>
        </button>
      </div>

      {/* TAB 1: KATEGORI */}
      {activeTab === "kategori" && (
        <div className="space-y-4">
          {errorCat && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start space-x-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-600" />
              <span>{errorCat}</span>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm max-w-2xl">
            {loadingCat ? (
              <div className="p-12 text-center text-slate-400 text-sm">Memuat kategori...</div>
            ) : categories.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm">
                Belum ada kategori untuk bidang ini. Silakan tambahkan kategori baru.
              </div>
            ) : (
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3.5">Nama Kategori (Bidang Aktif)</th>
                    <th className="px-6 py-3.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {categories.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-6 py-4 font-semibold text-slate-900">{c.nama}</td>
                      <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => openEditCat(c)}
                          className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                          title="Edit Kategori"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteCat(c.id, c.nama)}
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Hapus Kategori"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: SATUAN */}
      {activeTab === "satuan" && (
        <div className="space-y-4">
          {errorUnit && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start space-x-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-600" />
              <span>{errorUnit}</span>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm max-w-2xl">
            {loadingUnit ? (
              <div className="p-12 text-center text-slate-400 text-sm">Memuat satuan...</div>
            ) : units.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm">
                Belum ada data satuan. Silakan tambahkan satuan baru.
              </div>
            ) : (
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3.5">Nama Satuan (Global)</th>
                    <th className="px-6 py-3.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {units.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-6 py-4 font-semibold text-slate-900">{u.nama}</td>
                      <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => openEditUnit(u)}
                          className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                          title="Edit Satuan"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteUnit(u.id, u.nama)}
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Hapus Satuan"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Modal Kategori Add / Edit */}
      {isCatModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-base flex items-center space-x-2">
                <Layers className="w-5 h-5 text-emerald-600" />
                <span>{editingCatId ? "Edit Kategori" : "Tambah Kategori Baru"}</span>
              </h3>
              <button
                onClick={() => setIsCatModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCat} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Nama Kategori *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Alat Tulis Kantor"
                  value={namaCat}
                  onChange={(e) => setNamaCat(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 text-sm"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsCatModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingCat}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition shadow flex items-center space-x-2"
                >
                  <Check className="w-4 h-4" />
                  <span>{savingCat ? "Menyimpan..." : "Simpan Kategori"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Satuan Add / Edit */}
      {isUnitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-base flex items-center space-x-2">
                <Ruler className="w-5 h-5 text-emerald-600" />
                <span>{editingUnitId ? "Edit Satuan" : "Tambah Satuan Baru"}</span>
              </h3>
              <button
                onClick={() => setIsUnitModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUnit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Nama Satuan *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: pcs, paket, unit, box"
                  value={namaUnit}
                  onChange={(e) => setNamaUnit(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 text-sm"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Nama satuan otomatis disimpan dalam huruf kecil (lowercase).
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsUnitModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingUnit}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition shadow flex items-center space-x-2"
                >
                  <Check className="w-4 h-4" />
                  <span>{savingUnit ? "Menyimpan..." : "Simpan Satuan"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
