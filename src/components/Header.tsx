"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, ChevronDown, Check } from "lucide-react";

interface HeaderProps {
  user: {
    nama: string;
    role: string;
    activeBidangId: string | null;
  };
  bidangList: Array<{
    id: string;
    nama: string;
    kode: string;
  }>;
  activeBidang?: {
    id: string;
    nama: string;
    kode: string;
  } | null;
}

export function Header({ user, bidangList, activeBidang }: HeaderProps) {
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  const handleSwitchBidang = async (targetBidangId: string) => {
    if (targetBidangId === user.activeBidangId) {
      setDropdownOpen(false);
      return;
    }
    setSwitching(true);
    try {
      const res = await fetch("/api/auth/switch-bidang", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bidangId: targetBidangId }),
      });
      if (res.ok) {
        setDropdownOpen(false);
        router.refresh();
      }
    } finally {
      setSwitching(false);
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between no-print z-10 sticky top-0">
      <div className="flex items-center space-x-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Sistem Informasi Persediaan BHP
        </span>
      </div>

      <div className="flex items-center space-x-4">
        {/* Switcher for Superadmin */}
        {user.role === "SUPERADMIN" ? (
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              disabled={switching}
              className="flex items-center space-x-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-1.5 rounded-lg text-sm font-medium transition shadow-sm"
            >
              <Building2 className="w-4 h-4 text-emerald-600" />
              <span>
                Bidang: <strong className="font-semibold">{activeBidang?.nama || "Pilih Bidang"}</strong>
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-emerald-700" />
            </button>

            {dropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-30 animate-in fade-in zoom-in-95">
                  <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Ganti Lingkup Bidang
                  </div>
                  {bidangList.map((b) => {
                    const isSelected = b.id === user.activeBidangId;
                    return (
                      <button
                        key={b.id}
                        onClick={() => handleSwitchBidang(b.id)}
                        className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between transition ${
                          isSelected
                            ? "bg-emerald-50 text-emerald-800 font-semibold"
                            : "text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <div className="truncate">
                          <div>{b.nama}</div>
                          <span className="text-[11px] text-slate-400 font-normal">
                            Kode: {b.kode}
                          </span>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-emerald-600 ml-2 flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center space-x-2 bg-slate-100 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-sm">
            <Building2 className="w-4 h-4 text-slate-500" />
            <span className="font-medium">{activeBidang?.nama || "Bidang Kerja"}</span>
          </div>
        )}
      </div>
    </header>
  );
}
