-- P3: cetak resmi — nomor Berita Acara manual + data pejabat tingkat dinas & daftar unit kerja.
ALTER TABLE stock_adjustments ADD COLUMN nomor_ba TEXT;
--> statement-breakpoint
INSERT OR IGNORE INTO agency_settings ("key", "value") VALUES ('UNIT_KERJA', 'Sekretariat|Bidang Permukiman|Bidang Perumahan|UPT Pemakaman|UPT Rusunawa');
--> statement-breakpoint
INSERT OR REPLACE INTO agency_settings ("key", "value") VALUES ('NAMA_KEPALA', 'AKUNG NOVAJANTO SODIQ NUCH, ST.MT');
--> statement-breakpoint
INSERT OR REPLACE INTO agency_settings ("key", "value") VALUES ('NIP_KEPALA', '197211252003121006');
--> statement-breakpoint
INSERT OR REPLACE INTO agency_settings ("key", "value") VALUES ('JABATAN_KEPALA', 'Kepala Dinas Perumahan Rakyat dan Kawasan Permukiman');
--> statement-breakpoint
INSERT OR REPLACE INTO agency_settings ("key", "value") VALUES ('NAMA_PENGURUS', 'ADE CANDRA WAHYU DERMAWAN A.md');
--> statement-breakpoint
INSERT OR REPLACE INTO agency_settings ("key", "value") VALUES ('NIP_PENGURUS', '199606132020121008');
--> statement-breakpoint
INSERT OR REPLACE INTO agency_settings ("key", "value") VALUES ('JABATAN_PENGURUS', 'Pengurus Barang Pengguna');
--> statement-breakpoint
INSERT OR REPLACE INTO agency_settings ("key", "value") VALUES ('PANGKAT_PENGURUS', 'Pengatur TK I (IId)');
--> statement-breakpoint
INSERT OR IGNORE INTO agency_settings ("key", "value") VALUES ('NAMA_PENATAUSAHAAN', 'IIL ROSIAWATI, ST');
--> statement-breakpoint
INSERT OR IGNORE INTO agency_settings ("key", "value") VALUES ('NIP_PENATAUSAHAAN', '1979052020010012024');
--> statement-breakpoint
INSERT OR IGNORE INTO agency_settings ("key", "value") VALUES ('JABATAN_PENATAUSAHAAN', 'Pejabat Penatausahaan Barang Pengguna');
--> statement-breakpoint
INSERT OR IGNORE INTO agency_settings ("key", "value") VALUES ('PANGKAT_PENATAUSAHAAN', '');
--> statement-breakpoint
INSERT OR IGNORE INTO agency_settings ("key", "value") VALUES ('NAMA_PEMBANTU', 'MUSTOFA');
--> statement-breakpoint
INSERT OR IGNORE INTO agency_settings ("key", "value") VALUES ('NIP_PEMBANTU', '197206082007011020');
--> statement-breakpoint
INSERT OR IGNORE INTO agency_settings ("key", "value") VALUES ('JABATAN_PEMBANTU', 'Pembantu Pengurus Barang Pengguna');
--> statement-breakpoint
INSERT OR IGNORE INTO agency_settings ("key", "value") VALUES ('PANGKAT_PEMBANTU', '');
