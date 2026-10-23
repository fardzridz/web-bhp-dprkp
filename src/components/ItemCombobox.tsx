"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search } from "lucide-react";
import { formatAngka, formatRupiah } from "@/lib/format";

export interface ItemPilihan {
  id: string;
  kode: string;
  nama: string;
  satuanNama: string;
  /** Selalu dikirim oleh GET /api/items. */
  stok: number;
  nilaiPersediaan: number;
  hargaTerakhir: number | null;
  hargaTerakhirTanggal: string | null;
}

interface Kotak {
  top: number;
  left: number;
  width: number;
}

/**
 * Pemilih barang yang bisa dicari (ketik nama atau kode).
 *
 * Dipakai di form transaksi karena daftar barang cukup banyak: mitra cukup
 * mengetik beberapa huruf, arahkan dengan panah, lalu Enter.
 *
 * Daftar pilihan digambar lewat portal ke <body> dengan posisi tetap, supaya
 * tidak terpotong oleh tabel/form yang punya overflow sendiri dan tidak ikut
 * tergulir bersama isi modal.
 */
export default function ItemCombobox({
  items,
  value,
  onChange,
  disabled = false,
  placeholder = "Cari barang...",
  tampilkanStok = false,
  className,
}: {
  items: ItemPilihan[];
  value: string;
  onChange: (itemId: string) => void;
  disabled?: boolean;
  placeholder?: string;
  tampilkanStok?: boolean;
  className?: string;
}) {
  const [terbuka, setTerbuka] = useState(false);
  const [kataKunci, setKataKunci] = useState("");
  const [sorot, setSorot] = useState(0);
  const [kotak, setKotak] = useState<Kotak | null>(null);

  const tombolRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const cariRef = useRef<HTMLInputElement>(null);

  const terpilih = useMemo(() => items.find((it) => it.id === value), [items, value]);

  const hasil = useMemo(() => {
    const token = kataKunci.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const cocok = token.length
      ? items.filter((it) => {
          const teks = `${it.kode} ${it.nama}`.toLowerCase();
          return token.every((t) => teks.includes(t));
        })
      : items;
    return cocok.slice(0, 80);
  }, [items, kataKunci]);

  /**
   * Posisi daftar mengikuti tombol pemilih di layar. Dipakai saat dibuka dan
   * saat halaman/modal digulir. Mengembalikan null bila tombol sudah keluar
   * dari layar (daftar ditutup agar tidak menggantung).
   */
  const hitungKotak = (): Kotak | null => {
    const rect = tombolRef.current?.getBoundingClientRect();
    if (!rect) return null;
    if (rect.bottom < 0 || rect.top > window.innerHeight) return null;

    const width = Math.max(rect.width, 320);
    const left = Math.min(rect.left, Math.max(8, window.innerWidth - width - 8));
    const tinggiPanel = panelRef.current?.offsetHeight || Math.min(320, 48 + hasil.length * 52);
    const ruangBawah = window.innerHeight - rect.bottom;
    const top =
      ruangBawah < Math.min(tinggiPanel, 240) + 16
        ? Math.max(8, rect.top - tinggiPanel - 4)
        : rect.bottom + 4;

    return { top, left, width };
  };

  // Tutup saat klik di luar, ikuti posisi saat digulir, tutup saat tombol keluar layar.
  useEffect(() => {
    if (!terbuka) return;

    const klikLuar = (e: MouseEvent) => {
      const target = e.target as Node;
      if (tombolRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setTerbuka(false);
    };

    const perbaruiPosisi = (e: Event) => {
      // Guliran dari dalam daftar barang itu sendiri (mitra sedang mencari
      // barang) tidak boleh menutup menu.
      const target = e.target as Node | null;
      if (target && panelRef.current?.contains(target)) return;

      const kotakBaru = hitungKotak();
      if (!kotakBaru) {
        setTerbuka(false);
        return;
      }
      setKotak(kotakBaru);
    };

    document.addEventListener("mousedown", klikLuar);
    window.addEventListener("scroll", perbaruiPosisi, true);
    window.addEventListener("resize", perbaruiPosisi);
    return () => {
      document.removeEventListener("mousedown", klikLuar);
      window.removeEventListener("scroll", perbaruiPosisi, true);
      window.removeEventListener("resize", perbaruiPosisi);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terbuka, hasil.length]);

  useEffect(() => {
    if (terbuka) {
      const timer = setTimeout(() => cariRef.current?.focus(), 0);
      return () => clearTimeout(timer);
    }
    setKataKunci("");
    setSorot(0);
  }, [terbuka]);

  const buka = () => {
    if (disabled) return;
    setKotak(hitungKotak());
    setTerbuka(true);
  };

  const pilih = (id: string) => {
    onChange(id);
    setTerbuka(false);
  };

  const tombolKunci = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSorot((s) => Math.min(s + 1, hasil.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSorot((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const tujuan = hasil[sorot];
      if (tujuan) pilih(tujuan.id);
    } else if (e.key === "Escape" || e.key === "Tab") {
      setTerbuka(false);
    }
  };

  const labelTerpilih = terpilih
    ? `${terpilih.nama} (${terpilih.satuanNama})`
    : value
      ? "(barang tidak ditemukan)"
      : placeholder;

  return (
    <>
      <button
        ref={tombolRef}
        type="button"
        disabled={disabled}
        onClick={() => (terbuka ? setTerbuka(false) : buka())}
        title={terpilih ? `${terpilih.kode} — ${terpilih.nama}` : "Pilih barang persediaan"}
        className={
          className ||
          "w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-left text-xs hover:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100 disabled:text-slate-500"
        }
      >
        <span className={`truncate ${terpilih ? "text-slate-800" : "text-slate-400"}`}>
          {labelTerpilih}
        </span>
        <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
      </button>

      {terbuka &&
        kotak &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            className="fixed z-[80] bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden"
            style={{ top: kotak.top, left: kotak.left, width: kotak.width }}
          >
            <div className="p-2 border-b border-slate-100 bg-slate-50">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  ref={cariRef}
                  type="text"
                  value={kataKunci}
                  onChange={(e) => {
                    setKataKunci(e.target.value);
                    setSorot(0);
                  }}
                  onKeyDown={tombolKunci}
                  placeholder="Ketik nama atau kode barang..."
                  className="w-full pl-8 pr-2.5 py-1.5 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto overscroll-contain" role="listbox">
              {hasil.length === 0 ? (
                <div className="p-3 text-xs text-slate-400 text-center">Barang tidak ditemukan.</div>
              ) : (
                hasil.map((it, idx) => (
                  <button
                    key={it.id}
                    type="button"
                    role="option"
                    aria-selected={it.id === value}
                    onMouseEnter={() => setSorot(idx)}
                    onClick={() => pilih(it.id)}
                    className={`w-full text-left px-3 py-2 border-b border-slate-50 last:border-b-0 transition ${
                      idx === sorot ? "bg-emerald-50" : "bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-medium text-slate-800 truncate">
                        {it.nama}
                        <span className="text-slate-400 font-normal"> ({it.satuanNama})</span>
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 flex-shrink-0">{it.kode}</span>
                    </div>
                    {(tampilkanStok || it.hargaTerakhir) && (
                      <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-2">
                        {tampilkanStok && (
                          <span className={it.stok > 0 ? "text-slate-600" : "text-rose-500"}>
                            Stok: {formatAngka(it.stok)}
                          </span>
                        )}
                        {it.hargaTerakhir ? (
                          <span>
                            Terakhir: {formatRupiah(it.hargaTerakhir)}
                            {it.hargaTerakhirTanggal ? ` (${it.hargaTerakhirTanggal})` : ""}
                          </span>
                        ) : (
                          <span className="text-slate-400">Belum ada harga beli</span>
                        )}
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
