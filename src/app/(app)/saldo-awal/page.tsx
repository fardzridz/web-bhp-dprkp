"use client";

import { useState, useEffect, useMemo } from "react";
import NumberInput from "@/components/NumberInput";
import { formatAngka, formatRupiah, parseAngkaID } from "@/lib/format";
import { Scale, Upload, Trash2, RefreshCw, AlertCircle, Check, Info, Pencil, X } from "lucide-react";

interface OpeningRow {
  id: string;
  itemId: string;
  tanggal: string;
  jumlah: number;
  hargaSatuan: number;
  nilai: number;
  keterangan: string | null;
  kode: string;
  nama: string;
  satuan: string;
  kategori: string;
}

interface ParsedRow {
  nama: string;
  satuan: string;
  jumlah: number;
  hargaSatuan: number;
  nilai: number;
}

/**
 * Membaca tempelan dari Excel. Kolom yang diterima (dipisah TAB):
 *   Nama | Satuan | Jumlah | Harga Satuan [| Nilai]
 * Kolom "No" di depan diabaikan otomatis, dan bila Harga Satuan kosong
 * sedangkan Nilai terisi, harga dihitung dari Nilai / Jumlah.
 */
function parsePastedRows(text: string): { rows: ParsedRow[]; skipped: number } {
  const rows: ParsedRow[] = [];
  let skipped = 0;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    let cols = line.split("\t").map((c) => c.trim());
    if (cols.length === 1) cols = line.split(";").map((c) => c.trim());

    // Buang kolom "No" di depan (bersifat angka) bila masih ada kolom nama.
    if (cols.length >= 4 && /^\d+$/.test(cols[0])) cols = cols.slice(1);
    if (cols.length < 2) {
      skipped++;
      continue;
    }

    const nama = cols[0];
    if (!nama || /^(no|nama|rincian)/i.test(nama)) {
      skipped++;
      continue;
    }

    const kolom1Angka = parseAngkaID(cols[1]) !== null;
    const satuan = kolom1Angka ? "" : cols[1];
    const angka = cols
      .slice(kolom1Angka ? 1 : 2)
      .map((kolom) => parseAngkaID(kolom))
      .filter((n): n is number => n !== null);

    let jumlah = NaN;
    let hargaSatuan = NaN;
    let nilai = NaN;

    if (kolom1Angka) {
      // Format tanpa kolom satuan: Nama | Jumlah | Harga [| Nilai]
      jumlah = parseAngkaID(cols[1]) ?? NaN;
      hargaSatuan = parseAngkaID(cols[2]) ?? NaN;
      nilai = parseAngkaID(cols[3]) ?? NaN;
    } else if (angka.length >= 1) {
      jumlah = angka[0];
      hargaSatuan = angka.length >= 2 ? angka[1] : NaN;
      nilai = angka.length >= 3 ? angka[2] : NaN;
    }

    if (!Number.isFinite(jumlah) || jumlah <= 0) {
      skipped++;
      continue;
    }
    if (!Number.isFinite(hargaSatuan) || hargaSatuan <= 0) {
      if (Number.isFinite(nilai) && nilai > 0) hargaSatuan = nilai / jumlah;
      else {
        skipped++;
        continue;
      }
    }
    if (!Number.isFinite(nilai) || nilai <= 0) nilai = jumlah * hargaSatuan;

    rows.push({ nama, satuan, jumlah, hargaSatuan, nilai });
  }

  return { rows, skipped };
}

export default function SaldoAwalPage() {
  const [data, setData] = useState<OpeningRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [tanggal, setTanggal] = useState("2026-01-02");
  const [keterangan, setKeterangan] = useState("Saldo awal persediaan");
  const [pasteText, setPasteText] = useState("");

  const [editing, setEditing] = useState<OpeningRow | null>(null);
  const [editForm, setEditForm] = useState<{
    jumlah: number | null;
    hargaSatuan: number | null;
    tanggal: string;
    keterangan: string;
  }>({ jumlah: null, hargaSatuan: null, tanggal: "", keterangan: "" });

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/opening-balances");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setData(json.data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal memuat saldo awal");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const parsed = useMemo(() => parsePastedRows(pasteText), [pasteText]);
  const parsedTotal = parsed.rows.reduce((s, r) => s + r.nilai, 0);

  const grouped = useMemo(() => {
    const byDate = new Map<string, { total: number; nilai: number; count: number }>();
    for (const row of data) {
      const entry = byDate.get(row.tanggal);
      if (entry) {
        entry.total += row.jumlah;
        entry.nilai += row.nilai;
        entry.count += 1;
      } else {
        byDate.set(row.tanggal, { total: row.jumlah, nilai: row.nilai, count: 1 });
      }
    }
    return [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [data]);

  const handleSubmit = async () => {
    if (parsed.rows.length === 0) {
      setError("Belum ada data yang bisa dibaca. Tempel dulu data dari Excel.");
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch("/api/opening-balances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tanggal, keterangan, rows: parsed.rows }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      const parts = [`${json.created} baris saldo awal disimpan`];
      if (json.itemsCreated) parts.push(`${json.itemsCreated} barang baru dibuat di master`);
      if (json.skipped) parts.push(`${json.skipped} dilewati karena saldo awalnya sudah ada pada tanggal itu`);
      if (json.invalid) parts.push(`${json.invalid} baris tidak sah`);
      setNotice(`${parts.join(", ")}. Total nilai ${formatRupiah(json.totalNilai)}.`);
      setPasteText("");
      fetchData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan saldo awal");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: OpeningRow) => {
    if (!confirm(`Hapus saldo awal "${row.nama}" (${row.tanggal})?`)) return;
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/opening-balances?id=${row.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setNotice(`Saldo awal "${row.nama}" dihapus.`);
      fetchData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal menghapus saldo awal");
    }
  };

  const openEdit = (row: OpeningRow) => {
    setEditing(row);
    setEditForm({
      jumlah: row.jumlah,
      hargaSatuan: row.hargaSatuan,
      tanggal: row.tanggal,
      keterangan: row.keterangan || "",
    });
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;

    if (editForm.jumlah === null || editForm.jumlah <= 0) {
      setError("Jumlah saldo awal harus lebih dari 0.");
      return;
    }
    if (editForm.hargaSatuan === null || editForm.hargaSatuan <= 0) {
      setError("Harga satuan saldo awal harus lebih dari 0.");
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/opening-balances", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editing.id, ...editForm }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setNotice("Saldo awal diperbarui.");
      setEditing(null);
      fetchData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal memperbarui saldo awal");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center space-x-2.5">
          <Scale className="w-6 h-6 text-emerald-600" />
          <span>Saldo Awal Persediaan</span>
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Stok dan nilai barang yang <strong>sudah ada di gudang</strong> pada tanggal mulai pembukuan. Angka ini
          menjadi kolom &quot;Saldo Awal&quot; pada Laporan Mutasi, Lampiran 15, dan Berita Acara Stock Opname.
        </p>
      </div>

      <div className="p-4 rounded-xl bg-sky-50 border border-sky-200 text-sky-900 text-xs flex items-start space-x-2">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-sky-600" />
        <span>
          Saldo awal <strong>tidak sama</strong> dengan pembelian. Kalau barang sudah ada sebelum aplikasi ini dipakai,
          masukkan di sini sekali saja (mis. per 2 Januari 2026) — jangan dibuat sebagai transaksi penerimaan karena
          akan dianggap pembelian baru dan masuk ke Buku Penerimaan.
        </span>
      </div>

      {notice && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">{notice}</div>
      )}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start space-x-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Form tempel dari Excel */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide flex items-center space-x-2">
          <Upload className="w-4 h-4 text-emerald-600" />
          <span>Impor dari Excel (tempel data)</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Berlaku per tanggal *</label>
            <input
              type="date"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Keterangan</label>
            <input
              type="text"
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
            Data dari Excel (Nama | Satuan | Jumlah | Harga Satuan)
          </label>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={8}
            placeholder={
              "Amplop putih 90\tbox\t2\t27750\nAmplop putih 104\tbox\t9\t21800\nBinderclips Joyko 260\tpak\t7\t22755"
            }
            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
          />
          <p className="text-[11px] text-slate-500 mt-1">
            Cara: blok sel di Excel → Ctrl+C → tempel di sini. Kolom &quot;No&quot; di depan diabaikan otomatis. Kalau
            kolom Harga Satuan kosong tetapi kolom Nilai terisi, harga dihitung dari Nilai ÷ Jumlah. Barang yang belum
            ada di master akan dibuat otomatis.
          </p>
        </div>

        {parsed.rows.length > 0 && (
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 flex items-center justify-between">
              <span>
                Pratinjau: {parsed.rows.length} baris terbaca
                {parsed.skipped > 0 ? `, ${parsed.skipped} baris tidak terbaca` : ""}
              </span>
              <span className="font-mono">Total nilai {formatRupiah(parsedTotal)}</span>
            </div>
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-white text-slate-500 font-semibold uppercase sticky top-0">
                  <tr>
                    <th className="p-2">Nama Barang</th>
                    <th className="p-2">Satuan</th>
                    <th className="p-2 text-right">Jumlah</th>
                    <th className="p-2 text-right">Harga Satuan</th>
                    <th className="p-2 text-right">Nilai</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsed.rows.map((r, idx) => (
                    <tr key={`${r.nama}-${idx}`}>
                      <td className="p-2 font-medium text-slate-800">{r.nama}</td>
                      <td className="p-2 text-slate-600">{r.satuan || "-"}</td>
                      <td className="p-2 text-right">{formatAngka(r.jumlah)}</td>
                      <td className="p-2 text-right font-mono">{formatRupiah(r.hargaSatuan)}</td>
                      <td className="p-2 text-right font-mono">{formatRupiah(r.nilai)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={fetchData}
            className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-medium flex items-center space-x-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Muat ulang</span>
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || parsed.rows.length === 0}
            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition shadow flex items-center space-x-2 disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            <span>{saving ? "Menyimpan..." : "Simpan Saldo Awal"}</span>
          </button>
        </div>
      </div>

      {/* Ringkasan per tanggal */}
      {grouped.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {grouped.map(([tgl, info]) => (
            <div key={tgl} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <div className="text-xs text-slate-500 uppercase font-semibold">Saldo per {tgl}</div>
              <div className="text-lg font-bold text-slate-800 mt-1">{formatRupiah(info.nilai)}</div>
              <div className="text-xs text-slate-500 mt-0.5">
                {info.count} jenis barang • {formatAngka(info.total)} satuan
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Daftar baris */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Rincian Saldo Awal</h2>
          <span className="text-xs text-slate-500">
            {data.length} baris • total {formatRupiah(data.reduce((s, r) => s + r.nilai, 0))}
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Memuat saldo awal...</div>
        ) : data.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            Belum ada saldo awal. Tempel data dari Excel di atas untuk memulai.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">Tanggal</th>
                  <th className="px-6 py-3">Kode</th>
                  <th className="px-6 py-3">Nama Barang</th>
                  <th className="px-6 py-3">Satuan</th>
                  <th className="px-6 py-3 text-right">Jumlah</th>
                  <th className="px-6 py-3 text-right">Harga Satuan</th>
                  <th className="px-6 py-3 text-right">Nilai</th>
                  <th className="px-6 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/70">
                    <td className="px-6 py-3 text-xs text-slate-600">{row.tanggal}</td>
                    <td className="px-6 py-3 font-mono text-xs text-slate-500">{row.kode}</td>
                    <td className="px-6 py-3 font-medium text-slate-800">{row.nama}</td>
                    <td className="px-6 py-3 text-xs text-slate-600">{row.satuan}</td>
                    <td className="px-6 py-3 text-right">{formatAngka(row.jumlah)}</td>
                    <td className="px-6 py-3 text-right font-mono text-xs">{formatRupiah(row.hargaSatuan)}</td>
                    <td className="px-6 py-3 text-right font-mono">{formatRupiah(row.nilai)}</td>
                    <td className="px-6 py-3 text-right whitespace-nowrap space-x-1.5">
                      <button
                        onClick={() => openEdit(row)}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold inline-flex items-center space-x-1"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => handleDelete(row)}
                        className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 inline-flex items-center"
                        title="Hapus saldo awal"
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

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md my-8 overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-base">Edit Saldo Awal</h3>
              <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-600 p-1" type="button">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEditSave} className="p-6 space-y-4">
              <div className="text-xs text-slate-500">
                {editing.kode} — <span className="font-medium text-slate-700">{editing.nama}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Jumlah</label>
                  <NumberInput
                    mode="qty"
                    required
                    value={editForm.jumlah}
                    onChange={(nilai) => setEditForm({ ...editForm, jumlah: nilai })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm text-right"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Harga Satuan</label>
                  <NumberInput
                    required
                    value={editForm.hargaSatuan}
                    onChange={(nilai) => setEditForm({ ...editForm, hargaSatuan: nilai })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono text-right"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Tanggal berlaku</label>
                <input
                  type="date"
                  value={editForm.tanggal}
                  onChange={(e) => setEditForm({ ...editForm, tanggal: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Keterangan</label>
                <input
                  type="text"
                  value={editForm.keterangan}
                  onChange={(e) => setEditForm({ ...editForm, keterangan: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Saldo awal hanya bisa diubah/dihapus selama stoknya belum dipakai transaksi.
              </p>
              <div className="pt-2 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition shadow disabled:opacity-60"
                >
                  {saving ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
