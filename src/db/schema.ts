import { sqliteTable, text, integer, real, uniqueIndex } from "drizzle-orm/sqlite-core";

// 1. BIDANG DINAS (Multi-tenant dynamic units)
export const bidang = sqliteTable("bidang", {
  id: text("id").primaryKey(), // e.g. "sekretariat", "perumahan", "kawasan-permukiman", "pertanahan"
  nama: text("nama").notNull(),
  kode: text("kode").notNull().unique(), // e.g. "SEKR", "PRMH", "KWPM", "PTNH"
  deskripsi: text("deskripsi"),
  
  // Pejabat di bidang ini (untuk tanda tangan BAST & Laporan Bidang)
  namaAtasan: text("nama_atasan"),
  nipAtasan: text("nip_atasan"),
  jabatanAtasan: text("jabatan_atasan"),
  pangkatAtasan: text("pangkat_atasan"),

  namaPengurus: text("nama_pengurus"),
  nipPengurus: text("nip_pengurus"),
  jabatanPengurus: text("jabatan_pengurus"),
  pangkatPengurus: text("pangkat_pengurus"),

  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// 2. PENGGUNA (Users)
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  nama: text("nama").notNull(),
  passwordHash: text("password_hash").notNull(),
  salt: text("salt").notNull(),
  role: text("role").notNull(), // "SUPERADMIN" | "OPERATOR_BIDANG" | "KEPALA_BIDANG"
  bidangId: text("bidang_id").references(() => bidang.id), // NULL jika SUPERADMIN
  status: text("status").notNull().default("ACTIVE"), // "ACTIVE" | "INACTIVE"
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// 3. KATEGORI BARANG PER BIDANG
export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(),
  bidangId: text("bidang_id").notNull().references(() => bidang.id),
  nama: text("nama").notNull(),
  createdAt: integer("created_at").notNull(),
});

// 4. SATUAN BARANG
export const units = sqliteTable("units", {
  id: text("id").primaryKey(),
  nama: text("nama").notNull().unique(), // buah, pak, box, rim, rol, botol, dsb.
  createdAt: integer("created_at").notNull(),
});

// 5. MASTER BARANG (Isolasi per bidang - Opsi B)
export const items = sqliteTable("items", {
  id: text("id").primaryKey(),
  bidangId: text("bidang_id").notNull().references(() => bidang.id),
  kode: text("kode").notNull(), // e.g. BRG-0001
  nama: text("nama").notNull(),
  kategoriId: text("kategori_id").references(() => categories.id),
  satuanId: text("satuan_id").references(() => units.id),
  stokMinimum: real("stok_minimum").default(0),
  status: text("status").notNull().default("ACTIVE"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (t) => [
  // Satu kode barang hanya boleh dipakai sekali per unit kerja (kode tampil di dokumen resmi).
  uniqueIndex("items_bidang_kode_unique").on(t.bidangId, t.kode),
]);

// 6. REKANAN / VENDOR
export const vendors = sqliteTable("vendors", {
  id: text("id").primaryKey(),
  nama: text("nama").notNull(),
  npwp: text("npwp"), // NPWP penyedia (tercantum pada faktur e-Katalog)
  alamat: text("alamat"),
  telepon: text("telepon"),
  createdAt: integer("created_at").notNull(),
});

// 7. PENERIMAAN BARANG (Barang Masuk)
export const receipts = sqliteTable("receipts", {
  id: text("id").primaryKey(),
  bidangId: text("bidang_id").notNull().references(() => bidang.id),
  nomorDokumen: text("nomor_dokumen").notNull(), // ref internal penerimaan
  tanggal: text("tanggal").notNull(), // YYYY-MM-DD
  vendorId: text("vendor_id").references(() => vendors.id),
  vendorNama: text("vendor_nama"),
  noFaktur: text("no_faktur"),
  tglFaktur: text("tgl_faktur"),
  noBa: text("no_ba"), // Nomor Berita Acara Penerimaan/Pemeriksaan
  tglBa: text("tgl_ba"),
  keterangan: text("keterangan"),
  createdBy: text("created_by"),
  createdAt: integer("created_at").notNull(),
}, (t) => [
  // Nomor dokumen tidak boleh kembar di satu unit kerja.
  uniqueIndex("receipts_bidang_nomor_unique").on(t.bidangId, t.nomorDokumen),
]);

// 8. DETAIL PENERIMAAN
export const receiptItems = sqliteTable("receipt_items", {
  id: text("id").primaryKey(),
  receiptId: text("receipt_id").notNull().references(() => receipts.id),
  itemId: text("item_id").notNull().references(() => items.id),
  jumlah: real("jumlah").notNull(),
  hargaSatuan: real("harga_satuan").notNull(),
  jumlahHarga: real("jumlah_harga").notNull(),
});

// 9. PENGELUARAN BARANG / BAST (Barang Keluar)
export const issues = sqliteTable("issues", {
  id: text("id").primaryKey(),
  bidangId: text("bidang_id").notNull().references(() => bidang.id),
  // "BAST" = pengeluaran biasa, "PENYESUAIAN" = koreksi hasil stock opname
  jenis: text("jenis").notNull().default("BAST"),
  nomorDokumen: text("nomor_dokumen").notNull(), // e.g. BAST/01/KWPM/2026
  tanggal: text("tanggal").notNull(), // YYYY-MM-DD
  tglPenyerahan: text("tgl_penyerahan"),
  penerima: text("penerima").notNull(), // Nama orang / Seksi penerima
  keperluan: text("keperluan"),
  keterangan: text("keterangan"),
  
  // Tanda Tangan Khusus Dokumen BAST ini
  namaPenyerah: text("nama_penyerah"),
  nipPenyerah: text("nip_penyerah"),
  jabatanPenyerah: text("jabatan_penyerah"),
  namaPenerima: text("nama_penerima"),
  nipPenerima: text("nip_penerima"),
  jabatanPenerima: text("jabatan_penerima"),

  createdBy: text("created_by"),
  createdAt: integer("created_at").notNull(),
}, (t) => [
  // Nomor BAST tidak boleh kembar di satu unit kerja.
  uniqueIndex("issues_bidang_nomor_unique").on(t.bidangId, t.nomorDokumen),
]);

// 10. DETAIL PENGELUARAN
export const issueItems = sqliteTable("issue_items", {
  id: text("id").primaryKey(),
  issueId: text("issue_id").notNull().references(() => issues.id),
  itemId: text("item_id").notNull().references(() => items.id),
  jumlah: real("jumlah").notNull(),
  totalNilaiFifo: real("total_nilai_fifo").notNull().default(0),
});

// 11. FIFO LAYERS (Untuk tracking batch stok & harga perolehan)
export const fifoLayers = sqliteTable("fifo_layers", {
  id: text("id").primaryKey(),
  bidangId: text("bidang_id").notNull().references(() => bidang.id),
  itemId: text("item_id").notNull().references(() => items.id),
  receiptItemId: text("receipt_item_id").references(() => receiptItems.id),
  tanggal: text("tanggal").notNull(),
  hargaSatuan: real("harga_satuan").notNull(),
  jumlahAwal: real("jumlah_awal").notNull(),
  sisa: real("sisa").notNull(),
  status: text("status").notNull().default("ACTIVE"), // "ACTIVE" | "EXHAUSTED"
});

// 12. FIFO USAGES (Tracking layer mana yang terpotong saat pengeluaran)
export const fifoUsages = sqliteTable("fifo_usages", {
  id: text("id").primaryKey(),
  issueItemId: text("issue_item_id").notNull().references(() => issueItems.id),
  fifoLayerId: text("fifo_layer_id").notNull().references(() => fifoLayers.id),
  jumlah: real("jumlah").notNull(),
  hargaSatuan: real("harga_satuan").notNull(),
  nilai: real("nilai").notNull(),
});

// 13. PENGATURAN INSTANSI & KEPALA DINAS (Global settings)
export const agencySettings = sqliteTable("agency_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

// 14. LOG MANAJER / RIWAYAT AKTIVITAS (Audit log)
export const activityLogs = sqliteTable("activity_logs", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  userName: text("user_name").notNull(),
  userRole: text("user_role").notNull(),
  bidangId: text("bidang_id"),
  bidangNama: text("bidang_nama"),
  action: text("action").notNull(), // "LOGIN", "INPUT_MASUK", "INPUT_KELUAR", "TAMBAH_BARANG", "UBAH_BARANG", "HAPUS_BARANG"
  description: text("description").notNull(),
  metadata: text("metadata"), // JSON string
  createdAt: integer("created_at").notNull(),
});

// 15. SALDO AWAL PERSEDIAAN (titik awal pembukuan per barang & tanggal)
export const openingBalances = sqliteTable(
  "opening_balances",
  {
    id: text("id").primaryKey(),
    bidangId: text("bidang_id").notNull().references(() => bidang.id),
    itemId: text("item_id").notNull().references(() => items.id),
    tanggal: text("tanggal").notNull(), // tanggal berlakunya saldo awal (YYYY-MM-DD)
    jumlah: real("jumlah").notNull(),
    hargaSatuan: real("harga_satuan").notNull(),
    keterangan: text("keterangan"),
    fifoLayerId: text("fifo_layer_id"), // lapisan stok yang mewakili saldo awal ini
    createdBy: text("created_by"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("opening_balances_bidang_item_tanggal_unique").on(t.bidangId, t.itemId, t.tanggal),
  ]
);

// 16. STOCK OPNAME (hasil hitung fisik yang menjadi dasar penyesuaian)
export const stockAdjustments = sqliteTable(
  "stock_adjustments",
  {
    id: text("id").primaryKey(),
    bidangId: text("bidang_id").notNull().references(() => bidang.id),
    nomorDokumen: text("nomor_dokumen").notNull(),
    /** Nomor resmi Berita Acara yang diisi manual (mis. 602.21/12/423.109/2026). */
    nomorBa: text("nomor_ba"),
    /** Tanggal penandatanganan Berita Acara (boleh beda dari tanggal opname). */
    tanggalBa: text("tanggal_ba"),
    tanggal: text("tanggal").notNull(),
    keterangan: text("keterangan"),
    // Dokumen yang lahir dari penyesuaian opname (agar bisa dibatalkan bersama).
    issueId: text("issue_id"), // dokumen pengurangan (bila fisik < catatan)
    receiptId: text("receipt_id"), // dokumen penambahan (bila fisik > catatan)
    createdBy: text("created_by"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("stock_adjustments_bidang_nomor_unique").on(t.bidangId, t.nomorDokumen),
  ]
);

// 17. RINCIAN HASIL STOCK OPNAME (kolom 11-15 formulir resmi)
export const stockAdjustmentItems = sqliteTable("stock_adjustment_items", {
  id: text("id").primaryKey(),
  adjustmentId: text("adjustment_id").notNull().references(() => stockAdjustments.id),
  itemId: text("item_id").notNull().references(() => items.id),
  stokSistem: real("stok_sistem").notNull(),
  nilaiSistem: real("nilai_sistem").notNull(),
  hargaSatuanSistem: real("harga_satuan_sistem").notNull().default(0),
  jumlahFisik: real("jumlah_fisik").notNull(),
  nilaiFisik: real("nilai_fisik").notNull().default(0),
  selisihJumlah: real("selisih_jumlah").notNull(),
  selisihNilai: real("selisih_nilai").notNull().default(0),
  kondisi: text("kondisi"),
  keterangan: text("keterangan"),
});
