"use client";

import { formatResmi } from "@/lib/format";
import { tanggalKeKata, tanggalKeTeks } from "@/lib/tanggal";
import type { BlokKategoriBA, UnitNilaiBA } from "@/lib/opname-ba";

/**
 * Lembar Berita Acara Pemeriksaan/Stok Opname Sisa Persediaan
 * mengikuti bentuk dokumen resmi mitra:
 *
 * - kop SKPD / KAB-KOTA / PROVINSI + logo
 * - judul + "Nomor. <nomor resmi>"
 * - kalimat pembuka (hari & tanggal dalam huruf, nama/pangkat/NIP pemeriksa)
 * - blok per kategori: tabel No | Unit | Jumlah Harga berisi SELURUH unit kerja
 *   (unit yang tidak diopname ditulis "-"), lalu baris "Jumlah" per kategori
 * - "Total Keseluruhan"
 * - 3 blok tanda tangan: Pengurus Barang Pengguna, Pejabat Penatausahaan
 *   pengguna barang, dan Mengetahui Kepala Dinas
 */

export interface PejabatBA {
  nama: string;
  nip: string;
  pangkat?: string;
  jabatan?: string;
}

export interface PropsBeritaAcara {
  instansi: string;
  kabKota: string;
  provinsi: string;
  logoSrc?: string;
  tahun: string;
  nomorBa: string;
  /** Tanggal pelaksanaan opname (ISO), dipakai pada kalimat "pada tgl ...". */
  tanggalOpname: string;
  keterangan?: string | null;
  pemeriksa: PejabatBA;
  penatausahaan: PejabatBA;
  kepala: PejabatBA;
  blok: BlokKategoriBA[];
  total: number;
  tempatTtd: string;
  /** Tanggal pada blok tanda tangan kanan (ISO). */
  tanggalTtd: string;
}

const garis = "border border-slate-800";
const padat = "px-1.5 py-[3px]";

export default function BeritaAcaraOpname({
  instansi,
  kabKota,
  provinsi,
  logoSrc,
  tahun,
  nomorBa,
  tanggalOpname,
  keterangan,
  pemeriksa,
  penatausahaan,
  kepala,
  blok,
  total,
  tempatTtd,
  tanggalTtd,
}: PropsBeritaAcara) {
  return (
    <div className="lembar-cetak text-[11px] leading-snug text-black bg-white">
      {/* Kop */}
      <table className={`w-full border-collapse ${garis}`}>
        <tbody>
          <tr>
            <td className={`${garis} ${padat} w-20 text-center align-middle`} rowSpan={3}>
              {logoSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoSrc} alt="Logo" className="w-16 h-16 object-contain mx-auto" />
              ) : (
                <div className="w-16 h-16 mx-auto border border-dashed border-slate-400" />
              )}
            </td>
            <td className={`${garis} ${padat} w-24`}>SKPD</td>
            <td className={`${garis} ${padat}`}>: {instansi}</td>
          </tr>
          <tr>
            <td className={`${garis} ${padat}`}>KAB/KOTA</td>
            <td className={`${garis} ${padat}`}>: {kabKota}</td>
          </tr>
          <tr>
            <td className={`${garis} ${padat}`}>PROVINSI</td>
            <td className={`${garis} ${padat}`}>: {provinsi}</td>
          </tr>
        </tbody>
      </table>

      {/* Judul */}
      <div className="text-center font-bold uppercase mt-2">
        <div className="text-[12px]">Berita Acara Pemeriksaan/Stok Opname Sisa Persediaan</div>
        <div className="text-[12px]">Tahun {tahun}</div>
        <div className="font-normal normal-case mt-0.5">Nomor. {nomorBa || "................................"}</div>
      </div>

      {/* Pembuka */}
      <p className="mt-2 text-justify">
        Pada hari ini, <span className="font-semibold">{tanggalKeKata(tanggalTtd || tanggalOpname)}</span>, yang
        bertanda tangan di bawah ini, menyatakan bahwa dalam stok opname sisa persediaan tahunan {tahun}, Nama :{" "}
        <span className="font-semibold">{pemeriksa.nama || "................................"}</span>
        {pemeriksa.pangkat ? ` Pangkat/Gol : ${pemeriksa.pangkat}` : ""}, NIP{" "}
        {pemeriksa.nip || "................................"} setelah melaksanakan pemeriksaan / Stok Opname pada tgl{" "}
        {tanggalKeTeks(tanggalOpname)} dalam daftar sbb{keterangan ? ` (${keterangan})` : ""}:
      </p>

      {/* Blok per kategori */}
      {blok.length === 0 ? (
        <p className="mt-3 italic">Belum ada data hasil opname pada dokumen ini.</p>
      ) : (
        blok.map((k, idx) => (
          <div key={k.kategori} className="mt-3">
            <div className="font-semibold">
              {idx + 1}. Belanja alat/Bahan untuk kegiatan kantor {k.kategori}
            </div>
            <table className={`w-full border-collapse mt-1 ${garis}`}>
              <thead>
                <tr className="font-semibold text-center">
                  <th className={`${garis} ${padat} w-12`}>No</th>
                  <th className={`${garis} ${padat}`}>Unit</th>
                  <th className={`${garis} ${padat} w-44`}>Jumlah Harga</th>
                </tr>
              </thead>
              <tbody>
                {k.perUnit.map((u, i) => (
                  <tr key={u.unit}>
                    <td className={`${garis} ${padat} text-center`}>{i + 1}</td>
                    <td className={`${garis} ${padat}`}>{u.unit}</td>
                    <td className={`${garis} ${padat} text-right font-mono`}>
                      {u.nilai === null ? "-" : formatResmi(u.nilai)}
                    </td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className={`${garis} ${padat} text-center`} colSpan={2}>
                    Jumlah
                  </td>
                  <td className={`${garis} ${padat} text-right font-mono`}>{formatResmi(k.jumlah)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ))
      )}

      {/* Total keseluruhan */}
      <table className={`w-full border-collapse mt-3 ${garis}`}>
        <tbody>
          <tr className="font-bold">
            <td className={`${garis} ${padat} text-center`}>Total Keseluruhan</td>
            <td className={`${garis} ${padat} text-right font-mono w-56`}>{formatResmi(total)}</td>
          </tr>
        </tbody>
      </table>

      <p className="mt-2">
        Demikian Berita Acara Pemeriksaan/Stok Opname untuk dipergunakan sebagaimana mestinya.
      </p>

      {/* Tanda tangan */}
      <div className="mt-4 flex justify-between">
        <div className="text-center w-1/3">
          <div>Pengurus Barang Pengguna</div>
          <div className="h-14"></div>
          <div className="font-semibold underline">{pemeriksa.nama || "................................"}</div>
          <div>NIP. {pemeriksa.nip || "................................"}</div>
        </div>
        <div className="text-center w-1/3">
          <div>Pejabat Penatausahaan</div>
          <div>pengguna barang</div>
          <div className="h-14"></div>
          <div className="font-semibold underline">{penatausahaan.nama || "................................"}</div>
          <div>NIP. {penatausahaan.nip || "................................"}</div>
        </div>
      </div>

      <div className="mt-4 text-center">
        <div>Mengetahui</div>
        <div>
          {tempatTtd || "Pasuruan"}, {tanggalKeTeks(tanggalTtd || tanggalOpname)}
        </div>
        <div className="font-semibold">{kepala.jabatan || "Kepala Dinas"}</div>
        <div className="h-14"></div>
        <div className="font-semibold underline">{kepala.nama || "................................"}</div>
        <div>NIP. {kepala.nip || "................................"}</div>
      </div>
    </div>
  );
}
