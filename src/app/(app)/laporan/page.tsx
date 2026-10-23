"use client";

import { useState, useEffect, useMemo, Fragment } from "react";
import { formatResmi } from "@/lib/format";
import { gabungBarisLintasUnit, kelompokkanMutasi } from "@/lib/mutasi";
import { tanggalKeTeks } from "@/lib/tanggal";
import { daftarUnitKerja } from "@/lib/unit";
import { susunBlokBA, type BlokKategoriBA } from "@/lib/opname-ba";
import BeritaAcaraOpname from "@/components/BeritaAcaraOpname";
import {
  FileText,
  Printer,
  Calendar,
  Building2,
  FileSpreadsheet,
  Boxes,
  ArrowDownLeft,
  ArrowUpRight,
  Globe,
  Layers,
  Filter,
  AlertTriangle,
} from "lucide-react";

type ReportType = "MUTASI" | "PENERIMAAN" | "PENGELUARAN" | "KARTU_BARANG";

/** Urutan lembar pada paket cetak: tiga buku resmi untuk periode yang sama. */
const TIPE_PAKET: ReportType[] = ["MUTASI", "PENERIMAAN", "PENGELUARAN"];

interface RekamanOpnamePaket {
  id: string;
  tanggal: string;
  nomorBa: string | null;
  tanggalBa: string | null;
  keterangan: string | null;
  items: Array<{ kategori: string; nilaiFisik: number }>;
}

/** Berita Acara terakhir dalam periode, disiapkan untuk ikut dicetak di paket. */
interface BeritaAcaraPaket {
  agency: Record<string, string>;
  nomorBa: string | null;
  tanggalBa: string | null;
  tanggal: string;
  keterangan: string | null;
  blok: BlokKategoriBA[];
  total: number;
}

interface MutasiRow {
  id: string;
  kode: string;
  nama: string;
  satuan: string;
  /** Nama kategori barang — dipakai untuk baris "Jumlah <Kategori>". */
  kategori?: string;
  bidangId?: string;
  bidangNama?: string;
  bidangKode?: string;
  openingQty: number;
  openingValue: number;
  incomingQty: number;
  incomingValue: number;
  outgoingQty: number;
  outgoingValue: number;
  closingQty: number;
  closingValue: number;
  /** true bila saldo akhir negatif — tanda data stok tidak konsisten. */
  negative?: boolean;
  /** Hasil stock opname terakhir yang berlaku sampai akhir periode. */
  opnameQty?: number | null;
  opnameValue?: number | null;
  opnameKondisi?: string | null;
  opnameTanggal?: string | null;
  selisihQty?: number | null;
  selisihValue?: number | null;
  /** true bila baris ini gabungan beberapa unit kerja (lingkup Semua Bidang). */
  gabungan?: boolean;
  /** Banyaknya unit kerja yang digabung pada baris ini. */
  jumlahUnit?: number;
}

interface PenerimaanRow {
  tanggal: string;
  bidangId?: string;
  bidangNama?: string;
  bidangKode?: string;
  vendor: string;
  noFaktur: string;
  tglFaktur: string;
  noBa: string;
  tglBa: string;
  namaBarang: string;
  jumlah: number;
  satuan: string;
  hargaSatuan: number;
  jumlahHarga: number;
  keterangan?: string;
}

interface PengeluaranRow {
  tanggal: string;
  bidangId?: string;
  bidangNama?: string;
  bidangKode?: string;
  nomorDokumen: string;
  penerima: string;
  keperluan: string;
  tglPenyerahan: string;
  namaBarang: string;
  jumlah: number;
  satuan: string;
  hargaSatuan: number;
  jumlahHarga: number;
  keterangan?: string;
}

interface KartuRow {
  tanggal: string;
  nomorDokumen: string;
  keterangan: string;
  inQty: number;
  hargaSatuan: number;
  inNilai: number;
  outQty: number;
  outNilai: number;
  saldoQty: number;
  saldoNilai: number;
}

interface ItemOption {
  id: string;
  kode: string;
  nama: string;
  satuan: string;
  bidangId?: string;
  bidangNama?: string;
  bidangKode?: string;
}

interface BidangTab {
  id: string;
  nama: string;
  kode: string;
}

interface ReportTotals {
  openingQty?: number;
  openingValue?: number;
  incomingQty?: number;
  incomingValue?: number;
  outgoingQty?: number;
  outgoingValue?: number;
  closingQty?: number;
  closingValue?: number;
  jumlah?: number;
  jumlahHarga?: number;
  /** Banyaknya barang dengan saldo akhir negatif (indikasi data bermasalah). */
  negativeItems?: number;
  opnameItems?: number;
  opnameQty?: number;
  opnameValue?: number;
  selisihQty?: number;
  selisihValue?: number;
}

interface ReportResponse {
  type: ReportType;
  isAllBidang?: boolean;
  startDate?: string;
  endDate?: string;
  agency?: Record<string, string>;
  bidang?: {
    id?: string;
    nama?: string;
    kode?: string;
    namaAtasan?: string;
    nipAtasan?: string;
    jabatanAtasan?: string;
    pangkatAtasan?: string;
    namaPengurus?: string;
    nipPengurus?: string;
    jabatanPengurus?: string;
    pangkatPengurus?: string;
  };
  item?: {
    id: string;
    kode: string;
    nama: string;
    satuanNama: string;
    kategoriNama: string;
    bidangNama?: string;
    bidangKode?: string;
  } | null;
  itemsList?: ItemOption[];
  currentStock?: number;
  currentValue?: number;
  totals?: ReportTotals;
  rows: unknown[];
}

export default function LaporanPage() {
  const [reportType, setReportType] = useState<ReportType>("MUTASI");
  const [bidangTabs, setBidangTabs] = useState<BidangTab[]>([]);
  const [activeBidangId, setActiveBidangId] = useState<string>("");
  const [userRole, setUserRole] = useState<string>("");
  const [userBidangInfo, setUserBidangInfo] = useState<{ nama?: string; kode?: string }>({});
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [kartuBidangFilter, setKartuBidangFilter] = useState<string>("ALL");

  const [year] = useState("2026");
  const [startDate, setStartDate] = useState("2026-01-01");
  const [endDate, setEndDate] = useState("2026-06-30");
  const [activePreset, setActivePreset] = useState("SEMESTER_1");

  const [reportData, setReportData] = useState<ReportResponse | null>(null);

  const [loading, setLoading] = useState(false);
  // Laporan Mutasi bisa dicetak per kategori, seperti satu lembar resmi per kategori.
  const [kategoriFilter, setKategoriFilter] = useState("SEMUA");

  // Paket cetak: semua lembar resmi periode ini dicetak berurutan sekali klik.
  const [paket, setPaket] = useState(false);
  const [siapCetak, setSiapCetak] = useState(false);
  const [mencetakPaket, setMencetakPaket] = useState(false);
  const [pesanPaket, setPesanPaket] = useState<string | null>(null);
  const [paketData, setPaketData] = useState<Partial<Record<ReportType, ReportResponse>>>({});
  const [paketBeritaAcara, setPaketBeritaAcara] = useState<BeritaAcaraPaket | null>(null);

  const isSuperAdmin = userRole === "SUPERADMIN";

  const fetchInitialData = async () => {
    try {
      const [bRes, meRes] = await Promise.all([
        fetch("/api/bidang"),
        fetch("/api/auth/me"),
      ]);
      const bJson = await bRes.json();
      const meJson = await meRes.json();

      if (bJson.data) setBidangTabs(bJson.data);

      if (meJson.user) {
        setUserRole(meJson.user.role);
        if (meJson.user.role === "SUPERADMIN") {
          // Superadmin defaults to "ALL" (Semua Bidang) or specific active bidang
          setActiveBidangId("ALL");
        } else {
          // Operator/Kepala Bidang locked to their assigned bidang
          const myBidangId = meJson.user.bidangId || meJson.activeBidang?.id;
          setActiveBidangId(myBidangId);
          setUserBidangInfo({
            nama: meJson.activeBidang?.nama,
            kode: meJson.activeBidang?.kode,
          });
        }
      }
    } catch {
      // silent
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const applyPreset = (preset: string, y = year) => {
    setActivePreset(preset);
    if (preset === "TRIWULAN_1") {
      setStartDate(`${y}-01-01`);
      setEndDate(`${y}-03-31`);
    } else if (preset === "TRIWULAN_2") {
      setStartDate(`${y}-04-01`);
      setEndDate(`${y}-06-30`);
    } else if (preset === "TRIWULAN_3") {
      setStartDate(`${y}-07-01`);
      setEndDate(`${y}-09-30`);
    } else if (preset === "TRIWULAN_4") {
      setStartDate(`${y}-10-01`);
      setEndDate(`${y}-12-31`);
    } else if (preset === "SEMESTER_1") {
      setStartDate(`${y}-01-01`);
      setEndDate(`${y}-06-30`);
    } else if (preset === "SEMESTER_2") {
      setStartDate(`${y}-07-01`);
      setEndDate(`${y}-12-31`);
    } else if (preset === "TAHUNAN") {
      setStartDate(`${y}-01-01`);
      setEndDate(`${y}-12-31`);
    }
  };

  const ambilLaporan = async (tipe: ReportType) => {
    const params = new URLSearchParams({
      type: tipe,
      bidangId: activeBidangId,
      startDate,
      endDate,
    });
    if (tipe === "KARTU_BARANG" && selectedItemId) {
      params.set("itemId", selectedItemId);
    }

    const res = await fetch(`/api/reports?${params.toString()}`);
    const json = await res.json();
    if (!res.ok) {
      throw new Error((json as { error?: string })?.error || "Gagal memuat laporan");
    }
    return json as ReportResponse;
  };

  const fetchReport = async () => {
    if (!activeBidangId) return;
    setLoading(true);
    try {
      const json = await ambilLaporan(reportType);
      setReportData(json);
      if (json.itemsList && json.itemsList.length > 0 && !selectedItemId) {
        setSelectedItemId(json.itemsList[0].id);
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Paket cetak: tiga buku resmi periode ini + Berita Acara Stok Opname terakhir
   * dalam periode itu (bila ada), lalu dialog cetak dibuka otomatis.
   */
  const cetakPaket = async () => {
    if (!activeBidangId) return;
    setMencetakPaket(true);
    setPesanPaket(null);
    setLoading(true);
    try {
      const hasil: Partial<Record<ReportType, ReportResponse>> = {};
      for (const tipe of TIPE_PAKET) {
        hasil[tipe] = await ambilLaporan(tipe);
      }
      setPaketData(hasil);

      const agency = (hasil.MUTASI?.agency || {}) as Record<string, string>;
      let beritaAcara: BeritaAcaraPaket | null = null;
      const resOpname = await fetch(`/api/opname?bidangId=${encodeURIComponent(activeBidangId)}`);
      if (resOpname.ok) {
        const jsonOpname = (await resOpname.json()) as { data?: RekamanOpnamePaket[] };
        const rekaman = (jsonOpname.data || []).find((r) => r.tanggal >= startDate && r.tanggal <= endDate);
        if (rekaman) {
          const namaBidang = hasil.MUTASI?.bidang?.nama || bidangTabs.find((b) => b.id === activeBidangId)?.nama || "";
          const blok = susunBlokBA(rekaman.items, daftarUnitKerja(agency.UNIT_KERJA), namaBidang);
          beritaAcara = {
            agency,
            nomorBa: rekaman.nomorBa,
            tanggalBa: rekaman.tanggalBa,
            tanggal: rekaman.tanggal,
            keterangan: rekaman.keterangan,
            blok,
            total: blok.reduce((s, b) => s + b.jumlah, 0),
          };
        }
      }
      setPaketBeritaAcara(beritaAcara);
      setPaket(true);
      setSiapCetak(true);
    } catch (err: unknown) {
      setPesanPaket(err instanceof Error ? err.message : "Gagal menyiapkan paket laporan");
    } finally {
      setMencetakPaket(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!siapCetak) return;
    setSiapCetak(false);
    const timer = setTimeout(() => window.print(), 400);
    return () => clearTimeout(timer);
  }, [siapCetak]);


  useEffect(() => {
    fetchReport();
  }, [reportType, activeBidangId, startDate, endDate, selectedItemId]);

  useEffect(() => {
    // Mengganti jenis laporan, unit kerja, atau periode keluar dari mode paket cetak.
    setPaket(false);
  }, [reportType, activeBidangId, startDate, endDate]);

  const filteredCardItems = useMemo(() => {
    if (!reportData?.itemsList) return [];
    if (kartuBidangFilter === "ALL") return reportData.itemsList;
    return reportData.itemsList.filter((it) => it.bidangId === kartuBidangFilter);
  }, [reportData?.itemsList, kartuBidangFilter]);

  /** Daftar kategori untuk pilihan cetak per kategori (laporan Mutasi). */
  const daftarKategoriMutasi = useMemo(() => {
    if (reportData?.type !== "MUTASI") return [];
    const nama = new Set(((reportData.rows as MutasiRow[] | undefined) || []).map((r) => r.kategori || "Tanpa Kategori"));
    return [...nama].sort((a, b) => a.localeCompare(b));
  }, [reportData]);

  /** Baris kedua judul lembar Mutasi: kategori yang sedang dicetak. */
  const judulKategoriMutasi = kategoriFilter === "SEMUA" ? "SEMUA KATEGORI" : kategoriFilter.toUpperCase();


  const formatDateIndo = (dStr: string) => {
    if (!dStr) return "-";
    const d = new Date(dStr);
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(d);
  };

  /**
   * Kepala lembar cetak.
   * Laporan Mutasi memakai bentuk dokumen mitra: tiga baris judul (jenis laporan,
   * kategori, nama dinas). Lembar lain memakai kop surat + logo.
   */
  const renderKop = (reportData: ReportResponse, reportType: ReportType) =>
    reportType === "MUTASI" ? (
      <div className="text-center pb-3 mb-3">
        <h1 className="text-base font-extrabold uppercase tracking-wide">LAPORAN MUTASI BARANG PERSEDIAAN</h1>
        <h2 className="text-sm font-bold uppercase mt-0.5">{judulKategoriMutasi}</h2>
        <h3 className="text-sm font-bold uppercase mt-0.5">
          {reportData.agency?.NAMA_INSTANSI || "DINAS PERUMAHAN RAKYAT DAN KAWASAN PERMUKIMAN"}
        </h3>
        <p className="text-xs text-slate-600 mt-0.5">
          Unit Kerja:{" "}
          {reportData.isAllBidang
            ? "Seluruh Unit Kerja (Gabungan SKPD)"
            : `${reportData.bidang?.nama || "Dinas"} (${reportData.bidang?.kode || "-"})`}
        </p>
      </div>
    ) : (
      <div className="pb-4 mb-4 border-b-2 border-slate-900">
        <div className="flex items-center justify-center space-x-4">
          <img
            src="/logo-pasuruan.png"
            alt="Logo Kota Pasuruan"
            className="w-16 h-16 object-contain flex-shrink-0"
          />
          <div className="text-center">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-600">
              PEMERINTAH {reportData.agency?.KAB_KOTA || "KOTA PASURUAN"}
            </div>
            <h2 className="text-sm font-extrabold uppercase mt-0.5 text-slate-900 tracking-wide">
              {reportData.agency?.NAMA_INSTANSI || "DINAS PERUMAHAN RAKYAT DAN KAWASAN PERMUKIMAN"}
            </h2>
            <h3 className="text-xs uppercase font-semibold text-emerald-800 mt-0.5">
              UNIT KERJA:{" "}
              {reportData.isAllBidang
                ? "SELURUH UNIT KERJA / GABUNGAN SKPD (DPRKP)"
                : `${reportData.bidang?.nama || "DINAS"} (${reportData.bidang?.kode || "-"})`}
            </h3>
          </div>
        </div>
        <div className="text-center mt-3 pt-2 border-t border-slate-300">
          <h1 className="text-base font-extrabold uppercase underline tracking-wide">
            {reportType === "PENERIMAAN" && "BUKU PENERIMAAN BARANG PERSEDIAAN (LAMPIRAN 8)"}
            {reportType === "PENGELUARAN" && "BUKU PENGELUARAN BARANG PERSEDIAAN (LAMPIRAN 9)"}
            {reportType === "KARTU_BARANG" && "KARTU BARANG PERSEDIAAN"}
          </h1>
          {reportType !== "KARTU_BARANG" ? (
            <p className="text-xs text-slate-600 mt-1">
              Periode: <strong>{formatDateIndo(startDate)}</strong> s.d. <strong>{formatDateIndo(endDate)}</strong>
            </p>
          ) : (
            reportData.item && (
              <p className="text-xs text-slate-700 mt-1 font-medium">
                Nama Barang: <strong>{reportData.item.nama}</strong> ({reportData.item.kode}) • Satuan:{" "}
                <strong>{reportData.item.satuanNama}</strong>
                {reportData.isAllBidang && reportData.item.bidangNama && (
                  <span>
                    {" "}
                    • Unit Kerja: <strong>{reportData.item.bidangNama}</strong> ({reportData.item.bidangKode})
                  </span>
                )}
              </p>
            )
          )}
        </div>
      </div>
    );

  /** Tabel Laporan Mutasi per kategori + baris "Jumlah <Kategori>". */
  /**
   * Tabel Laporan Mutasi Barang Persediaan — bentuk resmi mitra (16 kolom):
   * No | Rincian Nama Persediaan | Saldo Per <tanggal> (Jumlah, Nilai) |
   * Penambahan | Pengurangan | Saldo Per <tanggal> | Hasil Stock Opname
   * (Jumlah, Nilai, *Kondisi) | Selisih | Keterangan, ditutup baris
   * "Jumlah <Kategori>".
   */
  const renderTabelMutasi = (reportData: ReportResponse) => {
    const barisMentah = ((reportData.rows as MutasiRow[] | undefined) || []) as MutasiRow[];
    // Lingkup "Semua Bidang": lembar resmi SKPD hanya memuat satu baris per barang,
    // jadi barang bernama & bersatuan sama dari unit berbeda digabung.
    const semuaBaris = reportData.isAllBidang ? gabungBarisLintasUnit(barisMentah) : barisMentah;
    const barisTampil =
      kategoriFilter === "SEMUA"
        ? semuaBaris
        : semuaBaris.filter((r) => (r.kategori || "Tanpa Kategori") === kategoriFilter);
    const mutasiKelompok = kelompokkanMutasi(barisTampil);

    return (
      <div className="overflow-x-auto">
        {(reportData.totals?.negativeItems ?? 0) > 0 && (
          <div className="no-print mb-3 p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs flex items-start space-x-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-600" />
            <span>
              <strong>{reportData.totals?.negativeItems} barang memiliki saldo akhir negatif.</strong>{" "}
              Angka negatif berarti ada pengeluaran yang melebihi penerimaan pada periode ini — periksa
              transaksi barang masuk/keluar barang tersebut sebelum laporan dipakai.
            </span>
          </div>
        )}
        <table className="w-full text-left text-xs border border-slate-800 border-collapse">
          <thead className="bg-slate-100 text-slate-900 text-[11px] font-bold uppercase text-center border-b border-slate-800">
            <tr>
              <th rowSpan={3} className="border border-slate-800 p-2 w-10">
                No
              </th>
              <th rowSpan={3} className="border border-slate-800 p-2">
                Rincian Nama Persediaan
              </th>
              <th colSpan={2} className="border border-slate-800 p-2">
                Saldo Per {tanggalKeTeks(reportData.startDate || "")}
              </th>
              <th colSpan={2} className="border border-slate-800 p-2">
                Penambahan
              </th>
              <th colSpan={2} className="border border-slate-800 p-2">
                Pengurangan
              </th>
              <th colSpan={2} className="border border-slate-800 p-2">
                Saldo Per {tanggalKeTeks(reportData.endDate || "")}
              </th>
              <th colSpan={3} className="border border-slate-800 p-2 bg-amber-50">
                Hasil Stock Opname
              </th>
              <th colSpan={2} className="border border-slate-800 p-2 bg-amber-50">
                Selisih
              </th>
              <th rowSpan={3} className="border border-slate-800 p-2 w-28">
                Keterangan
              </th>
            </tr>
            <tr className="border-b border-slate-800 text-[10px]">
              <th className="border border-slate-800 p-1.5 w-16">Jumlah</th>
              <th className="border border-slate-800 p-1.5 w-24">Nilai Persediaan (Rp)</th>
              <th className="border border-slate-800 p-1.5 w-16">Jumlah</th>
              <th className="border border-slate-800 p-1.5 w-24">Nilai Persediaan (Rp)</th>
              <th className="border border-slate-800 p-1.5 w-16">Jumlah</th>
              <th className="border border-slate-800 p-1.5 w-24">Nilai Persediaan (Rp)</th>
              <th className="border border-slate-800 p-1.5 w-16">Jumlah</th>
              <th className="border border-slate-800 p-1.5 w-24">Nilai Persediaan (Rp)</th>
              <th className="border border-slate-800 p-1.5 w-16 bg-amber-50">Jumlah</th>
              <th className="border border-slate-800 p-1.5 w-24 bg-amber-50">Nilai Persediaan (Rp)</th>
              <th className="border border-slate-800 p-1.5 w-20 bg-amber-50">*Kondisi</th>
              <th className="border border-slate-800 p-1.5 w-16 bg-amber-50">Jumlah</th>
              <th className="border border-slate-800 p-1.5 w-24 bg-amber-50">Nilai Persediaan (Rp)</th>
            </tr>
            <tr className="text-[10px] font-normal text-slate-600">
              <th className="border border-slate-800 p-1">3</th>
              <th className="border border-slate-800 p-1">4</th>
              <th className="border border-slate-800 p-1">5</th>
              <th className="border border-slate-800 p-1">6</th>
              <th className="border border-slate-800 p-1">7</th>
              <th className="border border-slate-800 p-1">8</th>
              <th className="border border-slate-800 p-1">9 (3+5-7)</th>
              <th className="border border-slate-800 p-1">10 (4+6-8)</th>
              <th className="border border-slate-800 p-1 bg-amber-50">11</th>
              <th className="border border-slate-800 p-1 bg-amber-50">12</th>
              <th className="border border-slate-800 p-1 bg-amber-50">13</th>
              <th className="border border-slate-800 p-1 bg-amber-50">14 (9-11)</th>
              <th className="border border-slate-800 p-1 bg-amber-50">15 (10-12)</th>
            </tr>
          </thead>
          <tbody>
            {barisTampil.length === 0 ? (
              <tr>
                <td colSpan={16} className="p-6 text-center text-slate-400">
                  Tidak ada data mutasi persediaan pada lingkup laporan ini.
                </td>
              </tr>
            ) : (
              mutasiKelompok.map((kelompok) => (
                <Fragment key={kelompok.kategori}>
                  {kelompok.baris.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className="border border-slate-800 p-2 text-center">{row.nomor}</td>
                      <td className="border border-slate-800 p-2">
                        <div className="font-medium">{row.nama}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {row.gabungan
                            ? `${row.satuan}${row.jumlahUnit && row.jumlahUnit > 1 ? ` • gabungan ${row.jumlahUnit} unit kerja` : ""}`
                            : `${row.kode} • ${row.satuan}`}
                        </div>
                      </td>
                      <td className="border border-slate-800 p-2 text-right font-mono">{formatResmi(row.openingQty)}</td>
                      <td className="border border-slate-800 p-2 text-right font-mono">{formatResmi(row.openingValue)}</td>
                      <td className="border border-slate-800 p-2 text-right font-mono font-semibold text-emerald-800">{formatResmi(row.incomingQty)}</td>
                      <td className="border border-slate-800 p-2 text-right font-mono text-emerald-800">{formatResmi(row.incomingValue)}</td>
                      <td className="border border-slate-800 p-2 text-right font-mono font-semibold text-blue-800">{formatResmi(row.outgoingQty)}</td>
                      <td className="border border-slate-800 p-2 text-right font-mono text-blue-800">{formatResmi(row.outgoingValue)}</td>
                      <td
                        className={`border border-slate-800 p-2 text-right font-mono font-bold ${
                          row.negative ? "text-rose-700 bg-rose-50" : ""
                        }`}
                        title={row.negative ? "Saldo negatif: pengeluaran melebihi penerimaan" : undefined}
                      >
                        {formatResmi(row.closingQty)}
                        {row.negative ? " ⚠" : ""}
                      </td>
                      <td className="border border-slate-800 p-2 text-right font-mono font-bold">{formatResmi(row.closingValue)}</td>
                      <td className="border border-slate-800 p-2 text-right font-mono bg-amber-50">
                        {row.opnameQty === null || row.opnameQty === undefined ? "-" : formatResmi(row.opnameQty)}
                      </td>
                      <td className="border border-slate-800 p-2 text-right font-mono bg-amber-50">
                        {row.opnameValue === null || row.opnameValue === undefined ? "-" : formatResmi(row.opnameValue)}
                      </td>
                      <td className="border border-slate-800 p-2 text-center bg-amber-50 text-[10px]">
                        {row.opnameKondisi || "-"}
                      </td>
                      <td
                        className={`border border-slate-800 p-2 text-right font-mono bg-amber-50 font-semibold ${
                          row.selisihQty === null || row.selisihQty === undefined
                            ? "text-slate-400"
                            : Math.abs(row.selisihQty) < 1e-9
                              ? "text-emerald-700"
                              : row.selisihQty < 0
                                ? "text-rose-700"
                                : "text-blue-700"
                        }`}
                      >
                        {row.selisihQty === null || row.selisihQty === undefined
                          ? "-"
                          : `${row.selisihQty > 0 ? "+" : ""}${formatResmi(row.selisihQty)}`}
                      </td>
                      <td className="border border-slate-800 p-2 text-right font-mono bg-amber-50">
                        {row.selisihValue === null || row.selisihValue === undefined
                          ? "-"
                          : formatResmi(row.selisihValue)}
                      </td>
                      <td className="border border-slate-800 p-2 text-left text-[10px] text-slate-600">
                        {row.opnameTanggal ? `Opname ${tanggalKeTeks(row.opnameTanggal)}` : "-"}
                      </td>
                    </tr>
                  ))}

                  {/* Baris "Jumlah <Kategori>", seperti lembar resmi mitra */}
                  <tr className="bg-slate-50 font-bold">
                    <td colSpan={2} className="border border-slate-800 p-2 pl-3 italic">
                      Jumlah {kelompok.kategori}
                    </td>
                    <td className="border border-slate-800 p-2 text-right font-mono">{formatResmi(kelompok.subtotal.openingQty)}</td>
                    <td className="border border-slate-800 p-2 text-right font-mono">{formatResmi(kelompok.subtotal.openingValue)}</td>
                    <td className="border border-slate-800 p-2 text-right font-mono text-emerald-800">{formatResmi(kelompok.subtotal.incomingQty)}</td>
                    <td className="border border-slate-800 p-2 text-right font-mono text-emerald-800">{formatResmi(kelompok.subtotal.incomingValue)}</td>
                    <td className="border border-slate-800 p-2 text-right font-mono text-blue-800">{formatResmi(kelompok.subtotal.outgoingQty)}</td>
                    <td className="border border-slate-800 p-2 text-right font-mono text-blue-800">{formatResmi(kelompok.subtotal.outgoingValue)}</td>
                    <td className="border border-slate-800 p-2 text-right font-mono">{formatResmi(kelompok.subtotal.closingQty)}</td>
                    <td className="border border-slate-800 p-2 text-right font-mono">{formatResmi(kelompok.subtotal.closingValue)}</td>
                    <td className="border border-slate-800 p-2 text-right font-mono bg-amber-50">
                      {kelompok.jumlahOpname > 0 ? formatResmi(kelompok.subtotal.opnameQty) : "-"}
                    </td>
                    <td className="border border-slate-800 p-2 text-right font-mono bg-amber-50">
                      {kelompok.jumlahOpname > 0 ? formatResmi(kelompok.subtotal.opnameValue) : "-"}
                    </td>
                    <td className="border border-slate-800 p-2 text-center bg-amber-50 text-[10px]" />
                    <td className="border border-slate-800 p-2 text-right font-mono bg-amber-50">
                      {kelompok.jumlahOpname > 0 ? formatResmi(kelompok.subtotal.selisihQty) : "-"}
                    </td>
                    <td className="border border-slate-800 p-2 text-right font-mono bg-amber-50">
                      {kelompok.jumlahOpname > 0 ? formatResmi(kelompok.subtotal.selisihValue) : "-"}
                    </td>
                    <td className="border border-slate-800 p-2" />
                  </tr>
                </Fragment>
              ))
            )}
          </tbody>
          {barisTampil.length > 0 && reportData.totals && mutasiKelompok.length > 1 && (
            <tfoot>
              <tr className="bg-slate-100 font-bold border-t-2 border-slate-800 text-[11px]">
                <td colSpan={2} className="border border-slate-800 p-2 text-center uppercase tracking-wider">
                  Total Keseluruhan
                </td>
                <td className="border border-slate-800 p-2 text-right font-mono">{formatResmi(reportData.totals.openingQty ?? 0)}</td>
                <td className="border border-slate-800 p-2 text-right font-mono">{formatResmi(reportData.totals.openingValue ?? 0)}</td>
                <td className="border border-slate-800 p-2 text-right font-mono text-emerald-800">{formatResmi(reportData.totals.incomingQty ?? 0)}</td>
                <td className="border border-slate-800 p-2 text-right font-mono text-emerald-800">{formatResmi(reportData.totals.incomingValue ?? 0)}</td>
                <td className="border border-slate-800 p-2 text-right font-mono text-blue-800">{formatResmi(reportData.totals.outgoingQty ?? 0)}</td>
                <td className="border border-slate-800 p-2 text-right font-mono text-blue-800">{formatResmi(reportData.totals.outgoingValue ?? 0)}</td>
                <td className="border border-slate-800 p-2 text-right font-mono">{formatResmi(reportData.totals.closingQty ?? 0)}</td>
                <td className="border border-slate-800 p-2 text-right font-mono">{formatResmi(reportData.totals.closingValue ?? 0)}</td>
                <td className="border border-slate-800 p-2 text-right font-mono bg-amber-50">{formatResmi(reportData.totals.opnameQty ?? 0)}</td>
                <td className="border border-slate-800 p-2 text-right font-mono bg-amber-50">{formatResmi(reportData.totals.opnameValue ?? 0)}</td>
                <td className="border border-slate-800 p-2 text-center bg-amber-50" />
                <td className="border border-slate-800 p-2 text-right font-mono bg-amber-50">{formatResmi(reportData.totals.selisihQty ?? 0)}</td>
                <td className="border border-slate-800 p-2 text-right font-mono bg-amber-50">{formatResmi(reportData.totals.selisihValue ?? 0)}</td>
                <td className="border border-slate-800 p-2" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    );
  };


  /** Tabel Buku Penerimaan Barang (Lampiran 8). */
  const renderTabelPenerimaan = (reportData: ReportResponse) => (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border border-slate-800 border-collapse">
          <thead className="bg-slate-100 text-slate-900 text-[11px] font-bold uppercase text-center border-b border-slate-800">
            <tr>
              <th rowSpan={2} className="border border-slate-800 p-2 w-10">
                No
              </th>
              {reportData.isAllBidang && (
                <th rowSpan={2} className="border border-slate-800 p-2 w-28">
                  Unit Kerja
                </th>
              )}
              <th rowSpan={2} className="border border-slate-800 p-2 w-20">
                Tanggal
              </th>
              <th rowSpan={2} className="border border-slate-800 p-2">
                Dari (Penyedia)
              </th>
              <th colSpan={2} className="border border-slate-800 p-2">
                Faktur
              </th>
              <th colSpan={2} className="border border-slate-800 p-2">
                BA Penerimaan
              </th>
              <th rowSpan={2} className="border border-slate-800 p-2">
                Nama Barang
              </th>
              <th rowSpan={2} className="border border-slate-800 p-2 w-16">
                Banyak
              </th>
              <th rowSpan={2} className="border border-slate-800 p-2 w-16">
                Satuan
              </th>
              <th rowSpan={2} className="border border-slate-800 p-2 w-24">
                Harga Satuan
              </th>
              <th rowSpan={2} className="border border-slate-800 p-2 w-28">
                Jumlah Harga
              </th>
            </tr>
            <tr className="border-b border-slate-800 text-[10px]">
              <th className="border border-slate-800 p-1.5 w-24">Nomor</th>
              <th className="border border-slate-800 p-1.5 w-20">Tanggal</th>
              <th className="border border-slate-800 p-1.5 w-24">Nomor</th>
              <th className="border border-slate-800 p-1.5 w-20">Tanggal</th>
            </tr>
          </thead>
          <tbody>
            {reportData.rows.length === 0 ? (
              <tr>
                <td colSpan={reportData.isAllBidang ? 13 : 12} className="p-6 text-center text-slate-400">
                  Tidak ada transaksi penerimaan barang pada periode ini.
                </td>
              </tr>
            ) : (
              (reportData.rows as PenerimaanRow[]).map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="border border-slate-800 p-2 text-center">{idx + 1}</td>
                  {reportData.isAllBidang && (
                    <td className="border border-slate-800 p-2 text-center">
                      <span className="font-semibold text-slate-800 block text-[11px]">{row.bidangNama}</span>
                      <span className="text-[10px] text-slate-500 font-mono">({row.bidangKode})</span>
                    </td>
                  )}
                  <td className="border border-slate-800 p-2 text-center">{row.tanggal}</td>
                  <td className="border border-slate-800 p-2 font-medium">{row.vendor}</td>
                  <td className="border border-slate-800 p-2 font-mono text-[11px]">{row.noFaktur}</td>
                  <td className="border border-slate-800 p-2 text-center">{row.tglFaktur || "-"}</td>
                  <td className="border border-slate-800 p-2 font-mono text-[11px]">{row.noBa}</td>
                  <td className="border border-slate-800 p-2 text-center">{row.tglBa || "-"}</td>
                  <td className="border border-slate-800 p-2 font-medium">{row.namaBarang}</td>
                  <td className="border border-slate-800 p-2 text-right font-mono">{formatResmi(row.jumlah)}</td>
                  <td className="border border-slate-800 p-2 text-center">{row.satuan}</td>
                  <td className="border border-slate-800 p-2 text-right font-mono">{formatResmi(row.hargaSatuan)}</td>
                  <td className="border border-slate-800 p-2 text-right font-mono font-bold">{formatResmi(row.jumlahHarga)}</td>
                </tr>
              ))
            )}
          </tbody>
          {reportData.rows.length > 0 && reportData.totals && (
            <tfoot>
              <tr className="bg-slate-100 font-bold border-t-2 border-slate-800 text-[11px]">
                <td colSpan={reportData.isAllBidang ? 9 : 8} className="border border-slate-800 p-2 text-center uppercase tracking-wider">
                  Total Penerimaan
                </td>
                <td className="border border-slate-800 p-2 text-right">{reportData.totals.jumlah ?? 0}</td>
                <td className="border border-slate-800 p-2 text-center">-</td>
                <td className="border border-slate-800 p-2 text-right font-mono">-</td>
                <td className="border border-slate-800 p-2 text-right font-mono font-bold">{formatResmi(reportData.totals.jumlahHarga ?? 0)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
  );

  /** Tabel Buku Pengeluaran Barang (Lampiran 9). */
  const renderTabelPengeluaran = (reportData: ReportResponse) => (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border border-slate-800 border-collapse">
          <thead className="bg-slate-100 text-slate-900 text-[11px] font-bold uppercase text-center border-b border-slate-800">
            <tr>
              <th className="border border-slate-800 p-2 w-10">No</th>
              {reportData.isAllBidang && (
                <th className="border border-slate-800 p-2 w-28">Unit Kerja</th>
              )}
              <th className="border border-slate-800 p-2 w-20">Tanggal</th>
              <th className="border border-slate-800 p-2 w-28">No. BAST</th>
              <th className="border border-slate-800 p-2">Penerima</th>
              <th className="border border-slate-800 p-2">Keperluan</th>
              <th className="border border-slate-800 p-2">Nama Barang</th>
              <th className="border border-slate-800 p-2 w-16">Banyak</th>
              <th className="border border-slate-800 p-2 w-16">Satuan</th>
              <th className="border border-slate-800 p-2 w-24">Harga Satuan</th>
              <th className="border border-slate-800 p-2 w-28">Jumlah Nilai</th>
            </tr>
          </thead>
          <tbody>
            {reportData.rows.length === 0 ? (
              <tr>
                <td colSpan={reportData.isAllBidang ? 11 : 10} className="p-6 text-center text-slate-400">
                  Tidak ada transaksi pengeluaran barang pada periode ini.
                </td>
              </tr>
            ) : (
              (reportData.rows as PengeluaranRow[]).map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="border border-slate-800 p-2 text-center">{idx + 1}</td>
                  {reportData.isAllBidang && (
                    <td className="border border-slate-800 p-2 text-center">
                      <span className="font-semibold text-slate-800 block text-[11px]">{row.bidangNama}</span>
                      <span className="text-[10px] text-slate-500 font-mono">({row.bidangKode})</span>
                    </td>
                  )}
                  <td className="border border-slate-800 p-2 text-center">{row.tanggal}</td>
                  <td className="border border-slate-800 p-2 font-mono text-[11px] font-semibold">{row.nomorDokumen}</td>
                  <td className="border border-slate-800 p-2 font-medium">{row.penerima}</td>
                  <td className="border border-slate-800 p-2 text-slate-600">{row.keperluan || "-"}</td>
                  <td className="border border-slate-800 p-2 font-medium">{row.namaBarang}</td>
                  <td className="border border-slate-800 p-2 text-right font-mono">{formatResmi(row.jumlah)}</td>
                  <td className="border border-slate-800 p-2 text-center">{row.satuan}</td>
                  <td className="border border-slate-800 p-2 text-right font-mono">{formatResmi(row.hargaSatuan)}</td>
                  <td className="border border-slate-800 p-2 text-right font-mono font-bold text-blue-900">{formatResmi(row.jumlahHarga)}</td>
                </tr>
              ))
            )}
          </tbody>
          {reportData.rows.length > 0 && reportData.totals && (
            <tfoot>
              <tr className="bg-slate-100 font-bold border-t-2 border-slate-800 text-[11px]">
                <td colSpan={reportData.isAllBidang ? 7 : 6} className="border border-slate-800 p-2 text-center uppercase tracking-wider">
                  Total Pengeluaran
                </td>
                <td className="border border-slate-800 p-2 text-right">{reportData.totals.jumlah ?? 0}</td>
                <td className="border border-slate-800 p-2 text-center">-</td>
                <td className="border border-slate-800 p-2 text-right font-mono">-</td>
                <td className="border border-slate-800 p-2 text-right font-mono font-bold text-blue-900">{formatResmi(reportData.totals.jumlahHarga ?? 0)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
  );

  /** Tabel Kartu Barang per item. */
  const renderTabelKartu = (reportData: ReportResponse) => (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border border-slate-800 border-collapse">
          <thead className="bg-slate-100 text-slate-900 text-[11px] font-bold uppercase text-center border-b border-slate-800">
            <tr>
              <th rowSpan={2} className="border border-slate-800 p-2 w-20">
                Tanggal
              </th>
              <th rowSpan={2} className="border border-slate-800 p-2">
                No. Dokumen & Keterangan
              </th>
              <th colSpan={3} className="border border-slate-800 p-2">
                Penerimaan (Masuk)
              </th>
              <th colSpan={3} className="border border-slate-800 p-2">
                Pengeluaran (Keluar)
              </th>
              <th colSpan={2} className="border border-slate-800 p-2">
                Saldo Sisa
              </th>
            </tr>
            <tr className="border-b border-slate-800 text-[10px]">
              <th className="border border-slate-800 p-1.5 w-14">Banyak</th>
              <th className="border border-slate-800 p-1.5 w-24">Harga Satuan</th>
              <th className="border border-slate-800 p-1.5 w-24">Jumlah (Rp)</th>
              <th className="border border-slate-800 p-1.5 w-14">Banyak</th>
              <th className="border border-slate-800 p-1.5 w-24">Harga Satuan</th>
              <th className="border border-slate-800 p-1.5 w-24">Jumlah (Rp)</th>
              <th className="border border-slate-800 p-1.5 w-14">Banyak</th>
              <th className="border border-slate-800 p-1.5 w-24">Jumlah (Rp)</th>
            </tr>
          </thead>
          <tbody>
            {reportData.rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-6 text-center text-slate-400">
                  Belum ada mutasi barang untuk item ini.
                </td>
              </tr>
            ) : (
              (reportData.rows as KartuRow[]).map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="border border-slate-800 p-2 text-center">{row.tanggal}</td>
                  <td className="border border-slate-800 p-2">
                    <div className="font-semibold font-mono text-[11px]">{row.nomorDokumen}</div>
                    <div className="text-[10px] text-slate-600">{row.keterangan}</div>
                  </td>
                  <td className="border border-slate-800 p-2 text-right font-mono">{row.inQty > 0 ? formatResmi(row.inQty) : "-"}</td>
                  <td className="border border-slate-800 p-2 text-right font-mono">{row.inQty > 0 ? formatResmi(row.hargaSatuan) : "-"}</td>
                  <td className="border border-slate-800 p-2 text-right font-mono">{row.inNilai > 0 ? formatResmi(row.inNilai) : "-"}</td>
                  <td className="border border-slate-800 p-2 text-right font-mono">{row.outQty > 0 ? formatResmi(row.outQty) : "-"}</td>
                  <td className="border border-slate-800 p-2 text-right font-mono">{row.outQty > 0 ? formatResmi(row.hargaSatuan) : "-"}</td>
                  <td className="border border-slate-800 p-2 text-right font-mono">{row.outNilai > 0 ? formatResmi(row.outNilai) : "-"}</td>
                  <td className="border border-slate-800 p-2 text-right font-mono font-bold">{formatResmi(row.saldoQty)}</td>
                  <td className="border border-slate-800 p-2 text-right font-mono font-bold">{formatResmi(row.saldoNilai)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
  );

  /** Blok tanda tangan resmi (Yang Diperiksa, Mengetahui, Pemeriksa). */
  const renderTtd = (reportData: ReportResponse) => (
      <div className="mt-8 pt-4 grid grid-cols-3 gap-4 text-xs text-center text-slate-900 leading-relaxed break-inside-avoid">
        <div>
          <div className="text-slate-700">Yang Diperiksa,</div>
          <div className="font-bold uppercase mt-0.5">
            {reportData.agency?.JABATAN_PEMBANTU || "Pembantu Pengurus Barang Pengguna"}
          </div>
          <div className="h-20"></div>
          <div className="font-bold underline text-sm">
            {reportData.agency?.NAMA_PEMBANTU || "( ................................................ )"}
          </div>
          <div>NIP. {reportData.agency?.NIP_PEMBANTU || "................................"}</div>
          <div className="text-[11px] text-slate-500">{reportData.agency?.PANGKAT_PEMBANTU || ""}</div>
        </div>

        <div>
          <div className="font-semibold text-slate-700">Mengetahui</div>
          <div className="font-bold uppercase mt-0.5">
            {reportData.agency?.JABATAN_KEPALA || reportData.bidang?.jabatanAtasan || "Kepala Dinas"}
          </div>
          <div className="h-20"></div>
          <div className="font-bold underline text-sm">
            {reportData.agency?.NAMA_KEPALA || reportData.bidang?.namaAtasan || "( ................................................ )"}
          </div>
          <div>NIP. {reportData.agency?.NIP_KEPALA || reportData.bidang?.nipAtasan || "................................"}</div>
          <div className="text-[11px] text-slate-500">
            {reportData.agency?.PANGKAT_KEPALA || reportData.bidang?.pangkatAtasan || ""}
          </div>
        </div>

        <div>
          <div className="text-slate-700">
            {reportData.agency?.TEMPAT_TTD || "Pasuruan"}, {formatDateIndo(endDate)}
          </div>
          <div className="font-bold uppercase mt-0.5">
            {reportData.agency?.JABATAN_PENATAUSAHAAN || "Pejabat Penatausahaan Barang Pengguna"}
          </div>
          <div className="h-20"></div>
          <div className="font-bold underline text-sm">
            {reportData.agency?.NAMA_PENATAUSAHAAN || reportData.bidang?.namaPengurus || "( ................................................ )"}
          </div>
          <div>
            NIP.{" "}
            {reportData.agency?.NIP_PENATAUSAHAAN || reportData.bidang?.nipPengurus || "................................"}
          </div>
          <div className="text-[11px] text-slate-500">
            {reportData.agency?.PANGKAT_PENATAUSAHAAN || reportData.bidang?.pangkatPengurus || ""}
          </div>
        </div>
      </div>
  );

  const activeBidangObj = bidangTabs.find((b) => b.id === activeBidangId);

  return (
    <div className="space-y-6">
      {/* Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center space-x-2.5">
            <FileText className="w-6 h-6 text-emerald-600" />
            <span>Laporan Resmi Persediaan BHP</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Laporan Mutasi, Buku Penerimaan, Buku Pengeluaran, dan Kartu Barang resmi DPRKP Kota Pasuruan.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 self-start">
          <button
            onClick={cetakPaket}
            disabled={!activeBidangId || loading}
            className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition shadow flex items-center justify-center space-x-2"
          >
            <Printer className="w-4 h-4" />
            <span>{mencetakPaket ? "Menyiapkan paket..." : "Cetak Paket Laporan"}</span>
          </button>
          <button
            onClick={() => window.print()}
            disabled={!reportData || loading}
            className="px-5 py-2.5 bg-slate-700 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition shadow flex items-center justify-center space-x-2"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Dokumen Ini</span>
          </button>
        </div>
      </div>

      {pesanPaket && (
        <div className="no-print bg-rose-50 border border-rose-300 text-rose-800 text-xs p-3 rounded-2xl">
          {pesanPaket}
        </div>
      )}

      {paket && (
        <div className="no-print bg-amber-50 border border-amber-300 text-amber-900 text-xs p-3 rounded-2xl flex items-center justify-between gap-3">
          <span>
            <strong>Mode Paket Cetak</strong> — {TIPE_PAKET.length + (paketBeritaAcara ? 1 : 0)} lembar berurutan
            (Laporan Mutasi, Buku Penerimaan, Buku Pengeluaran
{paketBeritaAcara ? ", dan Berita Acara Stok Opname" : ""}) periode {formatDateIndo(startDate)} s.d. {formatDateIndo(endDate)}.
          </span>
          <button
            onClick={() => setPaket(false)}
            className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 font-semibold whitespace-nowrap"
          >
            Tutup paket
          </button>
        </div>
      )}

      {/* 1. Sub-Menu Pilihan Lingkup Laporan (Semua Bidang vs Per Bidang) */}
      {isSuperAdmin ? (
        <div className="bg-slate-100 p-2 rounded-2xl space-y-2 no-print border border-slate-200">
          <div className="flex items-center justify-between px-2 pt-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-600" />
              <span>Lingkup Laporan (Hak Akses Superadmin):</span>
            </span>
            <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
              {activeBidangId === "ALL" ? "Laporan Konsolidasi SKPD" : `Unit Kerja: ${activeBidangObj?.nama || ""}`}
            </span>
          </div>

          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1">
            {/* Opsi 1: Semua Bidang (Gabungan SKPD) */}
            <button
              onClick={() => {
                setActiveBidangId("ALL");
                setSelectedItemId("");
                setKartuBidangFilter("ALL");
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 whitespace-nowrap shadow-sm ${
                activeBidangId === "ALL"
                  ? "bg-emerald-700 text-white ring-2 ring-emerald-500/50 shadow"
                  : "bg-white text-slate-700 hover:bg-slate-50 hover:text-emerald-700 border border-slate-200"
              }`}
            >
              <Globe className={`w-3.5 h-3.5 ${activeBidangId === "ALL" ? "text-emerald-200" : "text-emerald-600"}`} />
              <span>Semua Bidang (Gabungan SKPD)</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                  activeBidangId === "ALL" ? "bg-emerald-800 text-white" : "bg-emerald-100 text-emerald-800"
                }`}
              >
                SEMUA
              </span>
            </button>

            {/* Opsi 2..N: Per Bidang Masing-Masing */}
            {bidangTabs.map((b) => {
              const isSelected = activeBidangId === b.id;
              return (
                <button
                  key={b.id}
                  onClick={() => {
                    setActiveBidangId(b.id);
                    setSelectedItemId("");
                    setKartuBidangFilter(b.id);
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 whitespace-nowrap ${
                    isSelected
                      ? "bg-white text-emerald-800 shadow-sm border border-emerald-300 ring-2 ring-emerald-500/30 font-extrabold"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/70"
                  }`}
                >
                  <Building2 className={`w-3.5 h-3.5 ${isSelected ? "text-emerald-600" : "text-slate-400"}`} />
                  <span>{b.nama}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                      isSelected ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {b.kode}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* Non-Superadmin (Operator / Kepala Bidang) */
        <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-2xl flex items-center justify-between text-xs text-emerald-900 no-print">
          <div className="flex items-center space-x-2">
            <Building2 className="w-4 h-4 text-emerald-600" />
            <span>
              Unit Kerja: <strong>{userBidangInfo.nama || "Bidang Terdaftar"}</strong> ({userBidangInfo.kode || "-"})
            </span>
          </div>
          <span className="text-[11px] text-emerald-700 italic">
            (Akses laporan dikhususkan pada unit kerja wewenang Anda)
          </span>
        </div>
      )}

      {/* 2. Empat Jenis Dokumen Resmi */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 no-print">
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Pilih Format Dokumen Resmi:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => setReportType("MUTASI")}
              className={`p-3 rounded-xl border text-left transition flex items-start space-x-3 ${
                reportType === "MUTASI"
                  ? "bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-900"
                  : "border-slate-200 hover:bg-slate-50 text-slate-700"
              }`}
            >
              <FileSpreadsheet className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-bold text-sm">Laporan Mutasi Persediaan</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Saldo Awal, Masuk, Keluar & Akhir {activeBidangId === "ALL" ? "(Semua Bidang)" : "per Bidang"}
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setReportType("PENERIMAAN")}
              className={`p-3 rounded-xl border text-left transition flex items-start space-x-3 ${
                reportType === "PENERIMAAN"
                  ? "bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-900"
                  : "border-slate-200 hover:bg-slate-50 text-slate-700"
              }`}
            >
              <ArrowDownLeft className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-bold text-sm">Buku Penerimaan Barang</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Rekapitulasi Barang Masuk & BA Penerimaan (Lampiran 8)
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setReportType("PENGELUARAN")}
              className={`p-3 rounded-xl border text-left transition flex items-start space-x-3 ${
                reportType === "PENGELUARAN"
                  ? "bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-900"
                  : "border-slate-200 hover:bg-slate-50 text-slate-700"
              }`}
            >
              <ArrowUpRight className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-bold text-sm">Buku Pengeluaran Barang</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Rekapitulasi Barang Keluar & BAST (Lampiran 9)
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setReportType("KARTU_BARANG")}
              className={`p-3 rounded-xl border text-left transition flex items-start space-x-3 ${
                reportType === "KARTU_BARANG"
                  ? "bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-900"
                  : "border-slate-200 hover:bg-slate-50 text-slate-700"
              }`}
            >
              <Boxes className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-bold text-sm">Kartu Barang</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Buku Catatan Mutasi Saldo per Satuan Item
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Item Selector if Kartu Barang */}
        {reportType === "KARTU_BARANG" && reportData?.itemsList && reportData.itemsList.length > 0 && (
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-3">
            {activeBidangId === "ALL" && (
              <div className="flex items-center space-x-2">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <label className="text-xs font-bold text-slate-600 uppercase whitespace-nowrap">
                  Filter Bidang Item:
                </label>
                <select
                  value={kartuBidangFilter}
                  onChange={(e) => setKartuBidangFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-medium bg-white"
                >
                  <option value="ALL">Semua Bidang</option>
                  {bidangTabs.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.nama} ({b.kode})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center space-x-2 flex-1 min-w-[280px]">
              <label className="text-xs font-bold text-slate-700 uppercase whitespace-nowrap">
                Pilih Item Barang:
              </label>
              <select
                value={selectedItemId || reportData.item?.id || ""}
                onChange={(e) => setSelectedItemId(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium bg-white focus:ring-2 focus:ring-emerald-500"
              >
                {filteredCardItems.map((it) => (
                  <option key={it.id} value={it.id}>
                    {activeBidangId === "ALL" && it.bidangKode ? `[${it.bidangKode}] ` : ""}
                    {it.kode} — {it.nama} ({it.satuan})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Period Presets (For Mutasi, Penerimaan, Pengeluaran) */}
        {reportType !== "KARTU_BARANG" && (
          <>
            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase mr-1">Periode:</span>
              {[
                { id: "TRIWULAN_1", label: "Triwulan I" },
                { id: "TRIWULAN_2", label: "Triwulan II" },
                { id: "TRIWULAN_3", label: "Triwulan III" },
                { id: "TRIWULAN_4", label: "Triwulan IV" },
                { id: "SEMESTER_1", label: "Semester I" },
                { id: "SEMESTER_2", label: "Semester II" },
                { id: "TAHUNAN", label: "1 Tahun Penuh" },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    activePreset === p.id
                      ? "bg-emerald-600 text-white font-semibold shadow-sm"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {reportType === "MUTASI" && (
              <div className="pt-1 max-w-md">
                <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">
                  Kategori (satu lembar per kategori, seperti dokumen resmi)
                </label>
                <select
                  value={kategoriFilter}
                  onChange={(e) => setKategoriFilter(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-white"
                >
                  <option value="SEMUA">Semua Kategori (digabung + baris Jumlah)</option>
                  {daftarKategoriMutasi.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 max-w-md">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">
                  Dari Tanggal
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setActivePreset("CUSTOM");
                    setStartDate(e.target.value);
                  }}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">
                  Sampai Tanggal
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setActivePreset("CUSTOM");
                    setEndDate(e.target.value);
                  }}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs"
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* 3. Lembar Dokumen Siap Cetak (Resmi Sesuai Standar DPRKP) */}
      {(reportData || paket) && (
        <div className="space-y-6 print:space-y-0">
          {(paket ? TIPE_PAKET : [reportType]).map((tipe, idx) => {
            const data = paket ? paketData[tipe] : reportData;
            if (!data) return null;
            return (
              <div
                key={tipe}
                className={`bg-white rounded-2xl border border-slate-200 p-8 shadow-sm print:p-0 print:border-none print:shadow-none${
                  idx > 0 ? " cetak-halaman-baru" : ""
                }`}
              >
                {renderKop(data, tipe)}
                {tipe === "MUTASI" && renderTabelMutasi(data)}
                {tipe === "PENERIMAAN" && renderTabelPenerimaan(data)}
                {tipe === "PENGELUARAN" && renderTabelPengeluaran(data)}
                {tipe === "KARTU_BARANG" && renderTabelKartu(data)}
                {renderTtd(data)}
              </div>
            );
          })}

          {paket && paketBeritaAcara && (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm print:p-0 print:border-none print:shadow-none cetak-halaman-baru">
              <BeritaAcaraOpname
                instansi={paketBeritaAcara.agency.NAMA_INSTANSI || "Dinas Perumahan Rakyat dan Kawasan Permukiman"}
                kabKota={paketBeritaAcara.agency.KAB_KOTA || "Kota Pasuruan"}
                provinsi={paketBeritaAcara.agency.PROVINSI || "Jawa Timur"}
                logoSrc="/logo-pasuruan.png"
                tahun={(paketBeritaAcara.tanggal || "").slice(0, 4)}
                nomorBa={paketBeritaAcara.nomorBa || ""}
                tanggalOpname={paketBeritaAcara.tanggal}
                keterangan={paketBeritaAcara.keterangan}
                pemeriksa={{
                  nama: paketBeritaAcara.agency.NAMA_PENGURUS || "",
                  nip: paketBeritaAcara.agency.NIP_PENGURUS || "",
                  pangkat: paketBeritaAcara.agency.PANGKAT_PENGURUS || "",
                }}
                penatausahaan={{
                  nama: paketBeritaAcara.agency.NAMA_PENATAUSAHAAN || "",
                  nip: paketBeritaAcara.agency.NIP_PENATAUSAHAAN || "",
                  pangkat: paketBeritaAcara.agency.PANGKAT_PENATAUSAHAAN || "",
                }}
                kepala={{
                  nama: paketBeritaAcara.agency.NAMA_KEPALA || "",
                  nip: paketBeritaAcara.agency.NIP_KEPALA || "",
                  jabatan: paketBeritaAcara.agency.JABATAN_KEPALA || "Kepala Dinas",
                }}
                blok={paketBeritaAcara.blok}
                total={paketBeritaAcara.total}
                tempatTtd={paketBeritaAcara.agency.TEMPAT_TTD || "Pasuruan"}
                tanggalTtd={paketBeritaAcara.tanggalBa || paketBeritaAcara.tanggal}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
