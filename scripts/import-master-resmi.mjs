import { createClient } from "@libsql/client";
import fs from "node:fs";

/**
 * Impor master barang resmi mitra dari file-appscript/MasterData.gs
 * (hasil ekstraksi Excel mereka: 408 barang, 19 kategori, 21 vendor).
 *
 * Yang dikerjakan:
 *   1. satuan yang belum ada dibuat (tabel `units` bersifat global);
 *   2. kategori dibuat per unit kerja dengan nama persis seperti master resmi;
 *   3. barang dicocokkan berdasarkan nama (tanpa peduli huruf besar/kecil &
 *      spasi). Bila sudah ada, kategori/satuannya diperbaiki; bila belum,
 *      barang baru dibuat dengan kode `<KODE-BIDANG>-0001` berurutan;
 *   4. vendor dibuat bila namanya belum ada.
 *
 * Aman dijalankan berulang. Pemakaian:
 *   node scripts/import-master-resmi.mjs                      (unit sekretariat)
 *   node scripts/import-master-resmi.mjs --bidang=perumahan
 *   DATABASE_URL=<d1-url> node scripts/import-master-resmi.mjs
 */

const argBidang = (process.argv.find((a) => a.startsWith("--bidang=")) || "").split("=")[1] || "sekretariat";

const client = createClient({
  url: process.env.DATABASE_URL || "file:local.sqlite",
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

const normalkan = (teks) =>
  (teks || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const pad = (n) => String(n).padStart(4, "0");

function bacaMaster() {
  const isi = fs.readFileSync("file-appscript/MasterData.gs", "utf-8");
  const cocok = /const EXCEL_MASTER_DATA = Object\.freeze\((\{[\s\S]*?\})\);/.exec(isi);
  if (!cocok) throw new Error("EXCEL_MASTER_DATA tidak ditemukan di MasterData.gs");
  return JSON.parse(cocok[1]);
}

async function impor() {
  const { items: barangResmi, vendors: vendorResmi } = bacaMaster();
  const now = Date.now();

  const bidangRows = await client.execute({
    sql: "SELECT id, kode, nama FROM bidang WHERE id = ? OR lower(kode) = ? OR lower(nama) = ?",
    args: [argBidang, argBidang.toLowerCase(), argBidang.toLowerCase()],
  });
  if (bidangRows.rows.length === 0) {
    throw new Error(`Unit kerja "${argBidang}" tidak ditemukan. Pilihan: lihat menu Kelola Unit Kerja.`);
  }
  const bidang = bidangRows.rows[0];
  const bidangId = String(bidang.id);
  const prefix = `${String(bidang.kode || "BHP").toUpperCase().replace(/[^A-Z0-9]/g, "") || "BHP"}-`;

  console.log(`Impor master resmi ke unit: ${bidang.nama} (${bidangId}), kode barang ${prefix}####`);

  // 1. Satuan
  const satuanAda = new Map();
  for (const row of (await client.execute("SELECT id, nama FROM units")).rows) {
    satuanAda.set(normalkan(String(row.nama)), String(row.id));
  }
  let satuanBaru = 0;
  for (const [, satuan] of barangResmi) {
    const kunci = normalkan(satuan);
    if (satuanAda.has(kunci)) continue;
    const id = `unit-${kunci || "lain"}-${now.toString(36)}-${satuanBaru}`;
    await client.execute({
      sql: "INSERT INTO units (id, nama, created_at) VALUES (?, ?, ?)",
      args: [id, satuan, now],
    });
    satuanAda.set(kunci, id);
    satuanBaru++;
  }

  // 2. Kategori
  const kategoriAda = new Map();
  for (const row of (
    await client.execute({
      sql: "SELECT id, nama FROM categories WHERE bidang_id = ?",
      args: [bidangId],
    })
  ).rows) {
    kategoriAda.set(normalkan(String(row.nama)), String(row.id));
  }
  let kategoriBaru = 0;
  for (const [, , kategori] of barangResmi) {
    const kunci = normalkan(kategori);
    if (kategoriAda.has(kunci)) continue;
    const id = `ktg-${kunci.slice(0, 12) || "lain"}-${kategoriBaru}-${now.toString(36)}`;
    await client.execute({
      sql: "INSERT INTO categories (id, bidang_id, nama, created_at) VALUES (?, ?, ?, ?)",
      args: [id, bidangId, kategori, now],
    });
    kategoriAda.set(kunci, id);
    kategoriBaru++;
  }

  // 3. Barang
  const barangAda = new Map();
  let urutanTerbesar = 0;
  for (const row of (
    await client.execute({
      sql: "SELECT id, kode, nama, kategori_id, satuan_id FROM items WHERE bidang_id = ?",
      args: [bidangId],
    })
  ).rows) {
    barangAda.set(normalkan(String(row.nama)), {
      id: String(row.id),
      kategoriId: row.kategori_id ? String(row.kategori_id) : null,
      satuanId: row.satuan_id ? String(row.satuan_id) : null,
    });
    const kode = String(row.kode);
    if (kode.startsWith(prefix)) {
      const nomor = Number(kode.slice(prefix.length));
      if (Number.isFinite(nomor)) urutanTerbesar = Math.max(urutanTerbesar, nomor);
    }
  }

  let ditambah = 0;
  let diperbaiki = 0;
  for (const [nama, satuan, kategori] of barangResmi) {
    const kategoriId = kategoriAda.get(normalkan(kategori));
    const satuanId = satuanAda.get(normalkan(satuan));
    const ada = barangAda.get(normalkan(nama));

    if (ada) {
      const perluPerbaikan = (kategoriId && ada.kategoriId !== kategoriId) || (satuanId && ada.satuanId !== satuanId);
      if (perluPerbaikan) {
        await client.execute({
          sql: "UPDATE items SET kategori_id = ?, satuan_id = ?, updated_at = ? WHERE id = ?",
          args: [kategoriId || ada.kategoriId, satuanId || ada.satuanId, now, ada.id],
        });
        diperbaiki++;
      }
      continue;
    }

    urutanTerbesar += 1;
    await client.execute({
      sql: `INSERT INTO items (id, bidang_id, kode, nama, kategori_id, satuan_id, stok_minimum, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 0, 'ACTIVE', ?, ?)`,
      args: [
        `item-${prefix.replace("-", "").toLowerCase()}-${pad(urutanTerbesar)}`,
        bidangId,
        `${prefix}${pad(urutanTerbesar)}`,
        nama,
        kategoriId || null,
        satuanId || null,
        now,
        now,
      ],
    });
    ditambah++;
  }

  // 4. Vendor
  const vendorAda = new Set(
    (await client.execute("SELECT nama FROM vendors")).rows.map((r) => normalkan(String(r.nama)))
  );
  let vendorBaru = 0;
  for (const nama of vendorResmi || []) {
    if (vendorAda.has(normalkan(nama))) continue;
    await client.execute({
      sql: "INSERT INTO vendors (id, nama, alamat, telepon, created_at) VALUES (?, ?, '', '', ?)",
      args: [`vnd-${normalkan(nama).slice(0, 16)}-${now.toString(36)}`, nama, now],
    });
    vendorAda.add(normalkan(nama));
    vendorBaru++;
  }

  console.log(
    `Selesai: ${ditambah} barang baru, ${diperbaiki} barang diperbaiki, ` +
      `${kategoriBaru} kategori baru, ${satuanBaru} satuan baru, ${vendorBaru} vendor baru.`
  );
}

impor().catch((err) => {
  console.error("Impor gagal:", err);
  process.exit(1);
});
