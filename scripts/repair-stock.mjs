import { createClient } from "@libsql/client";

/**
 * Memulihkan sisa stok (fifo_layers.sisa) berdasarkan JEJAK PEMOTONGAN resmi
 * (fifo_usages). Dipakai bila ada lapisan stok yang berkurang tanpa dokumen
 * pengeluaran — mis. data dari versi lama yang memotong stok tanpa mencatat
 * rincian BAST, sehingga stok "hilang" dan dokumen penerimaan tetap terkunci.
 *
 * Rumus: sisa = jumlah_awal - jumlah pemotongan yang masih punya dokumen BAST.
 *
 * Jalankan tanpa argumen untuk melihat laporan saja:
 *   node scripts/repair-stock.mjs
 * Tambahkan --apply untuk menerapkan perbaikan:
 *   node scripts/repair-stock.mjs --apply
 */

const apply = process.argv.includes("--apply");

const client = createClient({
  url: process.env.DATABASE_URL || "file:local.sqlite",
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

async function main() {
  console.log(apply ? "=== PERBAIKAN STOK (diterapkan) ===" : "=== PERBAIKAN STOK (laporan saja) ===");

  const usages = await client.execute(`
    SELECT u.id, u.fifo_layer_id, u.jumlah, x.id AS issue_item_id
    FROM fifo_usages u
    LEFT JOIN issue_items x ON x.id = u.issue_item_id
  `);

  const usedByLayer = new Map();
  const orphanUsageIds = [];
  for (const row of usages.rows) {
    const layerId = String(row.fifo_layer_id);
    const jumlah = Number(row.jumlah) || 0;
    if (row.issue_item_id) {
      usedByLayer.set(layerId, (usedByLayer.get(layerId) || 0) + jumlah);
    } else {
      // Dokumen BAST-nya sudah dihapus, tetapi jejak pemotongannya tertinggal:
      // pemotongan ini tidak punya dasar dokumen lagi, jadi ikut dibalikkan.
      orphanUsageIds.push(String(row.id));
    }
  }

  const layers = await client.execute(`
    SELECT l.id, l.item_id, i.nama, l.jumlah_awal, l.sisa, l.status, r.nomor_dokumen
    FROM fifo_layers l
    LEFT JOIN items i ON i.id = l.item_id
    LEFT JOIN receipt_items ri ON ri.id = l.receipt_item_id
    LEFT JOIN receipts r ON r.id = ri.receipt_id
  `);

  const fixes = [];
  for (const layer of layers.rows) {
    const id = String(layer.id);
    const awal = Number(layer.jumlah_awal) || 0;
    const sisaTercatat = Number(layer.sisa) || 0;
    const dipakai = usedByLayer.get(id) || 0;
    const sisaBenar = Math.max(0, awal - dipakai);

    if (Math.abs(sisaBenar - sisaTercatat) > 1e-9) {
      fixes.push({
        id,
        nama: String(layer.nama || layer.item_id),
        dokumen: layer.nomor_dokumen ? String(layer.nomor_dokumen) : "-",
        awal,
        sisaTercatat,
        dipakai,
        sisaBenar,
        status: sisaBenar <= 0 ? "EXHAUSTED" : "ACTIVE",
      });
    }
  }

  if (fixes.length === 0 && orphanUsageIds.length === 0) {
    console.log("\nTidak ada ketidakcocokan stok. Semua lapisan sudah sesuai jejak dokumen.");
    return;
  }

  if (fixes.length > 0) {
    console.log(`\n${fixes.length} lapisan stok perlu diperbaiki:`);
    for (const f of fixes) {
      console.log(
        `- ${f.nama} (${f.dokumen}) : ${f.sisaTercatat} -> ${f.sisaBenar}` +
          `  [awal ${f.awal}, dipotong berjejak ${f.dipakai}]`
      );
    }
  }

  if (orphanUsageIds.length > 0) {
    console.log(
      `\n${orphanUsageIds.length} jejak pemotongan tanpa dokumen BAST akan dihapus (dokumennya sudah tidak ada).`
    );
  }

  if (!apply) {
    console.log("\nLaporan saja. Jalankan dengan --apply untuk menerapkan:");
    console.log("  node scripts/repair-stock.mjs --apply");
    return;
  }

  for (const f of fixes) {
    await client.execute({
      sql: "UPDATE fifo_layers SET sisa = ?, status = ? WHERE id = ?",
      args: [f.sisaBenar, f.status, f.id],
    });
  }

  if (orphanUsageIds.length > 0) {
    for (const id of orphanUsageIds) {
      await client.execute({ sql: "DELETE FROM fifo_usages WHERE id = ?", args: [id] });
    }
  }

  await client.execute({
    sql: `INSERT INTO activity_logs
            (id, user_id, user_name, user_role, bidang_id, bidang_nama, action, description, metadata, created_at)
          VALUES (?, NULL, ?, ?, NULL, NULL, ?, ?, ?, ?)`,
    args: [
      `log-repair-${Date.now().toString(36)}`,
      "Sistem (perbaikan stok)",
      "SYSTEM",
      "PERBAIKAN_STOK",
      `Memulihkan sisa stok ${fixes.length} lapisan dari jejak pemotongan; ${orphanUsageIds.length} jejak tanpa dokumen dihapus.`,
      JSON.stringify({ layersFixed: fixes.length, orphanUsages: orphanUsageIds.length }),
      Date.now(),
    ],
  });

  console.log(`\nSelesai. ${fixes.length} lapisan diperbaiki, ${orphanUsageIds.length} jejak orphan dihapus.`);
  console.log("Catatan perbaikan tersimpan di Log Manajer.");
}

main().catch((err) => {
  console.error("Perbaikan gagal:", err);
  process.exit(1);
});
