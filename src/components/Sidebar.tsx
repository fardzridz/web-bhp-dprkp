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
  ClipboardList,
  ClipboardCheck,
  Scale,
  Truck,
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
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // fallback
    }
    window.location.href = "/login";
  };

  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Master Barang", href: "/barang", icon: Package },
    { label: "Kategori Barang", href: "/kategori", icon: Layers },
    { label: "Master Vendor", href: "/vendor", icon: Truck },
    { label: "Barang Masuk (Penerimaan)", href: "/transaksi/masuk", icon: ArrowDownLeft },
    { label: "Barang Keluar (BAST)", href: "/transaksi/keluar", icon: ArrowUpRight },
    { label: "Stock Opname", href: "/opname", icon: ClipboardCheck },
    { label: "Kartu Stok & Persediaan", href: "/kartu-stok", icon: Boxes },
    { label: "Laporan Resmi DPRKP", href: "/laporan", icon: FileText },
    { label: "Log Manajer", href: "/log-manajer", icon: ClipboardList },
  ];

  const adminItems = [
    { label: "Saldo Awal Persediaan", href: "/saldo-awal", icon: Scale },
    { label: "Kelola Unit Kerja (Bidang)", href: "/admin/bidang", icon: Building2 },
    { label: "Kelola Pengguna", href: "/admin/users", icon: Users },
    { label: "Profil SKPD & TTD", href: "/admin/pengaturan", icon: Settings },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-100 h-screen sticky top-0 flex flex-col border-r border-slate-800 no-print flex-shrink-0 overflow-hidden">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800 flex items-center space-x-3">
        <img
          src="/logo-pasuruan.png"
          alt="Logo Kota Pasuruan"
          className="w-10 h-10 object-contain drop-shadow"
        />
        <div>
          <h1 className="font-bold text-sm tracking-wide text-white leading-tight">
            SIPERSEDIA
          </h1>
          <p className="text-xs text-slate-400">DPRKP Kota Pasuruan</p>
        </div>
      </div>

      {/* Active Bidang Indicator */}
      {/* Active Unit Kerja Indicator */}
      <div className="mx-4 mt-4 p-3 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs">
        <div className="text-slate-400 font-medium">Unit Kerja Aktif:</div>
        <div className="font-semibold text-emerald-400 truncate mt-0.5">
          {user.activeBidangNama || "Pilih Unit Kerja"}
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
      <div className="p-4 border-t border-slate-800 bg-slate-950/60 space-y-3">
        <div className="truncate">
          <p className="text-sm font-semibold text-white truncate">{user.nama}</p>
          <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase bg-emerald-950 text-emerald-400 border border-emerald-800">
            {user.role === "SUPERADMIN" ? "Superadmin Dinas" : "Operator Unit Kerja"}
          </span>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="w-full py-2 px-3 bg-slate-800 hover:bg-rose-950/80 hover:text-rose-400 hover:border-rose-800/80 border border-slate-700 text-slate-300 font-medium rounded-xl text-xs transition flex items-center justify-center space-x-2 shadow-sm"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Keluar (Logout)</span>
        </button>
      </div>
    </aside>
  );
}
