"use client";

import { useState } from "react";
import Link from "next/link";
import { Database, CheckCircle, AlertTriangle, ArrowRight, Loader2 } from "lucide-react";

export default function InitDbPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    executed?: number;
    total?: number;
  } | null>(null);

  const handleInit = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/init-db", { method: "POST" });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({
        success: false,
        message: "Gagal menghubungi server untuk inisialisasi database.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-slate-800 rounded-3xl border border-slate-700/60 p-8 shadow-2xl text-center space-y-6">
        <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto border border-emerald-500/20">
          <Database className="w-8 h-8" />
        </div>

        <div>
          <h1 className="text-xl font-bold text-white tracking-wide">
            Inisialisasi Database D1
          </h1>
          <p className="text-sm text-slate-400 mt-2">
            SIPERSEDIA — Pengelolaan BHP Dinas Perumahan Rakyat dan Kawasan Permukiman Kota Pasuruan
          </p>
        </div>

        <div className="bg-slate-900/60 rounded-2xl p-4 text-left text-xs text-slate-300 space-y-2 border border-slate-700/40">
          <p className="font-semibold text-slate-200">Tombol ini otomatis membuat:</p>
          <ul className="list-disc list-inside space-y-1 text-slate-400">
            <li>17 tabel database resmi (FIFO, transaksi, kartu stok, opname)</li>
            <li>Data instansi DPRKP Kota Pasuruan</li>
            <li>4 Bidang dinas (Sekretariat, Perumahan, Permukiman, Pertanahan)</li>
            <li>Satuan barang resmi</li>
            <li>Akun login default: <span className="text-emerald-400 font-mono">superadmin</span> / <span className="text-emerald-400 font-mono">admin123</span></li>
          </ul>
        </div>

        {result && (
          <div
            className={`p-4 rounded-2xl text-xs flex items-start space-x-3 text-left ${
              result.success
                ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300"
                : "bg-rose-500/10 border border-rose-500/30 text-rose-300"
            }`}
          >
            {result.success ? (
              <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-400" />
            )}
            <div className="space-y-1">
              <p className="font-semibold">{result.success ? "Berhasil!" : "Terjadi Kendala"}</p>
              <p className="opacity-90">{result.message}</p>
            </div>
          </div>
        )}

        <div className="space-y-3 pt-2">
          {!result?.success ? (
            <button
              onClick={handleInit}
              disabled={loading}
              className="w-full py-3.5 px-5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition shadow-lg shadow-emerald-900/30 flex items-center justify-center space-x-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Sedang Menyiapkan Database...</span>
                </>
              ) : (
                <>
                  <Database className="w-5 h-5" />
                  <span>Inisialisasi Database D1 Sekarang</span>
                </>
              )}
            </button>
          ) : (
            <Link
              href="/login"
              className="w-full py-3.5 px-5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm rounded-xl transition shadow-lg shadow-emerald-900/30 flex items-center justify-center space-x-2"
            >
              <span>Lanjut ke Halaman Login</span>
              <ArrowRight className="w-5 h-5" />
            </Link>
          )}

          <div className="text-center">
            <Link
              href="/login"
              className="text-xs text-slate-400 hover:text-slate-200 transition underline underline-offset-4"
            >
              Sudah pernah inisialisasi? Masuk ke Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
