"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Draft isian transaksi di browser (localStorage).
 *
 * Tujuannya satu: mitra tidak kehilangan isian saat halaman tertutup,
 * browser ditutup, atau komputer mati di tengah mengetik dokumen.
 */
export interface DraftTersimpan<T> {
  data: T;
  disimpanPada: string;
}

const kunciDraft = (nama: string) => `bhp:draft:${nama}:v1`;

export function bacaDraft<T>(nama: string): DraftTersimpan<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const mentah = window.localStorage.getItem(kunciDraft(nama));
    if (!mentah) return null;
    const hasil = JSON.parse(mentah) as DraftTersimpan<T>;
    if (!hasil || typeof hasil !== "object" || !("data" in hasil)) return null;
    return hasil;
  } catch {
    return null;
  }
}

export function hapusDraft(nama: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(kunciDraft(nama));
  } catch {
    // localStorage penuh / diblokir: draft diabaikan saja
  }
}

function jamLokal(iso: string): string {
  const tanggal = new Date(iso);
  if (Number.isNaN(tanggal.getTime())) return iso;
  return tanggal.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Menyimpan draft secara otomatis (ditunda sebentar supaya tidak menulis
 * setiap ketukan). `aktif` diisi false saat mengedit dokumen yang sudah
 * tersimpan atau saat draft sudah dibuang.
 */
export function useDraftOtomatis<T>(
  nama: string,
  aktif: boolean,
  data: T
): { tersimpan: string | null } {
  const [tersimpan, setTersimpan] = useState<string | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;
  const tanda = JSON.stringify(data);

  useEffect(() => {
    if (!aktif) return;
    const timer = setTimeout(() => {
      if (typeof window === "undefined") return;
      try {
        const draft: DraftTersimpan<T> = {
          data: dataRef.current,
          disimpanPada: new Date().toISOString(),
        };
        window.localStorage.setItem(kunciDraft(nama), JSON.stringify(draft));
        setTersimpan(jamLokal(draft.disimpanPada));
      } catch {
        // diblokir / penuh: lewati
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [nama, aktif, tanda]);

  useEffect(() => {
    if (!aktif) setTersimpan(null);
  }, [aktif]);

  return { tersimpan };
}

export { jamLokal };
