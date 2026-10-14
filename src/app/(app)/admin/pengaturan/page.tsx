"use client";

import { useState, useEffect } from "react";
import { Settings, Check, AlertCircle, Building, UserCheck } from "lucide-react";

export default function AdminPengaturanPage() {
  const [settings, setSettings] = useState<Record<string, string>>({
    NAMA_INSTANSI: "",
    KAB_KOTA: "",
    PROVINSI: "",
    TEMPAT_TTD: "",
    NAMA_KEPALA: "",
    NIP_KEPALA: "",
    JABATAN_KEPALA: "",
    PANGKAT_KEPALA: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/settings");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setSettings((prev) => ({ ...prev, ...json.data }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal memuat pengaturan");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      setMessage("Profil SKPD dan pejabat penandatangan berhasil diperbarui!");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center space-x-2.5">
          <Settings className="w-6 h-6 text-emerald-600" />
          <span>Profil SKPD & Penandatangan Utama</span>
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Identitas instansi dan data Kepala Dinas untuk kop dan lembar pengesahan laporan resmi.
        </p>
      </div>

      {message && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center space-x-2">
          <Check className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
        {/* Identitas Instansi */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-2 border-b border-slate-100 pb-2">
            <Building className="w-4 h-4 text-emerald-600" />
            <span>Identitas Instansi (SKPD)</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Nama Instansi (SKPD)
              </label>
              <input
                type="text"
                required
                value={settings.NAMA_INSTANSI || ""}
                onChange={(e) => setSettings({ ...settings, NAMA_INSTANSI: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Kabupaten / Kota
              </label>
              <input
                type="text"
                required
                value={settings.KAB_KOTA || ""}
                onChange={(e) => setSettings({ ...settings, KAB_KOTA: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Provinsi
              </label>
              <input
                type="text"
                required
                value={settings.PROVINSI || ""}
                onChange={(e) => setSettings({ ...settings, PROVINSI: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Tempat Penandatanganan Dokumen
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: Pasuruan"
                value={settings.TEMPAT_TTD || ""}
                onChange={(e) => setSettings({ ...settings, TEMPAT_TTD: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Kepala Dinas */}
        <div className="space-y-4 pt-2">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-2 border-b border-slate-100 pb-2">
            <UserCheck className="w-4 h-4 text-emerald-600" />
            <span>Kepala Dinas (Mengetahui Utama)</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Nama Lengkap & Gelar
              </label>
              <input
                type="text"
                placeholder="Ir. H. Hari Apriyanto"
                value={settings.NAMA_KEPALA || ""}
                onChange={(e) => setSettings({ ...settings, NAMA_KEPALA: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                NIP
              </label>
              <input
                type="text"
                placeholder="19680415 199803 1 005"
                value={settings.NIP_KEPALA || ""}
                onChange={(e) => setSettings({ ...settings, NIP_KEPALA: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Jabatan
              </label>
              <input
                type="text"
                placeholder="Kepala Dinas Perumahan Rakyat dan Kawasan Permukiman"
                value={settings.JABATAN_KEPALA || ""}
                onChange={(e) => setSettings({ ...settings, JABATAN_KEPALA: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Pangkat / Golongan
              </label>
              <input
                type="text"
                placeholder="Pembina Utama Muda (IV/c)"
                value={settings.PANGKAT_KEPALA || ""}
                onChange={(e) => setSettings({ ...settings, PANGKAT_KEPALA: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
              />
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition shadow flex items-center space-x-2"
          >
            <Check className="w-4 h-4" />
            <span>{saving ? "Menyimpan..." : "Simpan Pengaturan"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
