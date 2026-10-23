import Link from "next/link";
import { FileQuestion, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
          <FileQuestion className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">404 — Halaman Tidak Ditemukan</h2>
          <p className="text-xs text-slate-500 mt-1">
            Halaman atau dokumen persediaan yang Anda tuju tidak tersedia atau telah dipindahkan.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Dashboard</span>
        </Link>
      </div>
    </div>
  );
}
