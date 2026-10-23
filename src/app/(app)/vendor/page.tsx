"use client";

import { useState, useEffect, useMemo } from "react";
import { Truck, Plus, Pencil, Trash2, X, Check, AlertCircle, Search, Info } from "lucide-react";

interface VendorData {
  id: string;
  nama: string;
  npwp: string | null;
  alamat: string | null;
  telepon: string | null;
}

export default function VendorPage() {
  const [vendors, setVendors] = useState<VendorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [search, setSearch] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nama: "",
    npwp: "",
    alamat: "",
    telepon: "",
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [vRes, meRes] = await Promise.all([fetch("/api/vendors"), fetch("/api/auth/me")]);
      const vJson = await vRes.json();
      const meJson = await meRes.json();

      if (!vRes.ok) throw new Error(vJson.error);
      setVendors(vJson.data || []);
      setCanManage(meJson?.user?.role === "SUPERADMIN");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal memuat data vendor");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreateModal = () => {
    setEditingId(null);
    setFormData({ nama: "", npwp: "", alamat: "", telepon: "" });
    setIsModalOpen(true);
  };

  const openEditModal = (v: VendorData) => {
    setEditingId(v.id);
    setFormData({
      nama: v.nama,
      npwp: v.npwp || "",
      alamat: v.alamat || "",
      telepon: v.telepon || "",
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const payload: Record<string, unknown> = { ...formData };
      if (editingId) payload.id = editingId;

      const res = await fetch("/api/vendors", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      setNotice(
        editingId ? `Data vendor "${formData.nama}" berhasil diperbarui.` : `Vendor "${formData.nama}" berhasil ditambahkan.`
      );
      setIsModalOpen(false);
      setEditingId(null);
      fetchData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan vendor");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (v: VendorData) => {
    if (!confirm(`Hapus vendor "${v.nama}"?`)) return;
    setError(null);
    setNotice(null);

    try {
      const res = await fetch(`/api/vendors?id=${v.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setNotice(`Vendor "${v.nama}" dihapus.`);
      fetchData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal menghapus vendor");
    }
  };

  const filteredVendors = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return vendors;
    return vendors.filter((v) =>
      `${v.nama} ${v.npwp || ""} ${v.alamat || ""} ${v.telepon || ""}`.toLowerCase().includes(keyword)
    );
  }, [vendors, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center space-x-2.5">
            <Truck className="w-6 h-6 text-emerald-600" />
            <span>Master Vendor / Penyedia</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Daftar rekanan beserta NPWP dan alamatnya. Data ini mengisi kolom &quot;Dari&quot; pada Buku Penerimaan
            Barang (Lampiran 8) dan kelengkapan dokumen penerimaan.
          </p>
        </div>
        {canManage && (
          <button
            onClick={openCreateModal}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl text-sm transition shadow flex items-center space-x-2 self-start"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Vendor</span>
          </button>
        )}
      </div>

      {!canManage && !loading && (
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-sm flex items-start space-x-2">
          <Info className="w-5 h-5 flex-shrink-0 mt-0.5 text-slate-500" />
          <span>
            Anda dapat melihat daftar vendor. Penambahan/perubahan data vendor hanya dapat dilakukan oleh Superadmin
            Dinas.
          </span>
        </div>
      )}

      {notice && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">{notice}</div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start space-x-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="p-4 border-b border-slate-200 flex items-center space-x-3">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, NPWP, atau alamat vendor..."
            className="w-full text-sm border-0 focus:ring-0 focus:outline-none"
          />
          <span className="text-xs text-slate-400 whitespace-nowrap">{filteredVendors.length} vendor</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Memuat data vendor...</div>
        ) : filteredVendors.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">Belum ada data vendor.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5 w-14">No</th>
                  <th className="px-6 py-3.5">Nama Penyedia</th>
                  <th className="px-6 py-3.5">NPWP</th>
                  <th className="px-6 py-3.5">Alamat</th>
                  <th className="px-6 py-3.5">Telepon</th>
                  {canManage && <th className="px-6 py-3.5 text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredVendors.map((v, idx) => (
                  <tr key={v.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-6 py-4 text-slate-500 text-xs">{idx + 1}</td>
                    <td className="px-6 py-4 font-medium text-slate-800">{v.nama}</td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-600">{v.npwp || "-"}</td>
                    <td className="px-6 py-4 text-xs text-slate-600">{v.alamat || "-"}</td>
                    <td className="px-6 py-4 text-xs text-slate-600">{v.telepon || "-"}</td>
                    {canManage && (
                      <td className="px-6 py-4 text-right whitespace-nowrap space-x-1.5">
                        <button
                          onClick={() => openEditModal(v)}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold transition inline-flex items-center space-x-1"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => handleDelete(v)}
                          className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition inline-flex items-center"
                          title="Hapus vendor"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg my-8 overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-base flex items-center space-x-2">
                <Truck className="w-5 h-5 text-emerald-600" />
                <span>{editingId ? "Edit Vendor" : "Tambah Vendor Baru"}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
                type="button"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Nama Penyedia *</label>
                <input
                  type="text"
                  required
                  value={formData.nama}
                  onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                  placeholder="Contoh: CV Centrojaya"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">NPWP</label>
                <input
                  type="text"
                  value={formData.npwp}
                  onChange={(e) => setFormData({ ...formData, npwp: e.target.value })}
                  placeholder="Contoh: 3514181007900001"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Alamat</label>
                <input
                  type="text"
                  value={formData.alamat}
                  onChange={(e) => setFormData({ ...formData, alamat: e.target.value })}
                  placeholder="Contoh: Jl. Pahlawan No. 17, Pasuruan"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Telepon</label>
                <input
                  type="text"
                  value={formData.telepon}
                  onChange={(e) => setFormData({ ...formData, telepon: e.target.value })}
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
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition shadow flex items-center space-x-2 disabled:opacity-60"
                >
                  <Check className="w-4 h-4" />
                  <span>{saving ? "Menyimpan..." : "Simpan"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
