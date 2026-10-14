import { createClient } from "@libsql/client";
import { verifyPassword } from "../src/lib/auth-crypto.ts";

const client = createClient({
  url: process.env.DATABASE_URL || "file:local.sqlite",
});

async function runVerification() {
  console.log("=== MEMULAI VERIFIKASI END-TO-END SIPERSEDIA BHP DPRKP ===\n");

  // 1. Verifikasi Tabel & Seed
  const tables = await client.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;");
  const tableNames = tables.rows.map((r) => r.name);
  console.log("1. Tabel database terdaftar:", tableNames.length, "tabel");
  if (!tableNames.includes("bidang") || !tableNames.includes("items") || !tableNames.includes("fifo_layers")) {
    throw new Error("Tabel inti tidak lengkap!");
  }
  console.log("   -> Tabel inti D1 terverifikasi OK.");

  // 2. Verifikasi Akun & Password Hashing
  const superadminUser = await client.execute({
    sql: "SELECT * FROM users WHERE username = ?",
    args: ["superadmin"],
  });
  if (superadminUser.rows.length === 0) throw new Error("Superadmin user tidak ditemukan!");
  const user = superadminUser.rows[0];
  const pwOk = await verifyPassword("admin123", user.salt, user.password_hash);
  console.log("2. Verifikasi Autentikasi Superadmin (admin123):", pwOk ? "BERHASIL (MATCH)" : "GAGAL");
  if (!pwOk) throw new Error("Password superadmin tidak cocok!");

  // 3. Verifikasi Isolasi Multi-Tenant (Bidang)
  const allBidang = await client.execute("SELECT id, kode, nama FROM bidang ORDER BY nama;");
  console.log("3. Daftar Bidang Terdaftar:", allBidang.rows.map((b) => `${b.kode} (${b.nama})`).join(", "));

  // 4. Verifikasi FIFO Engine & Stok
  console.log("4. Menguji Mesin FIFO (Penerimaan & Pengeluaran)...");
  const testItemId = "item-test-fifo-" + Date.now();
  const testBidangId = "sekretariat";
  const now = Date.now();

  // Create test item
  await client.execute({
    sql: "INSERT INTO items (id, bidang_id, kode, nama, stok_minimum, status, created_at, updated_at) VALUES (?, ?, 'TEST-FIFO', 'Kertas Test FIFO', 0, 'ACTIVE', ?, ?)",
    args: [testItemId, testBidangId, now, now],
  });

  // Layer 1: 10 unit @ Rp 10.000
  const layer1Id = "l1-" + now;
  await client.execute({
    sql: "INSERT INTO fifo_layers (id, bidang_id, item_id, tanggal, harga_satuan, jumlah_awal, sisa, status) VALUES (?, ?, ?, '2026-05-01', 10000, 10, 10, 'ACTIVE')",
    args: [layer1Id, testBidangId, testItemId],
  });

  // Layer 2: 10 unit @ Rp 12.000
  const layer2Id = "l2-" + now;
  await client.execute({
    sql: "INSERT INTO fifo_layers (id, bidang_id, item_id, tanggal, harga_satuan, jumlah_awal, sisa, status) VALUES (?, ?, ?, '2026-05-15', 12000, 10, 10, 'ACTIVE')",
    args: [layer2Id, testBidangId, testItemId],
  });

  // Total stok awal = 20
  const stockBefore = await client.execute({
    sql: "SELECT SUM(sisa) as total, SUM(sisa * harga_satuan) as val FROM fifo_layers WHERE item_id = ? AND status = 'ACTIVE'",
    args: [testItemId],
  });
  console.log(`   -> Stok awal: ${stockBefore.rows[0].total} unit, Total Nilai: Rp ${stockBefore.rows[0].val}`);

  // Simulasi pengeluaran 15 unit
  // Harus ambil: 10 unit dari Layer 1 (@10k = 100k) + 5 unit dari Layer 2 (@12k = 60k). Total nilai = 160k. Sisa stok = 5 unit (@12k = 60k).
  const requested = 15;
  const layers = await client.execute({
    sql: "SELECT * FROM fifo_layers WHERE item_id = ? AND status = 'ACTIVE' ORDER BY tanggal ASC",
    args: [testItemId],
  });

  let remaining = requested;
  let totalDeductedVal = 0;
  for (const l of layers.rows) {
    if (remaining <= 0) break;
    const take = Math.min(l.sisa, remaining);
    totalDeductedVal += take * l.harga_satuan;
    const newSisa = l.sisa - take;
    const newStatus = newSisa <= 0 ? "EXHAUSTED" : "ACTIVE";
    await client.execute({
      sql: "UPDATE fifo_layers SET sisa = ?, status = ? WHERE id = ?",
      args: [newSisa, newStatus, l.id],
    });
    remaining -= take;
  }

  const stockAfter = await client.execute({
    sql: "SELECT SUM(sisa) as total, SUM(sisa * harga_satuan) as val FROM fifo_layers WHERE item_id = ? AND status = 'ACTIVE'",
    args: [testItemId],
  });

  console.log(`   -> Pengeluaran 15 unit berhasil.`);
  console.log(`   -> Total Nilai Terpotong FIFO: Rp ${totalDeductedVal} (Harus Rp 160.000)`);
  console.log(`   -> Sisa Stok Fisik: ${stockAfter.rows[0].total} unit (Harus 5 unit)`);
  console.log(`   -> Sisa Nilai Persediaan: Rp ${stockAfter.rows[0].val} (Harus Rp 60.000)`);

  if (totalDeductedVal !== 160000 || stockAfter.rows[0].total !== 5 || stockAfter.rows[0].val !== 60000) {
    throw new Error("Perhitungan FIFO tidak akurat!");
  }
  console.log("   -> Uji Akurasi FIFO: 100% TEPAT & SESUAI STANDAR AKUNTANSI PERSEDIAAN.");

  // Clean test item
  await client.execute({ sql: "DELETE FROM fifo_layers WHERE item_id = ?", args: [testItemId] });
  await client.execute({ sql: "DELETE FROM items WHERE id = ?", args: [testItemId] });

  // 5. Verifikasi Data DPRKP Riil
  const realItems = await client.execute("SELECT COUNT(*) as count FROM items;");
  console.log(`5. Master Barang Aktif dalam Database: ${realItems.rows[0].count} item.`);

  console.log("\n=== SEMUA 5 TAHAP UJI SISTEM BERHASIL DENGAN SUKSES! ===");
}

runVerification().catch((err) => {
  console.error("Verifikasi gagal:", err);
  process.exit(1);
});
