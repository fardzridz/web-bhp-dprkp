"use client";

import { useState, useEffect } from "react";
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  AlertCircle,
  KeyRound,
  Shield,
  Building,
} from "lucide-react";

interface UserItem {
  id: string;
  username: string;
  nama: string;
  role: string;
  bidangId: string | null;
  namaBidang: string;
  status: string;
}

interface BidangOption {
  id: string;
  nama: string;
  kode: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [bidangOptions, setBidangOptions] = useState<BidangOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    username: "",
    nama: "",
    password: "",
    role: "OPERATOR_BIDANG",
    bidangId: "",
    status: "ACTIVE",
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [uRes, bRes] = await Promise.all([
        fetch("/api/users"),
        fetch("/api/bidang"),
      ]);

      const uJson = await uRes.json();
      const bJson = await bRes.json();

      if (!uRes.ok) throw new Error(uJson.error);
      if (!bRes.ok) throw new Error(bJson.error);

      setUsers(uJson.data);
      setBidangOptions(bJson.data);
      if (bJson.data.length > 0 && !formData.bidangId) {
        setFormData((prev) => ({ ...prev, bidangId: bJson.data[0].id }));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal memuat data");
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
      username: "",
      nama: "",
      password: "",
      role: "OPERATOR_BIDANG",
      bidangId: bidangOptions[0]?.id || "",
      status: "ACTIVE",
    });
    setIsModalOpen(true);
  };

  const openEditModal = (u: UserItem) => {
    setEditingId(u.id);
    setFormData({
      username: u.username,
      nama: u.nama,
      password: "", // empty means keep existing
      role: u.role,
      bidangId: u.bidangId || bidangOptions[0]?.id || "",
      status: u.status,
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const url = "/api/users";
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
      setError(err instanceof Error ? err.message : "Gagal menyimpan akun");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, nama: string) => {
    if (!confirm(`Hapus akun pengguna "${nama}"?`)) return;

    try {
      const res = await fetch(`/api/users?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Gagal menghapus pengguna");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center space-x-2.5">
            <Users className="w-6 h-6 text-emerald-600" />
            <span>Manajemen Akun Pengguna</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Kelola akses login untuk Superadmin Dinas dan Operator masing-masing Bidang.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl text-sm transition shadow flex items-center space-x-2 self-start"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Pengguna Baru</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start space-x-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Memuat data pengguna...</div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">Belum ada akun pengguna.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Nama & Username</th>
                  <th className="px-6 py-3.5">Peran</th>
                  <th className="px-6 py-3.5">Lingkup Bidang</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{u.nama}</div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">@{u.username}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                          u.role === "SUPERADMIN"
                            ? "bg-purple-100 text-purple-700 border border-purple-200"
                            : "bg-blue-100 text-blue-700 border border-blue-200"
                        }`}
                      >
                        {u.role === "SUPERADMIN" ? "Superadmin Dinas" : "Operator Bidang"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-1.5 text-slate-700 font-medium">
                        <Building className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <span>{u.namaBidang}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          u.status === "ACTIVE"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}
                      >
                        {u.status === "ACTIVE" ? "Aktif" : "Non-Aktif"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => openEditModal(u)}
                        className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                        title="Edit Akun"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(u.id, u.nama)}
                        className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title="Hapus Akun"
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

      {/* Modal Add / Edit User */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg my-8 overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-base flex items-center space-x-2">
                <Users className="w-5 h-5 text-emerald-600" />
                <span>{editingId ? "Edit Akun Pengguna" : "Tambah Pengguna Baru"}</span>
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
                  Nama Lengkap *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Budi Prasetyo"
                  value={formData.nama}
                  onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Username *
                </label>
                <input
                  type="text"
                  required
                  disabled={!!editingId}
                  placeholder="Contoh: operator.perumahan"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().trim() })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 text-sm font-mono disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  {editingId ? "Ganti Password (Kosongkan bila tidak diubah)" : "Password *"}
                </label>
                <input
                  type="password"
                  required={!editingId}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Peran Akun
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 text-sm bg-white"
                  >
                    <option value="OPERATOR_BIDANG">Operator Bidang</option>
                    <option value="SUPERADMIN">Superadmin Dinas</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Status Akun
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 text-sm bg-white"
                  >
                    <option value="ACTIVE">Aktif</option>
                    <option value="INACTIVE">Non-Aktif</option>
                  </select>
                </div>
              </div>

              {formData.role === "OPERATOR_BIDANG" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Tugaskan ke Bidang *
                  </label>
                  <select
                    required
                    value={formData.bidangId}
                    onChange={(e) => setFormData({ ...formData, bidangId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 text-sm bg-white"
                  >
                    {bidangOptions.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.nama} ({b.kode})
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Operator ini hanya dapat melihat dan menginput data di bidang yang dipilih.
                  </p>
                </div>
              )}

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
                  <span>{saving ? "Menyimpan..." : "Simpan Pengguna"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
