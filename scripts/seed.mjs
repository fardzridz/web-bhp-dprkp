import { createClient } from "@libsql/client";
import { generateSalt, hashPassword } from "../src/lib/auth-crypto.ts";

const client = createClient({
  url: process.env.DATABASE_URL || "file:local.sqlite",
});

const now = Date.now();

async function seed() {
  console.log("Seeding database...");

  // 1. Agency Settings
  const settings = [
    { key: "NAMA_INSTANSI", value: "DINAS PERUMAHAN RAKYAT DAN KAWASAN PERMUKIMAN" },
    { key: "KAB_KOTA", value: "KABUPATEN PASURUAN" },
    { key: "PROVINSI", value: "JAWA TIMUR" },
    { key: "TEMPAT_TTD", value: "Pasuruan" },
    { key: "NAMA_KEPALA", value: "Ir. H. Hari Apriyanto" },
    { key: "NIP_KEPALA", value: "19680415 199803 1 005" },
    { key: "JABATAN_KEPALA", value: "Kepala Dinas Perumahan Rakyat dan Kawasan Permukiman" },
    { key: "PANGKAT_KEPALA", value: "Pembina Utama Muda (IV/c)" },
  ];

  for (const s of settings) {
    await client.execute({
      sql: `INSERT OR REPLACE INTO agency_settings (key, value) VALUES (?, ?)`,
      args: [s.key, s.value],
    });
  }

  // 2. Bidang Dinas DPRKP
  const defaultBidang = [
    {
      id: "sekretariat",
      nama: "Sekretariat",
      kode: "SEKR",
      deskripsi: "Sekretariat Dinas Perumahan Rakyat dan Kawasan Permukiman",
      namaAtasan: "Drs. Mohammad Najib, M.Si",
      nipAtasan: "19720510 199303 1 004",
      jabatanAtasan: "Sekretaris Dinas",
      pangkatAtasan: "Pembina Tingkat I (IV/b)",
      namaPengurus: "Ahmad Zainuri, S.AP",
      nipPengurus: "19850612 201001 1 012",
      jabatanPengurus: "Penyimpan / Pengurus Barang Pembantu",
      pangkatPengurus: "Penata (III/c)",
    },
    {
      id: "perumahan",
      nama: "Bidang Perumahan",
      kode: "PRMH",
      deskripsi: "Bidang Perumahan Rakyat",
      namaAtasan: "Budi Santoso, ST, MT",
      nipAtasan: "19750820 200212 1 006",
      jabatanAtasan: "Kepala Bidang Perumahan",
      pangkatAtasan: "Pembina (IV/a)",
      namaPengurus: "Siti Rahmawati, A.Md",
      nipPengurus: "19900315 201402 2 003",
      jabatanPengurus: "Pengurus Barang Bidang Perumahan",
      pangkatPengurus: "Pengatur Tingkat I (II/d)",
    },
    {
      id: "kawasan-permukiman",
      nama: "Bidang Kawasan Permukiman",
      kode: "KWPM",
      deskripsi: "Bidang Kawasan Permukiman dan PSU",
      namaAtasan: "Ir. Hendro Wibowo",
      nipAtasan: "19710314 199703 1 005",
      jabatanAtasan: "Kepala Bidang Kawasan Permukiman",
      pangkatAtasan: "Pembina (IV/a)",
      namaPengurus: "Eko Prasetyo, S.T",
      nipPengurus: "19881122 201503 1 002",
      jabatanPengurus: "Pengurus Barang Bidang Kawasan Permukiman",
      pangkatPengurus: "Penata Muda (III/a)",
    },
    {
      id: "pertanahan",
      nama: "Bidang Pertanahan",
      kode: "PTNH",
      deskripsi: "Bidang Pertanahan dan Penataan Ruang",
      namaAtasan: "Dra. Sri Wahyuni, MM",
      nipAtasan: "19691204 199403 2 004",
      jabatanAtasan: "Kepala Bidang Pertanahan",
      pangkatAtasan: "Pembina (IV/a)",
      namaPengurus: "Rizal Firmansyah",
      nipPengurus: "19940718 201903 1 008",
      jabatanPengurus: "Pengurus Barang Bidang Pertanahan",
      pangkatPengurus: "Pengatur (II/c)",
    },
  ];

  for (const b of defaultBidang) {
    await client.execute({
      sql: `INSERT OR REPLACE INTO bidang (
        id, nama, kode, deskripsi, 
        nama_atasan, nip_atasan, jabatan_atasan, pangkat_atasan,
        nama_pengurus, nip_pengurus, jabatan_pengurus, pangkat_pengurus,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        b.id, b.nama, b.kode, b.deskripsi,
        b.namaAtasan, b.nipAtasan, b.jabatanAtasan, b.pangkatAtasan,
        b.namaPengurus, b.nipPengurus, b.jabatanPengurus, b.pangkatPengurus,
        now, now,
      ],
    });
  }

  // 3. Units
  const unitsList = ["buah", "pak", "box", "rim", "rol", "botol", "lembar", "lusin", "set", "buku", "meter"];
  for (const u of unitsList) {
    await client.execute({
      sql: `INSERT OR IGNORE INTO units (id, nama, created_at) VALUES (?, ?, ?)`,
      args: [`unit-${u}`, u, now],
    });
  }

  // 4. Default Users
  const userAccounts = [
    {
      id: "usr-superadmin",
      username: "superadmin",
      nama: "Superadmin Pengurus Barang Dinas",
      password: "admin123",
      role: "SUPERADMIN",
      bidangId: null,
    },
    {
      id: "usr-sekretariat",
      username: "operator.sekretariat",
      nama: "Operator BHP Sekretariat",
      password: "operator123",
      role: "OPERATOR_BIDANG",
      bidangId: "sekretariat",
    },
    {
      id: "usr-perumahan",
      username: "operator.perumahan",
      nama: "Operator BHP Perumahan",
      password: "operator123",
      role: "OPERATOR_BIDANG",
      bidangId: "perumahan",
    },
    {
      id: "usr-permukiman",
      username: "operator.permukiman",
      nama: "Operator BHP Kawasan Permukiman",
      password: "operator123",
      role: "OPERATOR_BIDANG",
      bidangId: "kawasan-permukiman",
    },
    {
      id: "usr-pertanahan",
      username: "operator.pertanahan",
      nama: "Operator BHP Pertanahan",
      password: "operator123",
      role: "OPERATOR_BIDANG",
      bidangId: "pertanahan",
    },
  ];

  for (const u of userAccounts) {
    const salt = generateSalt();
    const hash = await hashPassword(u.password, salt);
    await client.execute({
      sql: `INSERT OR REPLACE INTO users (
        id, username, nama, password_hash, salt, role, bidang_id, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`,
      args: [u.id, u.username, u.nama, hash, salt, u.role, u.bidangId, now, now],
    });
  }

  // 5. Sample Categories & Items for "sekretariat"
  const defaultCategories = [
    { id: "ktg-sekr-atk", bidangId: "sekretariat", nama: "Alat Tulis Kantor" },
    { id: "ktg-sekr-kertas", bidangId: "sekretariat", nama: "Kertas dan Cover" },
    { id: "ktg-sekr-cetak", bidangId: "sekretariat", nama: "Bahan Cetakan" },
    { id: "ktg-sekr-bersih", bidangId: "sekretariat", nama: "Bahan Pembersih" },
  ];

  for (const c of defaultCategories) {
    await client.execute({
      sql: `INSERT OR REPLACE INTO categories (id, bidang_id, nama, created_at) VALUES (?, ?, ?, ?)`,
      args: [c.id, c.bidangId, c.nama, now],
    });
  }

  // Sample items
  const sampleItems = [
    { id: "item-001", kode: "BRG-0001", nama: "Amplop putih 90", kategoriId: "ktg-sekr-atk", satuanId: "unit-box" },
    { id: "item-002", kode: "BRG-0002", nama: "Amplop putih 104", kategoriId: "ktg-sekr-atk", satuanId: "unit-box" },
    { id: "item-003", kode: "BRG-0003", nama: "Binderclips Joyko 260", kategoriId: "ktg-sekr-atk", satuanId: "unit-pak" },
    { id: "item-004", kode: "BRG-0004", nama: "Ballpoint Tezo", kategoriId: "ktg-sekr-atk", satuanId: "unit-pak" },
    { id: "item-005", kode: "BRG-0005", nama: "Stabillo Boss", kategoriId: "ktg-sekr-atk", satuanId: "unit-buah" },
    { id: "item-006", kode: "BRG-0006", nama: "Kertas HVS 70 gsm F4", kategoriId: "ktg-sekr-kertas", satuanId: "unit-rim" },
    { id: "item-007", kode: "BRG-0007", nama: "Kertas HVS 70 gsm A4", kategoriId: "ktg-sekr-kertas", satuanId: "unit-rim" },
    { id: "item-008", kode: "BRG-0008", nama: "Kertas NCR Top", kategoriId: "ktg-sekr-kertas", satuanId: "unit-rim" },
  ];

  for (const item of sampleItems) {
    await client.execute({
      sql: `INSERT OR REPLACE INTO items (
        id, bidang_id, kode, nama, kategori_id, satuan_id, stok_minimum, status, created_at, updated_at
      ) VALUES (?, 'sekretariat', ?, ?, ?, ?, 0, 'ACTIVE', ?, ?)`,
      args: [item.id, item.kode, item.nama, item.kategoriId, item.satuanId, now, now],
    });
  }

  // Sample Vendors
  const sampleVendors = [
    { id: "vnd-001", nama: 'CV "Centrojaya"', alamat: "Jl. Panglima Sudirman No. 45 Pasuruan", telepon: "0343-421111" },
    { id: "vnd-002", nama: "Toko Surya Mandiri", alamat: "Jl. Veteran No. 12 Pasuruan", telepon: "0343-423344" },
  ];

  for (const v of sampleVendors) {
    await client.execute({
      sql: `INSERT OR REPLACE INTO vendors (id, nama, alamat, telepon, created_at) VALUES (?, ?, ?, ?, ?)`,
      args: [v.id, v.nama, v.alamat, v.telepon, now],
    });
  }

  console.log("Seeding complete! Ready for authentication & features.");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
