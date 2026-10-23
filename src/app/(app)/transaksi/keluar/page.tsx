"use client";

import { useState, useEffect } from "react";
import NumberInput from "@/components/NumberInput";
import ItemCombobox, { type ItemPilihan } from "@/components/ItemCombobox";
import { formatAngka, formatRupiah } from "@/lib/format";
import { bacaDraft, hapusDraft, jamLokal, useDraftOtomatis } from "@/lib/draft";
import Link from "next/link";
import {
  ArrowUpRight,
  Plus,
  Trash2,
  X,
  Check,
  AlertCircle,
  Printer,
  FileCheck,
  Building,
  Pencil,
  Eye,
} from "lucide-react";

interface IssueRecord {
  id: string;
  nomorDokumen: string;
  tanggal: string;
  tglPenyerahan: string | null;
  penerima: string;
  keperluan: string | null;
  keterangan: string | null;
  namaPenyerah: string | null;
  nipPenyerah: string | null;
  jabatanPenyerah: string | null;
  namaPenerima: string | null;
  nipPenerima: string | null;
  jabatanPenerima: string | null;
  totalNilai: number;
  items: Array<{
    id: string;
    itemId: string;
    itemNama: string;
    jumlah: number;
    totalNilaiFifo: number;
  }>;
}

interface BidangInfo {
  nama: string;
  kode: string;
  namaPengurus: string | null;
  nipPengurus: string | null;
  jabatanPengurus: string | null;
}

/** Isian dokumen BAST yang disimpan sebagai draft. */
interface FormHeader {
  nomorDokumen: string;
  tanggal: string;
  tglPenyerahan: string;
  penerima: string;
  keperluan: string;
  keterangan: string;
  namaPenyerah: string;
  nipPenyerah: string;
  jabatanPenyerah: string;
  namaPenerima: string;
  nipPenerima: string;
  jabatanPenerima: string;
}

interface FormItemRow {
  itemId: string;
  /** null = belum diisi (bukan 0), supaya kolom bisa benar-benar dikosongkan. */
  jumlah: number | null;
}

interface DraftKeluar {
  formData: FormHeader;
  formRows: FormItemRow[];
}

const KUNCI_DRAFT = "pengeluaran";
const hariIni = () => new Date().toISOString().split("T")[0];

export default function TransaksiKeluarPage() {
  const [issues, setIssues] = useState<IssueRecord[]>([]);
  const [items, setItems] = useState<ItemPilihan[]>([]);
  const [bidang, setBidang] = useState<BidangInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Draft isian yang belum selesai (disimpan di browser)
  const [draftWaktu, setDraftWaktu] = useState<string | null>(null);
  const [draftDibuang, setDraftDibuang] = useState(false);
  const [draftHalaman, setDraftHalaman] = useState<string | null>(null);

  // Nomor dokumen saran dari sistem (dihitung dari nomor terakhir yang dipakai).
  const [nomorSaran, setNomorSaran] = useState("");

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIssueId, setEditingIssueId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Detail Modal for viewing & printing BAST
  const [viewingIssue, setViewingIssue] = useState<IssueRecord | null>(null);

  // Form Fields
  const [formData, setFormData] = useState<FormHeader>({
    nomorDokumen: "",
    tanggal: hariIni(),
    tglPenyerahan: hariIni(),
    penerima: "",
    keperluan: "",
    keterangan: "",
    namaPenyerah: "",
    nipPenyerah: "",
    jabatanPenyerah: "Pengurus Barang Pembantu",
    namaPenerima: "",
    nipPenerima: "",
    jabatanPenerima: "Penerima Barang",
  });

  const [formRows, setFormRows] = useState<FormItemRow[]>([{ itemId: "", jumlah: 1 }]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [issRes, iRes, meRes] = await Promise.all([
        fetch("/api/issues"),
        fetch("/api/items"),
        fetch("/api/auth/me"),
      ]);

      const issJson = await issRes.json();
      const iJson = await iRes.json();
      const meJson = await meRes.json();

      if (!issRes.ok) throw new Error(issJson.error);
      if (!iRes.ok) throw new Error(iJson.error);

      setIssues(issJson.data);
      setItems(iJson.data);
      setNomorSaran(typeof issJson.nextNomor === "string" ? issJson.nextNomor : "");
      if (meJson.activeBidang) {
        setBidang(meJson.activeBidang);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal memuat data transaksi pengeluaran");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Simpan draft otomatis selama mengisi dokumen baru.
  const adaIsi =
    editingIssueId === null &&
    (formRows.some((r) => r.itemId !== "") ||
      formData.penerima.trim() !== "" ||
      formData.keperluan.trim() !== "" ||
      formData.keterangan.trim() !== "");

  const { tersimpan: draftOtomatis } = useDraftOtomatis<DraftKeluar>(
    KUNCI_DRAFT,
    isModalOpen && editingIssueId === null && !draftDibuang && adaIsi,
    { formData, formRows }
  );

  // Beri tahu di daftar dokumen bila masih ada isian yang belum tersimpan.
  useEffect(() => {
    if (isModalOpen) return;
    const draft = bacaDraft<DraftKeluar>(KUNCI_DRAFT);
    setDraftHalaman(draft?.data?.formRows?.length ? jamLokal(draft.disimpanPada) : null);
  }, [isModalOpen]);

  const formDasar = (): FormHeader => ({
    nomorDokumen: nomorSaran,
    tanggal: hariIni(),
    tglPenyerahan: hariIni(),
    penerima: "",
    keperluan: "",
    keterangan: "",
    namaPenyerah: bidang?.namaPengurus || "",
    nipPenyerah: bidang?.nipPengurus || "",
    jabatanPenyerah: bidang?.jabatanPengurus || "Pengurus Barang Pembantu",
    namaPenerima: "",
    nipPenerima: "",
    jabatanPenerima: "Penerima Barang",
  });

  const barisDasar = (): FormItemRow[] => [{ itemId: "", jumlah: 1 }];

  const openCreateModal = () => {
    setEditingIssueId(null);
    setDraftDibuang(false);

    // Lanjutkan isian yang belum selesai (halaman sempat tertutup / ter-refresh).
    const draft = bacaDraft<DraftKeluar>(KUNCI_DRAFT);
    if (draft?.data?.formRows?.length) {
      setFormData({ ...formDasar(), ...draft.data.formData });
      setFormRows(draft.data.formRows);
      setDraftWaktu(jamLokal(draft.disimpanPada));
    } else {
      setFormData(formDasar());
      setFormRows(barisDasar());
      setDraftWaktu(null);
    }
    setIsModalOpen(true);
  };

  const buangDraft = () => {
    hapusDraft(KUNCI_DRAFT);
    setDraftWaktu(null);
    setDraftDibuang(true);
    setDraftHalaman(null);
    setFormData(formDasar());
    setFormRows(barisDasar());
  };

  const openEditModal = (iss: IssueRecord) => {
    setEditingIssueId(iss.id);
    setDraftWaktu(null);
    setDraftDibuang(true);
    setFormData({
      nomorDokumen: iss.nomorDokumen,
      tanggal: iss.tanggal,
      tglPenyerahan: iss.tglPenyerahan || iss.tanggal,
      penerima: iss.penerima,
      keperluan: iss.keperluan || "",
      keterangan: iss.keterangan || "",
      namaPenyerah: iss.namaPenyerah || bidang?.namaPengurus || "",
      nipPenyerah: iss.nipPenyerah || bidang?.nipPengurus || "",
      jabatanPenyerah: iss.jabatanPenyerah || bidang?.jabatanPengurus || "Pengurus Barang Pembantu",
      namaPenerima: iss.namaPenerima || "",
      nipPenerima: iss.nipPenerima || "",
      jabatanPenerima: iss.jabatanPenerima || "Penerima Barang",
    });

    if (iss.items && iss.items.length > 0) {
      setFormRows(
        iss.items.map((it) => ({
          itemId: it.itemId,
          jumlah: it.jumlah,
        }))
      );
    } else {
      const availableItem = items.find((it) => it.stok > 0) || items[0];
      setFormRows([{ itemId: availableItem?.id || "", jumlah: 1 }]);
    }

    if (viewingIssue) setViewingIssue(null);
    setIsModalOpen(true);
  };

  const handleRowChange = (index: number, patch: Partial<FormItemRow>) => {
    setFormRows((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  /** Memilih barang untuk baris ini. */
  const handlePilihBarang = (index: number, itemId: string) => {
    setFormRows((rows) =>
      rows.map((row, i) => (i === index && row.itemId !== itemId ? { ...row, itemId } : row))
    );
  };

  /** Total jumlah keluar per barang (untuk memeriksa stok). */
  const totalPerBarang = (itemId: string) =>
    formRows
      .filter((r) => r.itemId === itemId)
      .reduce((sum, r) => sum + (r.jumlah ?? 0), 0);

  const addRow = () => {
    setFormRows([...formRows, { itemId: "", jumlah: 1 }]);
  };

  const removeRow = (index: number) => {
    if (formRows.length <= 1) return;
    setFormRows(formRows.filter((_, i) => i !== index));
  };

  /** Memeriksa isian sebelum dikirim, supaya mitra tahu baris mana yang kurang. */
  const validasiIsian = (): string | null => {
    if (!formData.penerima.trim()) return "Nama penerima / bagian penerima wajib diisi.";
    if (formRows.length === 0) return "Tambahkan minimal satu barang.";
    for (let i = 0; i < formRows.length; i += 1) {
      const baris = formRows[i];
      if (!baris.itemId) return `Baris ${i + 1}: barang belum dipilih.`;
      if (!baris.jumlah || baris.jumlah <= 0) return `Baris ${i + 1}: jumlah harus lebih dari 0.`;
    }

    // Saat membuat dokumen baru, periksa stok per barang (baris kembar dihitung sekali).
    if (!editingIssueId) {
      const sudahDiperiksa = new Set<string>();
      for (const baris of formRows) {
        if (sudahDiperiksa.has(baris.itemId)) continue;
        sudahDiperiksa.add(baris.itemId);
        const barang = items.find((it) => it.id === baris.itemId);
        if (!barang) continue;
        const diminta = totalPerBarang(baris.itemId);
        if (diminta > barang.stok) {
          return `Stok ${barang.nama} tidak cukup: tersedia ${formatAngka(barang.stok)}, diminta ${formatAngka(diminta)}.`;
        }
      }
    }
    return null;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const masalah = validasiIsian();
    if (masalah) {
      setError(masalah);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        ...formData,
        items: formRows.map((baris) => ({
          itemId: baris.itemId,
          jumlah: baris.jumlah ?? 0,
        })),
      };

      if (editingIssueId) {
        payload.id = editingIssueId;
      }

      const res = await fetch("/api/issues", {
        method: editingIssueId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      hapusDraft(KUNCI_DRAFT);
      setDraftWaktu(null);
      setDraftHalaman(null);
      setIsModalOpen(false);
      setEditingIssueId(null);
      fetchData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan pengeluaran");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (iss: IssueRecord) => {
    if (!confirm(`Hapus dan batalkan dokumen BAST "${iss.nomorDokumen}"? Stok barang akan dikembalikan ke persediaan.`)) return;

    try {
      const res = await fetch(`/api/issues?id=${iss.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      if (viewingIssue?.id === iss.id) setViewingIssue(null);
      fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Gagal menghapus pengeluaran");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center space-x-2.5">
            <ArrowUpRight className="w-6 h-6 text-blue-600" />
            <span>Pengeluaran Barang (BAST & Bukti Serah Terima)</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Pencatatan distribusi barang persediaan ke seksi / pegawai beserta pemotongan stok metode FIFO di lingkungan DPRKP Kota Pasuruan.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          disabled={items.length === 0}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-sm transition shadow flex items-center space-x-2 self-start disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          <span>Buat Pengeluaran / BAST</span>
        </button>
      </div>

      {draftHalaman && (
        <div className="p-4 rounded-xl bg-sky-50 border border-sky-200 text-sky-800 text-sm flex items-start justify-between gap-3">
          <span>
            Ada isian pengeluaran yang <strong>belum selesai disimpan</strong> (draft tersimpan pukul {draftHalaman}).
            Klik &ldquo;Catat Pengeluaran Baru&rdquo; untuk melanjutkannya.
          </span>
          <button
            type="button"
            onClick={buangDraft}
            className="text-xs font-semibold text-sky-700 hover:text-sky-900 underline whitespace-nowrap"
          >
            Buang draft
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start space-x-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Issues Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Memuat data pengeluaran...</div>
        ) : issues.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            Belum ada transaksi pengeluaran barang di bidang ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Tanggal</th>
                  <th className="px-6 py-3.5">Nomor BAST</th>
                  <th className="px-6 py-3.5">Penerima / Seksi</th>
                  <th className="px-6 py-3.5">Keperluan</th>
                  <th className="px-6 py-3.5 text-right">Rincian Barang</th>
                  <th className="px-6 py-3.5 text-right">Nilai FIFO (Rp)</th>
                  <th className="px-6 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {issues.map((iss) => (
                  <tr key={iss.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-slate-800">
                      {iss.tanggal}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs font-semibold text-slate-900">
                      {iss.nomorDokumen}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-800">
                      {iss.penerima}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600 max-w-xs truncate">
                      {iss.keperluan || "Operasional Rutin"}
                    </td>
                    <td className="px-6 py-4 text-right text-xs font-medium text-slate-600">
                      {iss.items.length} jenis item
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-slate-800">
                      {formatRupiah(iss.totalNilai)}
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap space-x-1.5">
                      <button
                        onClick={() => setViewingIssue(iss)}
                        className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold transition inline-flex items-center space-x-1"
                        title="Lihat & Cetak BAST"
                      >
                        <FileCheck className="w-3.5 h-3.5" />
                        <span>BAST</span>
                      </button>
                      <button
                        onClick={() => openEditModal(iss)}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold transition inline-flex items-center space-x-1"
                        title="Edit Dokumen BAST"
                      >
                        <Pencil className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => handleDelete(iss)}
                        className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition inline-flex items-center"
                        title="Hapus BAST & Kembalikan Stok"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal View Detail & Print BAST */}
      {viewingIssue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl my-8 overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between no-print">
              <h3 className="font-bold text-slate-800 text-base flex items-center space-x-2">
                <FileCheck className="w-5 h-5 text-blue-600" />
                <span>Berita Acara Serah Terima (BAST): {viewingIssue.nomorDokumen}</span>
              </h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => openEditModal(viewingIssue)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center space-x-1.5 transition shadow"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Edit Data Ini</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center space-x-1.5 transition shadow"
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak Dokumen</span>
                </button>
                <button onClick={() => setViewingIssue(null)} className="text-slate-400 hover:text-slate-600 p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Print Friendly BAST Document */}
            <div className="p-8 space-y-6 text-slate-800 print:p-0 print:border-none">
              {/* Kop Surat BAST */}
              <div className="text-center border-b-2 border-slate-800 pb-4">
                <div className="flex items-center justify-center space-x-3 mb-1">
                  <img src="/logo-pasuruan.png" alt="Logo Kota Pasuruan" className="w-12 h-12 object-contain" />
                  <div>
                    <h2 className="text-xs font-semibold tracking-wider uppercase text-slate-600">
                      PEMERINTAH KOTA PASURUAN
                    </h2>
                    <h1 className="text-base font-bold uppercase tracking-wide">
                      DINAS PERUMAHAN RAKYAT DAN KAWASAN PERMUKIMAN
                    </h1>
                  </div>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Kompleks Perkantoran Pemerintah Kota Pasuruan, Jawa Timur
                </p>
                <div className="mt-3 font-bold text-sm tracking-wide border-t border-slate-300 pt-2 uppercase">
                  BERITA ACARA SERAH TERIMA BARANG (BAST)
                </div>
                <div className="text-xs font-mono font-semibold text-slate-700 mt-0.5">
                  Nomor: {viewingIssue.nomorDokumen}
                </div>
              </div>

              {/* Paragraf Pembuka */}
              <p className="text-xs leading-relaxed text-justify">
                Pada hari ini tanggal <strong>{viewingIssue.tanggal}</strong>, kami yang bertanda tangan di bawah ini masing-masing:
              </p>

              {/* Data Pihak */}
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-4 gap-2">
                  <span className="font-semibold">Nama Penyerah</span>
                  <span className="col-span-3">: {viewingIssue.namaPenyerah || "( ................................................ )"}</span>
                  <span className="font-semibold">NIP</span>
                  <span className="col-span-3">: {viewingIssue.nipPenyerah || "-"}</span>
                  <span className="font-semibold">Jabatan</span>
                  <span className="col-span-3">: {viewingIssue.jabatanPenyerah || "Pengurus Barang Pembantu"}</span>
                  <span className="col-span-4 text-slate-500 italic">Selanjutnya disebut sebagai <strong>PIHAK PERTAMA (Yang Menyerahkan)</strong>.</span>
                </div>

                <div className="border-t border-slate-200 pt-2 grid grid-cols-4 gap-2">
                  <span className="font-semibold">Penerima / Unit</span>
                  <span className="col-span-3">: {viewingIssue.penerima}</span>
                  <span className="font-semibold">Nama Penerima</span>
                  <span className="col-span-3">: {viewingIssue.namaPenerima || viewingIssue.penerima}</span>
                  <span className="font-semibold">NIP</span>
                  <span className="col-span-3">: {viewingIssue.nipPenerima || "-"}</span>
                  <span className="font-semibold">Jabatan</span>
                  <span className="col-span-3">: {viewingIssue.jabatanPenerima || "Penerima Barang"}</span>
                  <span className="col-span-4 text-slate-500 italic">Selanjutnya disebut sebagai <strong>PIHAK KEDUA (Yang Menerima)</strong>.</span>
                </div>
              </div>

              <p className="text-xs leading-relaxed text-justify">
                PIHAK PERTAMA menyerahkan barang persediaan kepada PIHAK KEDUA, dan PIHAK KEDUA menyatakan telah menerima barang persediaan dalam keadaan baik dan lengkap untuk keperluan: <strong>{viewingIssue.keperluan || "Operasional Kedinasan"}</strong>, dengan rincian sebagai berikut:
              </p>

              {/* Tabel Barang BAST */}
              <div className="border border-slate-800 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-900 border-b border-slate-800 font-bold uppercase text-center">
                    <tr>
                      <th className="p-2 border-r border-slate-800 w-10">No</th>
                      <th className="p-2 border-r border-slate-800 text-left">Nama Barang Persediaan</th>
                      <th className="p-2 border-r border-slate-800 w-24">Jumlah</th>
                      <th className="p-2 text-right">Nilai Perolehan (FIFO)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300">
                    {viewingIssue.items.map((it, idx) => (
                      <tr key={idx}>
                        <td className="p-2 border-r border-slate-800 text-center">{idx + 1}</td>
                        <td className="p-2 border-r border-slate-800 font-medium">{it.itemNama}</td>
                        <td className="p-2 border-r border-slate-800 text-center font-bold">{it.jumlah}</td>
                        <td className="p-2 text-right font-mono">{formatRupiah(it.totalNilaiFifo)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-bold border-t border-slate-800">
                      <td colSpan={3} className="p-2 border-r border-slate-800 text-right">Total Nilai Penyerahan:</td>
                      <td className="p-2 text-right font-mono text-slate-900">{formatRupiah(viewingIssue.totalNilai)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Tanda Tangan */}
              <div className="pt-6 grid grid-cols-2 text-center text-xs gap-8 break-inside-avoid">
                <div>
                  <div className="font-semibold text-slate-700">PIHAK KEDUA (Yang Menerima)</div>
                  <div className="font-bold uppercase mt-0.5">{viewingIssue.jabatanPenerima || "Penerima Barang"}</div>
                  <div className="h-20"></div>
                  <div className="font-bold underline text-sm">
                    {viewingIssue.namaPenerima || viewingIssue.penerima}
                  </div>
                  <div>NIP. {viewingIssue.nipPenerima || "................................"}</div>
                </div>

                <div>
                  <div className="font-semibold text-slate-700">PIHAK PERTAMA (Yang Menyerahkan)</div>
                  <div className="font-bold uppercase mt-0.5">{viewingIssue.jabatanPenyerah || "Pengurus Barang Pembantu"}</div>
                  <div className="h-20"></div>
                  <div className="font-bold underline text-sm">
                    {viewingIssue.namaPenyerah || "( ................................................ )"}
                  </div>
                  <div>NIP. {viewingIssue.nipPenyerah || "................................"}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Add / Edit Pengeluaran */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl my-8 overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-base flex items-center space-x-2">
                <ArrowUpRight className="w-5 h-5 text-blue-600" />
                <span>{editingIssueId ? `Edit Dokumen BAST: ${formData.nomorDokumen}` : "Buat Pengeluaran Barang / BAST Baru"}</span>
              </h3>
              <button onClick={() => { setIsModalOpen(false); setEditingIssueId(null); }} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-5">
              {(draftOtomatis || draftWaktu) && (
                <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-sky-900 text-xs flex items-start justify-between gap-3">
                  <span>
                    <strong>Draft tersimpan otomatis</strong> pukul {draftOtomatis || draftWaktu}. Isian ini tidak
                    hilang walaupun halaman ditutup atau komputer mati.
                  </span>
                  <button type="button" onClick={buangDraft} className="font-semibold underline whitespace-nowrap">
                    Buang draft
                  </button>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Tanggal Pengeluaran *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.tanggal}
                    onChange={(e) => setFormData({ ...formData, tanggal: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Penerima / Seksi *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Seksi Prasarana & Sarana"
                    value={formData.penerima}
                    onChange={(e) => setFormData({ ...formData, penerima: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Nomor BAST
                  </label>
                  <input
                    type="text"
                    placeholder="Otomatis bila dikosongkan"
                    value={formData.nomorDokumen}
                    onChange={(e) => setFormData({ ...formData, nomorDokumen: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Nomor saran: <span className="font-mono">{nomorSaran || "-"}</span>
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Keperluan Penyerahan Barang
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Kebutuhan operasional kantor dan administrasi pelayanan"
                  value={formData.keperluan}
                  onChange={(e) => setFormData({ ...formData, keperluan: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              {/* TTD Pihak Pertama & Kedua */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-bold text-slate-700 uppercase mb-2">Pihak Pertama (Penyerah)</div>
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Nama Penyerah"
                      value={formData.namaPenyerah}
                      onChange={(e) => setFormData({ ...formData, namaPenyerah: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                    />
                    <input
                      type="text"
                      placeholder="NIP Penyerah"
                      value={formData.nipPenyerah}
                      onChange={(e) => setFormData({ ...formData, nipPenyerah: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <div className="text-xs font-bold text-slate-700 uppercase mb-2">Pihak Kedua (Penerima)</div>
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Nama Penerima (opsional jika perorangan)"
                      value={formData.namaPenerima}
                      onChange={(e) => setFormData({ ...formData, namaPenerima: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                    />
                    <input
                      type="text"
                      placeholder="NIP Penerima (opsional)"
                      value={formData.nipPenerima}
                      onChange={(e) => setFormData({ ...formData, nipPenerima: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Daftar Barang yang Dikeluarkan
                  </label>
                  <button
                    type="button"
                    onClick={addRow}
                    className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Baris Barang</span>
                  </button>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-600 font-semibold uppercase">
                      <tr>
                        <th className="p-3 w-3/4">Nama Barang (Stok Tersedia)</th>
                        <th className="p-3 w-32">Jumlah Keluar</th>
                        <th className="p-3 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {formRows.map((row, idx) => {
                        const selectedItem = items.find((i) => i.id === row.itemId);
                        const diminta = totalPerBarang(row.itemId);
                        const isOverStock = Boolean(
                          selectedItem && !editingIssueId && row.itemId && diminta > selectedItem.stok
                        );
                        return (
                          <tr key={idx}>
                            <td className="p-2">
                              <ItemCombobox
                                items={items}
                                value={row.itemId}
                                onChange={(itemId) => handlePilihBarang(idx, itemId)}
                                tampilkanStok
                                placeholder="Ketik nama / kode barang..."
                                className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-left text-xs hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </td>
                            <td className="p-2">
                              <NumberInput
                                mode="qty"
                                required
                                value={row.jumlah}
                                onChange={(nilai) => handleRowChange(idx, { jumlah: nilai })}
                                className={`w-full px-2.5 py-1.5 rounded-lg border text-xs text-right ${
                                  isOverStock
                                    ? "border-rose-500 bg-rose-50 text-rose-800 font-bold"
                                    : "border-slate-300"
                                }`}
                              />
                              {isOverStock && selectedItem && (
                                <span className="text-[10px] text-rose-600">
                                  Melebihi stok ({formatAngka(selectedItem.stok)})
                                </span>
                              )}
                            </td>
                            <td className="p-2 text-center">
                              {formRows.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeRow(idx)}
                                  className="text-slate-400 hover:text-rose-500 p-1"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => { setIsModalOpen(false); setEditingIssueId(null); }}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition shadow flex items-center space-x-2"
                >
                  <Check className="w-4 h-4" />
                  <span>{saving ? "Memproses Stok FIFO..." : (editingIssueId ? "Simpan Perubahan BAST" : "Simpan Pengeluaran & BAST")}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
