"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Layers,
  ArrowDownLeft,
  ArrowUpRight,
  FileSpreadsheet,
  FileText,
  Users,
  Building2,
  Settings,
  LogOut,
  Boxes,
} from "lucide-react";

interface SidebarProps {
  user: {
    nama: string;
    role: string;
    activeBidangNama?: string;
  };
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Master Barang", href: "/barang", icon: Package },
    { label: "Kategori Barang", href: "/kategori", icon: Layers },
    { label: "Barang Masuk (Penerimaan)", href: "/transaksi/masuk", icon: ArrowDownLeft },
    { label: "Barang Keluar (BAST)", href: "/transaksi/keluar", icon: ArrowUpRight },
    { label: "Kartu Stok & Persediaan", href: "/kartu-stok", icon: Boxes },
    { label: "Laporan Resmi DPRKP", href: "/laporan", icon: FileText },
  ];

  const adminItems = [
    { label: "Kelola Bidang", href: "/admin/bidang", icon: Building2 },
    { label: "Kelola Pengguna", href: "/admin/users", icon: Users },
    { label: "Profil SKPD & TTD", href: "/admin/pengaturan", icon: Settings },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-100 min-h-screen flex flex-col border-r border-slate-800 no-print flex-shrink-0">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800 flex items-center space-x-3">
        <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center font-bold text-white shadow-md">
          BHP
        </div>
        <div>
          <h1 className="font-bold text-sm tracking-wide text-white leading-tight">
            SIPERSEDIA
          </h1>
          <p className="text-xs text-slate-400">DPRKP Kab. Pasuruan</p>
        </div>
      </div>

      {/* Active Bidang Indicator */}
      <div className="mx-4 mt-4 p-3 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs">
        <div className="text-slate-400 font-medium">Lingkup Kerja:</div>
        <div className="font-semibold text-emerald-400 truncate mt-0.5">
          {user.activeBidangNama || "Pilih Bidang"}
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="text-[11px] font-semibold text-slate-400 px-3 py-1 uppercase tracking-wider">
          Menu Operasional
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-emerald-600 font-medium text-white shadow-sm"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}

        {user.role === "SUPERADMIN" && (
          <>
            <div className="text-[11px] font-semibold text-slate-400 px-3 pt-5 pb-1 uppercase tracking-wider">
              Superadmin Dinas
            </div>
            {adminItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive
                      ? "bg-emerald-600 font-medium text-white shadow-sm"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </>
        )}
      </div>

      {/* User Footer & Logout */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40">
        <div className="flex items-center justify-between mb-2">
          <div className="truncate pr-2">
            <p className="text-sm font-medium text-white truncate">{user.nama}</p>
            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase bg-emerald-950 text-emerald-400 border border-emerald-800">
              {user.role === "SUPERADMIN" ? "Superadmin" : "Operator"}
            </span>
          </div>
          <button
            onClick={handleLogout}
            title="Keluar"
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
