"use client";

import { useState, useEffect } from "react";
import NumberInput from "@/components/NumberInput";
import ItemCombobox, { type ItemPilihan } from "@/components/ItemCombobox";
import { formatRupiah } from "@/lib/format";
import { bacaDraft, hapusDraft, jamLokal, useDraftOtomatis } from "@/lib/draft";
import {
  ArrowDownLeft,
  Plus,
  Trash2,
  X,
  Check,
  AlertCircle,
  Calendar,
  Building,
  FileText,
  Pencil,
  Eye,
} from "lucide-react";

interface ReceiptRecord {
  id: string;
  nomorDokumen: string;
  tanggal: string;
  vendorId?: string | null;
  vendorNama: string | null;
  noFaktur: string | null;
  tglFaktur: string | null;
  noBa: string | null;
  tglBa: string | null;
  keterangan: string | null;
  totalNilai: number;
  /** true bila sebagian stok dokumen ini sudah keluar lewat BAST (rincian terkunci). */
  locked?: boolean;
  /** true bila stok dokumen ini berkurang tanpa jejak dokumen (data perlu diperbaiki). */
  stale?: boolean;
  /** true bila dokumen ini lahir dari penyesuaian stock opname, bukan pembelian. */
  isPenyesuaian?: boolean;
  items: Array<{
    id: string;
    itemId: string;
    itemNama: string;
    jumlah: number;
    hargaSatuan: number;
    jumlahHarga: number;
  }>;
}

interface VendorOption {
  id: string;
  nama: string;
}

/** Isian dokumen penerimaan yang disimpan sebagai draft. */
interface FormHeader {
  nomorDokumen: string;
  tanggal: string;
  vendorId: string;
  vendorNama: string;
  noFaktur: string;
  tglFaktur: string;
  noBa: string;
  tglBa: string;
  keterangan: string;
}

interface FormItemRow {
  itemId: string;
  /** null = belum diisi (bukan 0), supaya kolom bisa benar-benar dikosongkan. */
  jumlah: number | null;
  hargaSatuan: number | null;
}

interface DraftMasuk {
  formData: FormHeader;
  formRows: FormItemRow[];
}

const KUNCI_DRAFT = "penerimaan";
const hariIni = () => new Date().toISOString().split("T")[0];

export default function TransaksiMasukPage() {
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
  const [items, setItems] = useState<ItemPilihan[]>([]);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReceiptId, setEditingReceiptId] = useState<string | null>(null);
  // Rincian barang terkunci bila stok dokumen ini sudah pernah dikeluarkan lewat BAST.
  const [editingLocked, setEditingLocked] = useState(false);
  // Stok berkurang tanpa jejak dokumen: bukan karena BAST, tapi data perlu diperbaiki.
  const [editingStale, setEditingStale] = useState(false);
  const [saving, setSaving] = useState(false);

  // Draft isian yang belum selesai (disimpan di browser)
  const [draftWaktu, setDraftWaktu] = useState<string | null>(null);
  const [draftDibuang, setDraftDibuang] = useState(false);
  const [draftHalaman, setDraftHalaman] = useState<string | null>(null);

  // Nomor dokumen saran dari sistem (dihitung dari nomor terakhir yang dipakai).
  const [nomorSaran, setNomorSaran] = useState("");

  // Detail Modal for viewing
  const [viewingReceipt, setViewingReceipt] = useState<ReceiptRecord | null>(null);

  // Form Fields
  const [formData, setFormData] = useState<FormHeader>({
    nomorDokumen: "",
    tanggal: new Date().toISOString().split("T")[0],
    vendorId: "",
    vendorNama: "",
    noFaktur: "",
    tglFaktur: new Date().toISOString().split("T")[0],
    noBa: "",
    tglBa: new Date().toISOString().split("T")[0],
    keterangan: "",
  });

  const [formRows, setFormRows] = useState<FormItemRow[]>([
    { itemId: "", jumlah: 1, hargaSatuan: null },
  ]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [rRes, iRes, vRes] = await Promise.all([
        fetch("/api/receipts"),
        fetch("/api/items"),
        fetch("/api/vendors"),
      ]);

      const rJson = await rRes.json();
      const iJson = await iRes.json();
      const vJson = await vRes.json();

      if (!rRes.ok) throw new Error(rJson.error);
      if (!iRes.ok) throw new Error(iJson.error);
      if (!vRes.ok) throw new Error(vJson.error);

      setReceipts(rJson.data);
      setItems(iJson.data);
      setVendors(vJson.data);
      setNomorSaran(typeof rJson.nextNomor === "string" ? rJson.nextNomor : "");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal memuat data transaksi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Simpan draft otomatis selama mengisi dokumen baru.
  const adaIsi =
    editingReceiptId === null &&
    (formRows.some((r) => r.itemId !== "" || (r.hargaSatuan ?? 0) > 0) ||
      formData.noFaktur.trim() !== "" ||
      formData.keterangan.trim() !== "");

  const { tersimpan: draftOtomatis } = useDraftOtomatis<DraftMasuk>(
    KUNCI_DRAFT,
    isModalOpen && editingReceiptId === null && !draftDibuang && adaIsi,
    { formData, formRows }
  );

  // Beri tahu di daftar dokumen bila masih ada isian yang belum tersimpan.
  useEffect(() => {
    if (isModalOpen) return;
    const draft = bacaDraft<DraftMasuk>(KUNCI_DRAFT);
    setDraftHalaman(draft?.data?.formRows?.length ? jamLokal(draft.disimpanPada) : null);
  }, [isModalOpen]);

  const formDasar = (): FormHeader => ({
    nomorDokumen: nomorSaran,
    tanggal: hariIni(),
    vendorId: vendors[0]?.id || "",
    vendorNama: vendors[0]?.nama || "",
    noFaktur: "",
    tglFaktur: hariIni(),
    noBa: "",
    tglBa: hariIni(),
    keterangan: "",
  });

  const barisDasar = (): FormItemRow[] => [{ itemId: "", jumlah: 1, hargaSatuan: null }];

  const openCreateModal = () => {
    setEditingReceiptId(null);
    setEditingLocked(false);
    setEditingStale(false);
    setDraftDibuang(false);

    // Lanjutkan isian yang belum selesai (halaman sempat tertutup / ter-refresh).
    const draft = bacaDraft<DraftMasuk>(KUNCI_DRAFT);
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

  const openEditModal = (r: ReceiptRecord) => {
    setEditingReceiptId(r.id);
    setEditingLocked(Boolean(r.locked));
    setEditingStale(Boolean(r.stale));
    setDraftWaktu(null);
    setDraftDibuang(true);
    setFormData({
      nomorDokumen: r.nomorDokumen,
      tanggal: r.tanggal,
      vendorId: r.vendorId || (vendors.find((v) => v.nama === r.vendorNama)?.id || ""),
      vendorNama: r.vendorNama || "",
      noFaktur: r.noFaktur || "",
      tglFaktur: r.tglFaktur || r.tanggal,
      noBa: r.noBa || "",
      tglBa: r.tglBa || r.tanggal,
      keterangan: r.keterangan || "",
    });

    if (r.items && r.items.length > 0) {
      setFormRows(
        r.items.map((it) => ({
          itemId: it.itemId,
          jumlah: it.jumlah,
          hargaSatuan: it.hargaSatuan,
        }))
      );
    } else {
      setFormRows(barisDasar());
    }

    if (viewingReceipt) {
      setViewingReceipt(null);
    }
    setIsModalOpen(true);
  };

  const handleRowChange = (index: number, patch: Partial<FormItemRow>) => {
    setFormRows((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  /** Memilih barang: harga satuan langsung terisi dari harga beli terakhir. */
  const handlePilihBarang = (index: number, itemId: string) => {
    setFormRows((rows) =>
      rows.map((row, i) => {
        if (i !== index || row.itemId === itemId) return row;
        const barang = items.find((it) => it.id === itemId);
        return { ...row, itemId, hargaSatuan: barang?.hargaTerakhir ?? null };
      })
    );
  };

  const addRow = () => {
    setFormRows([...formRows, { itemId: "", jumlah: 1, hargaSatuan: null }]);
  };

  const removeRow = (index: number) => {
    if (formRows.length <= 1) return;
    setFormRows(formRows.filter((_, i) => i !== index));
  };

  const totalBelanja = formRows.reduce(
    (sum, r) => sum + (r.jumlah ?? 0) * (r.hargaSatuan ?? 0),
    0
  );

  /** Memeriksa isian sebelum dikirim, supaya mitra tahu baris mana yang kurang. */
  const validasiIsian = (): string | null => {
    // Nomor dokumen boleh kosong: sistem membuat nomor otomatis.
    if (formRows.length === 0) return "Tambahkan minimal satu barang.";
    for (let i = 0; i < formRows.length; i += 1) {
      const baris = formRows[i];
      if (!baris.itemId) return `Baris ${i + 1}: barang belum dipilih.`;
      if (!baris.jumlah || baris.jumlah <= 0) return `Baris ${i + 1}: jumlah harus lebih dari 0.`;
      if (baris.hargaSatuan === null || baris.hargaSatuan <= 0) {
        return `Baris ${i + 1}: harga satuan wajib diisi (harga tidak boleh nol).`;
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
      const selectedVendor = vendors.find((v) => v.id === formData.vendorId);
      const payload: Record<string, unknown> = {
        ...formData,
        vendorNama: selectedVendor?.nama || formData.vendorNama,
        items: formRows.map((baris) => ({
          itemId: baris.itemId,
          jumlah: baris.jumlah ?? 0,
          hargaSatuan: baris.hargaSatuan ?? 0,
        })),
      };

      if (editingReceiptId) {
        payload.id = editingReceiptId;
      }

      const res = await fetch("/api/receipts", {
        method: editingReceiptId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      hapusDraft(KUNCI_DRAFT);
      setDraftWaktu(null);
      setDraftHalaman(null);
      setIsModalOpen(false);
      setEditingReceiptId(null);
      fetchData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan transaksi");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (r: ReceiptRecord) => {
    if (!confirm(`Hapus transaksi penerimaan "${r.nomorDokumen}"? Tindakan ini tidak dapat dibatalkan.`)) return;

    try {
      const res = await fetch(`/api/receipts?id=${r.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      if (viewingReceipt?.id === r.id) setViewingReceipt(null);
      fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Gagal menghapus penerimaan");
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center space-x-2.5">
            <ArrowDownLeft className="w-6 h-6 text-emerald-600" />
            <span>Penerimaan Barang Masuk (Faktur & BA)</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Pencatatan barang persediaan masuk dari penyedia / rekanan beserta nomor faktur dan dokumen BA di lingkungan DPRKP Kota Pasuruan.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          disabled={items.length === 0}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl text-sm transition shadow flex items-center space-x-2 self-start disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          <span>Catat Penerimaan Baru</span>
        </button>
      </div>

      {items.length === 0 && !loading && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          Master Barang di bidang ini masih kosong. Silakan tambahkan barang di menu <strong>Master Barang</strong> terlebih dahulu.
        </div>
      )}

      {draftHalaman && (
        <div className="p-4 rounded-xl bg-sky-50 border border-sky-200 text-sky-800 text-sm flex items-start justify-between gap-3">
          <span>
            Ada isian penerimaan yang <strong>belum selesai disimpan</strong> (draft tersimpan pukul {draftHalaman}).
            Klik &ldquo;Catat Penerimaan Baru&rdquo; untuk melanjutkannya.
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

      {/* Receipts Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Memuat data penerimaan...</div>
        ) : receipts.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            Belum ada transaksi penerimaan barang di bidang ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Tanggal</th>
                  <th className="px-6 py-3.5">No. Dokumen / Ref</th>
                  <th className="px-6 py-3.5">Penyedia / Vendor</th>
                  <th className="px-6 py-3.5">Faktur & BA</th>
                  <th className="px-6 py-3.5 text-right">Rincian Barang</th>
                  <th className="px-6 py-3.5 text-right">Total Nilai</th>
                  <th className="px-6 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {receipts.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-slate-800">
                      {r.tanggal}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs font-semibold text-slate-900">
                      {r.nomorDokumen}
                      {r.isPenyesuaian && (
                        <span
                          className="ml-2 px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 border border-sky-200 text-[10px] font-sans font-semibold align-middle"
                          title="Dokumen ini berasal dari penyesuaian stock opname (bukan pembelian dari penyedia)"
                        >
                          penyesuaian opname
                        </span>
                      )}
                      {r.stale ? (
                        <span
                          className="ml-2 px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-sans font-semibold align-middle"
                          title="Stok dokumen ini berkurang tanpa jejak dokumen pengeluaran — perlu perbaikan stok (npm run db:repair-stock)"
                        >
                          stok tidak seimbang
                        </span>
                      ) : (
                        r.locked && (
                          <span
                            className="ml-2 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-sans font-semibold align-middle"
                            title="Rincian terkunci: sebagian stok dokumen ini sudah dikeluarkan lewat BAST"
                          >
                            terkunci
                          </span>
                        )
                      )}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-800">
                      {r.vendorNama || "-"}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600">
                      <div>Faktur: <span className="font-mono">{r.noFaktur || "-"}</span></div>
                      <div>BA: <span className="font-mono">{r.noBa || "-"}</span></div>
                    </td>
                    <td className="px-6 py-4 text-right text-xs font-medium text-slate-600">
                      {r.items.length} jenis item
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-slate-800">
                      {formatRupiah(r.totalNilai)}
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap space-x-1.5">
                      <button
                        onClick={() => setViewingReceipt(r)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition inline-flex items-center space-x-1"
                        title="Lihat Rincian"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-500" />
                        <span>Detail</span>
                      </button>
                      <button
                        onClick={() => openEditModal(r)}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold transition inline-flex items-center space-x-1"
                        title="Edit Dokumen Penerimaan"
                      >
                        <Pencil className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => handleDelete(r)}
                        className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition inline-flex items-center"
                        title="Hapus Penerimaan"
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

      {/* Modal View Detail */}
      {viewingReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl my-8 overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-base">
                Rincian Penerimaan: {viewingReceipt.nomorDokumen}
              </h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => openEditModal(viewingReceipt)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center space-x-1 transition shadow"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Edit Data Ini</span>
                </button>
                <button onClick={() => setViewingReceipt(null)} className="text-slate-400 hover:text-slate-600 p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div><strong>Tanggal Penerimaan:</strong> {viewingReceipt.tanggal}</div>
                <div><strong>Penyedia / Vendor:</strong> {viewingReceipt.vendorNama || "-"}</div>
                <div><strong>Nomor Faktur:</strong> {viewingReceipt.noFaktur || "-"} ({viewingReceipt.tglFaktur || "-"})</div>
                <div><strong>Nomor Berita Acara:</strong> {viewingReceipt.noBa || "-"} ({viewingReceipt.tglBa || "-"})</div>
                <div className="col-span-2"><strong>Keterangan:</strong> {viewingReceipt.keterangan || "-"}</div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase mb-2">Item Barang Diterima</h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-600 font-semibold uppercase">
                      <tr>
                        <th className="p-3">Nama Barang</th>
                        <th className="p-3 text-right">Banyak</th>
                        <th className="p-3 text-right">Harga Satuan</th>
                        <th className="p-3 text-right">Jumlah Harga</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {viewingReceipt.items.map((it, idx) => (
                        <tr key={idx}>
                          <td className="p-3 font-medium text-slate-800">{it.itemNama}</td>
                          <td className="p-3 text-right font-bold">{it.jumlah}</td>
                          <td className="p-3 text-right font-mono">{formatRupiah(it.hargaSatuan)}</td>
                          <td className="p-3 text-right font-mono font-bold text-slate-900">{formatRupiah(it.jumlahHarga)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 font-bold">
                        <td colSpan={3} className="p-3 text-right text-slate-700">Total Nilai:</td>
                        <td className="p-3 text-right font-mono text-emerald-700 text-sm">
                          {formatRupiah(viewingReceipt.totalNilai)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setViewingReceipt(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Add / Edit Penerimaan */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl my-8 overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-base flex items-center space-x-2">
                <ArrowDownLeft className="w-5 h-5 text-emerald-600" />
                <span>{editingReceiptId ? `Edit Penerimaan Barang: ${formData.nomorDokumen}` : "Input Barang Masuk Baru"}</span>
              </h3>
              <button onClick={() => { setIsModalOpen(false); setEditingReceiptId(null); }} className="text-slate-400 hover:text-slate-600 p-1">
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
                  <button
                    type="button"
                    onClick={buangDraft}
                    className="font-semibold underline whitespace-nowrap"
                  >
                    Buang draft
                  </button>
                </div>
              )}
              {/* Meta Informasi Dokumen */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Tanggal Penerimaan *
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
                    Penyedia / Rekanan *
                  </label>
                  <select
                    value={formData.vendorId}
                    onChange={(e) => setFormData({ ...formData, vendorId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                  >
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.nama}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Nomor Dokumen
                  </label>
                  <input
                    type="text"
                    placeholder="Otomatis bila dikosongkan"
                    value={formData.nomorDokumen}
                    onChange={(e) => setFormData({ ...formData, nomorDokumen: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Nomor saran: <span className="font-mono">{nomorSaran || "-"}</span> — boleh diganti dengan nomor
                    dokumen asli.
                  </p>
                </div>
              </div>

              {/* Faktur & BA */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                    No. Faktur Pembelian
                  </label>
                  <input
                    type="text"
                    placeholder="003.2/400-3/104/2026"
                    value={formData.noFaktur}
                    onChange={(e) => setFormData({ ...formData, noFaktur: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                    Tgl Faktur
                  </label>
                  <input
                    type="date"
                    value={formData.tglFaktur}
                    onChange={(e) => setFormData({ ...formData, tglFaktur: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                    No. B.A. Penerimaan
                  </label>
                  <input
                    type="text"
                    placeholder="BA/01/BHP/2026"
                    value={formData.noBa}
                    onChange={(e) => setFormData({ ...formData, noBa: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                    Tgl B.A. Penerimaan
                  </label>
                  <input
                    type="date"
                    value={formData.tglBa}
                    onChange={(e) => setFormData({ ...formData, tglBa: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
              </div>

              {/* Multi-Row Items */}
              <div>
                {editingStale ? (
                  <div className="mb-3 p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-xs flex items-start space-x-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-600" />
                    <span>
                      <strong>Data stok dokumen ini tidak seimbang.</strong> Stoknya berkurang tanpa ada dokumen
                      BAST yang memotongnya (sisa dari cara kerja lama), sehingga rincian faktur ini terkunci padahal
                      tidak ada BAST yang perlu dibatalkan. Minta pengelola sistem menjalankan{" "}
                      <code className="font-mono">npm run db:repair-stock -- --apply</code> untuk memulihkan stok dari
                      jejak dokumen. Setelah itu dokumen ini bisa diedit seperti biasa.
                    </span>
                  </div>
                ) : (
                  editingLocked && (
                    <div className="mb-3 p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start space-x-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
                      <span>
                        Rincian barang <strong>tidak dapat diubah</strong> karena stok dokumen ini sudah pernah
                        dikeluarkan lewat BAST. Yang masih bisa diubah: nomor dokumen, nomor/tanggal faktur,
                        nomor/tanggal BA, dan keterangan. Untuk memperbaiki rincian, batalkan dulu BAST terkait.
                      </span>
                    </div>
                  )
                )}
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Daftar Barang yang Diterima
                  </label>
                  {!editingLocked && (
                    <button
                      type="button"
                      onClick={addRow}
                      className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold flex items-center space-x-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah Baris Barang</span>
                    </button>
                  )}
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-600 font-semibold uppercase">
                      <tr>
                        <th className="p-3 w-1/2">Nama Barang Persediaan</th>
                        <th className="p-3 w-28">Jumlah</th>
                        <th className="p-3 w-36">Harga Satuan (Rp)</th>
                        <th className="p-3 text-right">Subtotal</th>
                        <th className="p-3 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {formRows.map((row, idx) => (
                        <tr key={idx}>
                          <td className="p-2">
                            <ItemCombobox
                              items={items}
                              value={row.itemId}
                              onChange={(itemId) => handlePilihBarang(idx, itemId)}
                              disabled={editingLocked}
                              placeholder="Ketik nama / kode barang..."
                              className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-left text-xs hover:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100 disabled:text-slate-500"
                            />
                          </td>
                          <td className="p-2">
                            <NumberInput
                              mode="qty"
                              required
                              disabled={editingLocked}
                              value={row.jumlah}
                              onChange={(nilai) => handleRowChange(idx, { jumlah: nilai })}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs text-right disabled:bg-slate-100 disabled:text-slate-500"
                            />
                          </td>
                          <td className="p-2">
                            <NumberInput
                              required
                              disabled={editingLocked}
                              value={row.hargaSatuan}
                              placeholder="0"
                              onChange={(nilai) => handleRowChange(idx, { hargaSatuan: nilai })}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-mono text-right disabled:bg-slate-100 disabled:text-slate-500"
                            />
                            {!editingLocked && row.itemId && !row.hargaSatuan && (
                              <span className="text-[10px] text-amber-600">
                                belum ada harga beli — isi manual
                              </span>
                            )}
                          </td>
                          <td className="p-2 text-right font-mono font-semibold text-slate-800">
                            {formatRupiah((row.jumlah ?? 0) * (row.hargaSatuan ?? 0))}
                          </td>
                          <td className="p-2 text-center">
                            {!editingLocked && formRows.length > 1 && (
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
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 font-bold">
                        <td colSpan={3} className="p-3 text-right text-slate-700">
                          Total Nilai Belanja:
                        </td>
                        <td className="p-3 text-right font-mono text-emerald-700 text-sm">
                          {formatRupiah(totalBelanja)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Keterangan Tambahan
                </label>
                <input
                  type="text"
                  placeholder="Keterangan pengadaan / sumber dana"
                  value={formData.keterangan}
                  onChange={(e) => setFormData({ ...formData, keterangan: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => { setIsModalOpen(false); setEditingReceiptId(null); }}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition shadow flex items-center space-x-2"
                >
                  <Check className="w-4 h-4" />
                  <span>{saving ? "Menyimpan & Update Stok..." : (editingReceiptId ? "Simpan Perubahan" : "Simpan Penerimaan")}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
