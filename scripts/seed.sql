-- SIPERSEDIA DPRKP - Initial Seed Data for Cloudflare D1

INSERT OR REPLACE INTO agency_settings (key, value) VALUES ('NAMA_INSTANSI', 'DINAS PERUMAHAN RAKYAT DAN KAWASAN PERMUKIMAN');
INSERT OR REPLACE INTO agency_settings (key, value) VALUES ('KAB_KOTA', 'KOTA PASURUAN');
INSERT OR REPLACE INTO agency_settings (key, value) VALUES ('PROVINSI', 'JAWA TIMUR');
INSERT OR REPLACE INTO agency_settings (key, value) VALUES ('TEMPAT_TTD', 'Pasuruan');
INSERT OR REPLACE INTO agency_settings (key, value) VALUES ('NAMA_KEPALA', 'Ir. H. Hari Apriyanto');
INSERT OR REPLACE INTO agency_settings (key, value) VALUES ('NIP_KEPALA', '19680415 199803 1 005');
INSERT OR REPLACE INTO agency_settings (key, value) VALUES ('JABATAN_KEPALA', 'Kepala Dinas Perumahan Rakyat dan Kawasan Permukiman');
INSERT OR REPLACE INTO agency_settings (key, value) VALUES ('PANGKAT_KEPALA', 'Pembina Utama Muda (IV/c)');
INSERT OR REPLACE INTO agency_settings (key, value) VALUES ('NAMA_PENGURUS', 'Ahmad Zainuri, S.AP');
INSERT OR REPLACE INTO agency_settings (key, value) VALUES ('NIP_PENGURUS', '19850612 201001 1 012');
INSERT OR REPLACE INTO agency_settings (key, value) VALUES ('JABATAN_PENGURUS', 'Pengurus Barang Pengguna');
INSERT OR REPLACE INTO agency_settings (key, value) VALUES ('PANGKAT_PENGURUS', 'Penata (III/c)');

INSERT OR REPLACE INTO bidang (id, nama, kode, deskripsi, nama_atasan, nip_atasan, jabatan_atasan, pangkat_atasan, nama_pengurus, nip_pengurus, jabatan_pengurus, pangkat_pengurus, created_at, updated_at) VALUES ('sekretariat', 'Sekretariat', 'SEKR', 'Sekretariat Dinas Perumahan Rakyat dan Kawasan Permukiman', 'Drs. Mohammad Najib, M.Si', '19720510 199303 1 004', 'Sekretaris Dinas', 'Pembina Tingkat I (IV/b)', 'Ahmad Zainuri, S.AP', '19850612 201001 1 012', 'Penyimpan / Pengurus Barang Pembantu', 'Penata (III/c)', 1792763456053, 1792763456053);
INSERT OR REPLACE INTO bidang (id, nama, kode, deskripsi, nama_atasan, nip_atasan, jabatan_atasan, pangkat_atasan, nama_pengurus, nip_pengurus, jabatan_pengurus, pangkat_pengurus, created_at, updated_at) VALUES ('perumahan', 'Bidang Perumahan', 'PRMH', 'Bidang Perumahan Rakyat', 'Budi Santoso, ST, MT', '19750820 200212 1 006', 'Kepala Bidang Perumahan', 'Pembina (IV/a)', 'Siti Rahmawati, A.Md', '19900315 201402 2 003', 'Pengurus Barang Bidang Perumahan', 'Pengatur Tingkat I (II/d)', 1792763456053, 1792763456053);
INSERT OR REPLACE INTO bidang (id, nama, kode, deskripsi, nama_atasan, nip_atasan, jabatan_atasan, pangkat_atasan, nama_pengurus, nip_pengurus, jabatan_pengurus, pangkat_pengurus, created_at, updated_at) VALUES ('permukiman', 'Bidang Kawasan Permukiman', 'PKP', 'Bidang Kawasan Permukiman', 'Ir. Agus Wijaya, MT', '19780312 200501 1 009', 'Kepala Bidang Kawasan Permukiman', 'Pembina (IV/a)', 'Eko Prasetyo', '19921104 201503 1 002', 'Pengurus Barang Bidang Permukiman', 'Pengatur (II/c)', 1792763456053, 1792763456053);
INSERT OR REPLACE INTO bidang (id, nama, kode, deskripsi, nama_atasan, nip_atasan, jabatan_atasan, pangkat_atasan, nama_pengurus, nip_pengurus, jabatan_pengurus, pangkat_pengurus, created_at, updated_at) VALUES ('pertanahan', 'Bidang Pertanahan', 'TNH', 'Bidang Pertanahan', 'Hendra Setiawan, SH, M.Hum', '19760925 200312 1 005', 'Kepala Bidang Pertanahan', 'Pembina (IV/a)', 'Rizal Firmansyah', '19940718 201903 1 008', 'Pengurus Barang Bidang Pertanahan', 'Pengatur (II/c)', 1792763456053, 1792763456053);

INSERT OR IGNORE INTO units (id, nama, created_at) VALUES ('unit-buah', 'buah', 1792763456053);
INSERT OR IGNORE INTO units (id, nama, created_at) VALUES ('unit-pak', 'pak', 1792763456053);
INSERT OR IGNORE INTO units (id, nama, created_at) VALUES ('unit-box', 'box', 1792763456053);
INSERT OR IGNORE INTO units (id, nama, created_at) VALUES ('unit-rim', 'rim', 1792763456053);
INSERT OR IGNORE INTO units (id, nama, created_at) VALUES ('unit-rol', 'rol', 1792763456053);
INSERT OR IGNORE INTO units (id, nama, created_at) VALUES ('unit-botol', 'botol', 1792763456053);
INSERT OR IGNORE INTO units (id, nama, created_at) VALUES ('unit-lembar', 'lembar', 1792763456053);
INSERT OR IGNORE INTO units (id, nama, created_at) VALUES ('unit-lusin', 'lusin', 1792763456053);
INSERT OR IGNORE INTO units (id, nama, created_at) VALUES ('unit-set', 'set', 1792763456053);
INSERT OR IGNORE INTO units (id, nama, created_at) VALUES ('unit-buku', 'buku', 1792763456053);
INSERT OR IGNORE INTO units (id, nama, created_at) VALUES ('unit-meter', 'meter', 1792763456053);
INSERT OR IGNORE INTO units (id, nama, created_at) VALUES ('unit-sak', 'sak', 1792763456053);

INSERT OR REPLACE INTO users (id, username, password_hash, salt, nama, role, bidang_id, status, created_at, updated_at) VALUES ('usr-superadmin', 'superadmin', '4b4593fd473e181970b9bac8cf0dd3683ab7b8b191c96a3a03b024c76c4f97c7', 'ec147f7fdc14858c3ab05e545ae07e99', 'Superadmin Pengurus Barang Dinas', 'SUPERADMIN', NULL, 'ACTIVE', 1792763456053, 1792763456053);
INSERT OR REPLACE INTO users (id, username, password_hash, salt, nama, role, bidang_id, status, created_at, updated_at) VALUES ('usr-sekretariat', 'operator.sekretariat', 'f1a46d5601d989a2802039bab03c9e6c36806a9edf3babec2841f2cff4e38baa', 'f1ce1b3c657a3d1d157dcf8931fcf3be', 'Operator BHP Sekretariat', 'OPERATOR_BIDANG', 'sekretariat', 'ACTIVE', 1792763456053, 1792763456053);
INSERT OR REPLACE INTO users (id, username, password_hash, salt, nama, role, bidang_id, status, created_at, updated_at) VALUES ('usr-perumahan', 'operator.perumahan', '8b692581a14d3f2622aae551085f4e64278336224fcb680f20fc733f9d3c09a2', '24d718f871c3f665eacfcd4e29c7eb3a', 'Operator BHP Bidang Perumahan', 'OPERATOR_BIDANG', 'perumahan', 'ACTIVE', 1792763456053, 1792763456053);
INSERT OR REPLACE INTO users (id, username, password_hash, salt, nama, role, bidang_id, status, created_at, updated_at) VALUES ('usr-permukiman', 'operator.permukiman', 'c997841aea384f5bbd617d9ec1ebde73d0764cc1d87eb6e50151bc5494a50c54', '0680dc6af5c0b79ac422d93448e94631', 'Operator BHP Bidang Permukiman', 'OPERATOR_BIDANG', 'permukiman', 'ACTIVE', 1792763456053, 1792763456053);
INSERT OR REPLACE INTO users (id, username, password_hash, salt, nama, role, bidang_id, status, created_at, updated_at) VALUES ('usr-pertanahan', 'operator.pertanahan', '605a0f162242102044da28659e4754d38fe29733463129b87cc40b389af7fd83', 'af06447935265b26613de085cceae7f1', 'Operator BHP Bidang Pertanahan', 'OPERATOR_BIDANG', 'pertanahan', 'ACTIVE', 1792763456053, 1792763456053);
