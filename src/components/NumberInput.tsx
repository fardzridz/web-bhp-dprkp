"use client";

import { useEffect, useRef, useState } from "react";
import { angkaKeTeks, parseAngkaID, rapikanTeksAngka } from "@/lib/format";

/**
 * Kolom isian angka gaya Indonesia.
 *
 * - Ribuan otomatis dipisah titik ("27.750"), desimal pakai koma ("27,5").
 * - Boleh dikosongkan; nilai kosong dikirim sebagai null (bukan 0), jadi
 *   angka 0 tidak "nyangkut" dan tidak pernah muncul "010000".
 * - Fokus = seluruh isi tersorot, jadi menimpa nilai lama cukup langsung ketik.
 */
export default function NumberInput({
  value,
  onChange,
  mode = "rupiah",
  disabled = false,
  required = false,
  placeholder,
  className,
  title,
}: {
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  /** "rupiah" = harga/nilai (2 angka desimal), "qty" = jumlah barang (3 desimal). */
  mode?: "rupiah" | "qty";
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  className?: string;
  title?: string;
}) {
  const maxDesimal = mode === "qty" ? 3 : 2;
  const inputRef = useRef<HTMLInputElement>(null);
  const caretRef = useRef<number | null>(null);
  const [teks, setTeks] = useState(() => angkaKeTeks(value, maxDesimal));

  // Nilai dari luar berubah (mis. memuat dokumen untuk diedit) -> samakan isian.
  useEffect(() => {
    const sekarang = parseAngkaID(teks);
    const sama =
      (sekarang === null && (value === null || value === undefined)) ||
      (sekarang !== null &&
        value !== null &&
        value !== undefined &&
        Math.abs(sekarang - value) < 1e-9);
    if (!sama) setTeks(angkaKeTeks(value, maxDesimal));
    // sengaja hanya mengikuti perubahan nilai dari luar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Kembalikan posisi kursor setelah teks dirapikan.
  useEffect(() => {
    if (caretRef.current === null) return;
    const input = inputRef.current;
    if (input) {
      const posisi = Math.min(caretRef.current, input.value.length);
      input.setSelectionRange(posisi, posisi);
    }
    caretRef.current = null;
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const mentah = e.target.value;
    const posisi = e.target.selectionStart ?? mentah.length;
    const pentingSebelumKursor = mentah.slice(0, posisi).replace(/[^0-9,]/g, "").length;

    const rapi = rapikanTeksAngka(mentah, maxDesimal);

    // Letakkan kursor setelah jumlah karakter penting yang sama.
    let sisa = pentingSebelumKursor;
    let posisiBaru = rapi.length;
    for (let i = 0; i < rapi.length; i += 1) {
      if (sisa === 0) {
        posisiBaru = i;
        break;
      }
      if (/[0-9,]/.test(rapi[i])) sisa -= 1;
    }
    caretRef.current = posisiBaru;

    setTeks(rapi);
    onChange(parseAngkaID(rapi));
  };

  const handleBlur = () => {
    if (teks === "") {
      setTeks("");
      onChange(null);
    } else {
      const nilai = parseAngkaID(teks);
      setTeks(angkaKeTeks(nilai, maxDesimal));
      onChange(nilai);
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      disabled={disabled}
      required={required}
      placeholder={placeholder}
      title={title}
      value={teks}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={(e) => e.target.select()}
      className={className}
    />
  );
}
