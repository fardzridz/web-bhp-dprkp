"use client";

import { useState, useEffect } from "react";
import { Layers, Plus, Pencil, Trash2, X, Check, AlertCircle } from "lucide-react";

interface CategoryItem {
  id: string;
  nama: string;
  createdAt: number;
}

export default function KategoriPage() {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nama, setNama] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/categories");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setCategories(json.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal memuat kategori");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setNama("");
    setIsModalOpen(true);
  };

  const openEdit = (c: CategoryItem) => {
    setEditingId(c.id);
    setNama(c.nama);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const url = "/api/categories";
      const method = editingId ? "PUT" : "POST";
      const body = editingId ? { id: editingId, nama } : { nama };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      setIsModalOpen(false);
      fetchCategories();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, catNama: string) => {
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center space-x-2.5">
            <Layers className="w-6 h-6 text-emerald-600" />
            <span>Kategori Barang (Bidang Aktif)</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Kelompokkan jenis barang seperti Alat Tulis Kantor, Kertas dan Cover, Bahan Kebersihan, dll.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl text-sm transition shadow flex items-center space-x-2 self-start"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Kategori</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start space-x-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm max-w-2xl">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Memuat kategori...</div>
        ) : categories.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            Belum ada kategori untuk bidang ini. Silakan tambahkan kategori baru.
          </div>
        ) : (
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-6 py-3.5">Nama Kategori</th>
                <th className="px-6 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {categories.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/70 transition">
                  <td className="px-6 py-4 font-semibold text-slate-900">{c.nama}</td>
                  <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                    <button
                      onClick={() => openEdit(c)}
                      className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                      title="Edit Kategori"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(c.id, c.nama)}
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

      {/* Modal Add / Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-base flex items-center space-x-2">
                <Layers className="w-5 h-5 text-emerald-600" />
                <span>{editingId ? "Edit Kategori" : "Tambah Kategori Baru"}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Nama Kategori *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Alat Tulis Kantor"
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 text-sm"
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
                  <span>{saving ? "Menyimpan..." : "Simpan Kategori"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
