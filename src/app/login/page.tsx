"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, ShieldAlert, KeyRound, User, Building } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal masuk");
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  const fillQuick = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
        {/* Header Bar */}
        <div className="bg-emerald-700 px-8 py-8 text-white text-center relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-36 h-36 bg-emerald-600/30 rounded-full blur-2xl" />
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 mb-3 shadow-inner">
            <Building className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">SIPERSEDIA</h1>
          <p className="text-xs text-emerald-100 mt-1 font-medium leading-relaxed">
            Sistem Informasi Persediaan Barang Habis Pakai (BHP)<br />
            Dinas Perumahan Rakyat dan Kawasan Permukiman
          </p>
        </div>

        {/* Form Body */}
        <div className="p-8">
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start space-x-2.5">
              <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Username Akun
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Contoh: superadmin"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Kata Sandi
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl text-sm shadow-md shadow-emerald-600/20 transition flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <LogIn className="w-4 h-4" />
              <span>{loading ? "Memverifikasi..." : "Masuk ke Sistem"}</span>
            </button>
          </form>

          {/* Quick Credential Hints for Convenience */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Akun Cepat untuk Pengujian:
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => fillQuick("superadmin", "admin123")}
                className="text-left p-2 rounded-lg bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 transition"
              >
                <div className="font-semibold text-slate-700">Superadmin</div>
                <div className="text-[11px] text-slate-500">superadmin</div>
              </button>
              <button
                type="button"
                onClick={() => fillQuick("operator.sekretariat", "operator123")}
                className="text-left p-2 rounded-lg bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 transition"
              >
                <div className="font-semibold text-slate-700">Op. Sekretariat</div>
                <div className="text-[11px] text-slate-500">operator.sekretariat</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
