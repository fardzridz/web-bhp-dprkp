"use client";

import { useState, useEffect } from "react";
import {
  ClipboardList,
  Search,
  Filter,
  User,
  Building,
  Calendar,
  ArrowDownLeft,
  ArrowUpRight,
  Package,
  LogIn,
  Trash2,
  RefreshCw,
} from "lucide-react";

interface LogEntry {
  id: string;
  userId: string | null;
  userName: string;
  userRole: string;
  bidangId: string | null;
  bidangNama: string | null;
  action: string;
  description: string;
  metadata: string | null;
  createdAt: number;
}

interface BidangOption {
  id: string;
  nama: string;
  kode: string;
}

export default function LogManajerPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [bidangList, setBidangList] = useState<BidangOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [actionFilter, setActionFilter] = useState("");
  const [bidangFilter, setBidangFilter] = useState("");
  const [search, setSearch] = useState("");

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (actionFilter) params.set("action", actionFilter);
      if (bidangFilter) params.set("bidangId", bidangFilter);

      const res = await fetch(`/api/logs?${params.toString()}`);
      const json = await res.json();
      if (res.ok) {
        setLogs(json.data);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchBidang = async () => {
    try {
      const res = await fetch("/api/bidang");
      const json = await res.json();
      if (res.ok) setBidangList(json.data);
    } catch {
      // silent
    }
  };

  useEffect(() => {
    fetchBidang();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [actionFilter, bidangFilter]);

  const filteredLogs = logs.filter((l) => {
    return (
      l.userName.toLowerCase().includes(search.toLowerCase()) ||
      l.description.toLowerCase().includes(search.toLowerCase()) ||
      (l.bidangNama && l.bidangNama.toLowerCase().includes(search.toLowerCase()))
    );
  });

  const getActionBadge = (action: string) => {
    switch (action) {
      case "INPUT_MASUK":
        return {
          label: "Barang Masuk",
          bg: "bg-emerald-100 text-emerald-800 border-emerald-200",
          icon: ArrowDownLeft,
        };
      case "INPUT_KELUAR":
        return {
          label: "Barang Keluar (BAST)",
          bg: "bg-blue-100 text-blue-800 border-blue-200",
          icon: ArrowUpRight,
        };
      case "TAMBAH_BARANG":
        return {
          label: "Tambah Barang",
          bg: "bg-indigo-100 text-indigo-800 border-indigo-200",
          icon: Package,
        };
      case "UBAH_BARANG":
        return {
          label: "Ubah Barang",
          bg: "bg-amber-100 text-amber-800 border-amber-200",
          icon: RefreshCw,
        };
      case "HAPUS_BARANG":
        return {
          label: "Hapus Barang",
          bg: "bg-rose-100 text-rose-800 border-rose-200",
          icon: Trash2,
        };
      case "LOGIN":
        return {
          label: "Login Akun",
          bg: "bg-purple-100 text-purple-800 border-purple-200",
          icon: LogIn,
        };
      default:
        return {
          label: action,
          bg: "bg-slate-100 text-slate-800 border-slate-200",
          icon: ClipboardList,
        };
    }
  };

  const formatTimestamp = (ts: number) => {
    const d = new Date(ts);
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(d);
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center space-x-2.5">
            <ClipboardList className="w-6 h-6 text-emerald-600" />
            <span>Log Manajer (Riwayat Aktivitas Sistem)</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Audit trail rekam jejak aktivitas pengguna: login, input barang masuk, pengeluaran BAST, dan perubahan master.
          </p>
        </div>
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-medium rounded-xl text-xs transition shadow-sm flex items-center space-x-1.5 self-start disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? "animate-spin" : ""}`} />
          <span>Segarkan Log</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full sm:max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Cari nama pengguna atau detail aktivitas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Semua Jenis Aksi</option>
            <option value="LOGIN">Login</option>
            <option value="INPUT_MASUK">Barang Masuk</option>
            <option value="INPUT_KELUAR">Barang Keluar (BAST)</option>
            <option value="TAMBAH_BARANG">Tambah Barang</option>
            <option value="UBAH_BARANG">Ubah Barang</option>
            <option value="HAPUS_BARANG">Hapus Barang</option>
          </select>

          {bidangList.length > 0 && (
            <select
              value={bidangFilter}
              onChange={(e) => setBidangFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Semua Unit Kerja</option>
              {bidangList.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nama}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Log Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Memuat riwayat log...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            Tidak ada riwayat aktivitas yang sesuai kriteria pencarian.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5 w-44">Waktu & Tanggal</th>
                  <th className="px-6 py-3.5 w-48">Pengguna</th>
                  <th className="px-6 py-3.5 w-44">Aksi</th>
                  <th className="px-6 py-3.5">Detail Aktivitas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map((log) => {
                  const badge = getActionBadge(log.action);
                  const Icon = badge.icon;
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-6 py-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                        {formatTimestamp(log.createdAt)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900">{log.userName}</div>
                        <div className="text-[11px] text-slate-400">
                          {log.userRole === "SUPERADMIN" ? "Superadmin Dinas" : "Operator Bidang"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${badge.bg}`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{badge.label}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-800 leading-relaxed">
                          {log.description}
                        </div>
                        {log.bidangNama && (
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Unit Kerja: {log.bidangNama}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
