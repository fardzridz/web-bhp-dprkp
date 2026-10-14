"use client";

import { useState, useEffect } from "react";
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  AlertCircle,
  UserCheck,
} from "lucide-react";

interface BidangData {
  id: string;
  nama: string;
  kode: string;
  deskripsi: string | null;
  namaAtasan: string | null;
  nipAtasan: string | null;
  jabatanAtasan: string | null;
  pangkatAtasan: string | null;
  namaPengurus: string | null;
  nipPengurus: string | null;
  jabatanPengurus: string | null;
  pangkatPengurus: string | null;
}

export default function AdminBidangPage() {
  const [bidangList, setBidangList] = useState<BidangData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    nama: "",
    kode: "",
    deskripsi: "",
    namaAtasan: "",
    nipAtasan: "",
    jabatanAtasan: "",
    pangkatAtasan: "",
    namaPengurus: "",
    nipPengurus: "",
    jabatanPengurus: "",
    pangkatPengurus: "",
  });

  const fetchBidang = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/bidang");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setBidangList(json.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal memuat bidang");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBidang();
  }, []);

  const openCreateModal = () => {
    setEditingId(null);
    setFormData({
      nama: "",
      kode: "",
      deskripsi: "",
      namaAtasan: "",
      nipAtasan: "",
      jabatanAtasan: "Kepala Bidang",
      pangkatAtasan: "",
      namaPengurus: "",
      nipPengurus: "",
      jabatanPengurus: "Pengurus Barang Pembantu",
      pangkatPengurus: "",
    });
    setIsModalOpen(true);
  };

  const openEditModal = (b: BidangData) => {
    setEditingId(b.id);
    setFormData({
      nama: b.nama,
      kode: b.kode,
      deskripsi: b.deskripsi || "",
      namaAtasan: b.namaAtasan || "",
      nipAtasan: b.nipAtasan || "",
      jabatanAtasan: b.jabatanAtasan || "",
      pangkatAtasan: b.pangkatAtasan || "",
      namaPengurus: b.namaPengurus || "",
      nipPengurus: b.nipPengurus || "",
      jabatanPengurus: b.jabatanPengurus || "",
      pangkatPengurus: b.pangkatPengurus || "",
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const url = "/api/bidang";
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
      fetchBidang();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, nama: string) => {
    if (!confirm(`Hapus bidang "${nama}"? Data barang yang terkait harus kosong.`)) return;

    try {
      const res = await fetch(`/api/bidang?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      fetchBidang();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Gagal menghapus bidang");
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center space-x-2.5">
            <Building2 className="w-6 h-6 text-emerald-600" />
            <span>Manajemen Bidang (Dinamis)</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Tambah, edit, atau sesuaikan data bidang dan pejabat penandatangan dokumen resmi.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl text-sm transition shadow flex items-center space-x-2 self-start"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Bidang Baru</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start space-x-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Bidang Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Memuat daftar bidang...</div>
        ) : bidangList.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">Belum ada bidang terdaftar.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Kode & Nama Bidang</th>
                  <th className="px-6 py-3.5">Atasan Langsung (Mengetahui)</th>
                  <th className="px-6 py-3.5">Pengurus / Penyimpan Barang</th>
                  <th className="px-6 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bidangList.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {b.kode}
                        </span>
                        <span className="font-semibold text-slate-900">{b.nama}</span>
                      </div>
                      {b.deskripsi && (
                        <p className="text-xs text-slate-500 mt-1 max-w-xs">{b.deskripsi}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-800">
                        {b.namaAtasan || "-"}
                      </div>
                      <div className="text-xs text-slate-500">
                        NIP: {b.nipAtasan || "-"} • {b.jabatanAtasan || "-"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-800">
                        {b.namaPengurus || "-"}
                      </div>
                      <div className="text-xs text-slate-500">
                        NIP: {b.nipPengurus || "-"} • {b.jabatanPengurus || "-"}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => openEditModal(b)}
                        className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                        title="Edit Bidang & TTD"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(b.id, b.nama)}
                        className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title="Hapus Bidang"
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

      {/* Modal Add / Edit Bidang */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl my-8 overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-base flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-emerald-600" />
                <span>{editingId ? "Edit Data Bidang" : "Tambah Bidang Baru"}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Kode Bidang *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: PRMH"
                    value={formData.kode}
                    onChange={(e) => setFormData({ ...formData, kode: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 text-sm font-semibold uppercase"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Nama Bidang *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Bidang Perumahan"
                    value={formData.nama}
                    onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Deskripsi / Keterangan
                </label>
                <input
                  type="text"
                  placeholder="Keterangan singkat tentang lingkup bidang"
                  value={formData.deskripsi}
                  onChange={(e) => setFormData({ ...formData, deskripsi: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 text-sm"
                />
              </div>

              {/* Pejabat Atasan */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="font-semibold text-xs text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
                  <UserCheck className="w-4 h-4 text-emerald-600" />
                  <span>Atasan Langsung (Mengetahui Dokumen)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Nama Lengkap & Gelar</label>
                    <input
                      type="text"
                      placeholder="Contoh: Budi Santoso, ST, MT"
                      value={formData.namaAtasan}
                      onChange={(e) => setFormData({ ...formData, namaAtasan: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">NIP</label>
                    <input
                      type="text"
                      placeholder="19750820 200212 1 006"
                      value={formData.nipAtasan}
                      onChange={(e) => setFormData({ ...formData, nipAtasan: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Jabatan TTD</label>
                    <input
                      type="text"
                      placeholder="Kepala Bidang Perumahan"
                      value={formData.jabatanAtasan}
                      onChange={(e) => setFormData({ ...formData, jabatanAtasan: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Pangkat / Golongan</label>
                    <input
                      type="text"
                      placeholder="Pembina (IV/a)"
                      value={formData.pangkatAtasan}
                      onChange={(e) => setFormData({ ...formData, pangkatAtasan: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Pejabat Pengurus Barang */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="font-semibold text-xs text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
                  <UserCheck className="w-4 h-4 text-emerald-600" />
                  <span>Pengurus / Penyimpan Barang Bidang</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Nama Pengurus</label>
                    <input
                      type="text"
                      placeholder="Contoh: Siti Rahmawati, A.Md"
                      value={formData.namaPengurus}
                      onChange={(e) => setFormData({ ...formData, namaPengurus: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">NIP</label>
                    <input
                      type="text"
                      placeholder="19900315 201402 2 003"
                      value={formData.nipPengurus}
                      onChange={(e) => setFormData({ ...formData, nipPengurus: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Jabatan TTD</label>
                    <input
                      type="text"
                      placeholder="Pengurus Barang Pembantu"
                      value={formData.jabatanPengurus}
                      onChange={(e) => setFormData({ ...formData, jabatanPengurus: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Pangkat / Golongan</label>
                    <input
                      type="text"
                      placeholder="Pengatur Tingkat I (II/d)"
                      value={formData.pangkatPengurus}
                      onChange={(e) => setFormData({ ...formData, pangkatPengurus: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>
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
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition shadow flex items-center space-x-2"
                >
                  <Check className="w-4 h-4" />
                  <span>{saving ? "Menyimpan..." : "Simpan Data Bidang"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
