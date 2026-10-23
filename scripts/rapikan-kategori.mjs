import { createClient } from "@libsql/client";

const client = createClient({
  url: process.env.DATABASE_URL || "file:local.sqlite",
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

/**
 * Menyamakan nama kategori antar unit kerja.
 *
 * Master barang di aplikasi diisolasi per unit, sehingga kategori yang sama
 * bisa bernama berbeda ("Alat Tulis Kantor Perumahan", "ATK Bidang Permukiman",
 * ...). Akibatnya lembar Laporan Mutasi gabungan SKPD terpecah menjadi banyak
 * blok kategori, padahal dokumen resmi memakai satu nama kategori resmi.
 *
 * Skrip ini memakai daftar kategori resmi mitra (file-appscript/MasterData.gs,
 * 19 kategori) sebagai acuan:
 *   - kategori yang namanya sudah resmi dibiarkan;
 *   - kategori yang jelas merupakan padanan resmi diganti namanya;
 *   - bila dalam satu unit sudah ada kategori dengan nama tujuan, barang
 *     dipindahkan ke kategori yang sudah ada lalu kategori duplikat dihapus.
 *
 * Aman dijalankan berulang: pemetaan yang sudah diterapkan tidak berbuat apa-apa.
 */

const PETA_NAMA = [
  // Nama kategori lama (persis, tanpa peduli huruf besar/kecil) -> nama resmi
  ["ATK Bidang Permukiman", "Alat Tulis Kantor"],
  ["ATK Pengukuran Pertanahan", "Alat Tulis Kantor"],
  ["Alat Tulis Kantor Perumahan", "Alat Tulis Kantor"],
  ["Bahan Material Survey Perumahan", "Bahan Baku Bangunan dan Konstruksi"],
  ["Bahan Cetakan", "Bahan Cetak"],
];

const normalkan = (nama) => (nama || "").trim().toLowerCase().replace(/\s+/g, " ");

async function rapikan() {
  const kategori = await client.execute(
    "SELECT id, bidang_id, nama FROM categories ORDER BY bidang_id, nama"
  );

  const petaNama = new Map(PETA_NAMA.map(([dari, ke]) => [normalkan(dari), ke]));
  let diganti = 0;
  let digabung = 0;
  let dilewati = 0;

  for (const row of kategori.rows) {
    const id = String(row.id);
    const bidangId = String(row.bidang_id);
    const nama = String(row.nama);
    const tujuan = petaNama.get(normalkan(nama));

    if (!tujuan) {
      dilewati++;
      continue;
    }

    if (normalkan(tujuan) === normalkan(nama)) {
      dilewati++;
      continue;
    }

    // Sudah ada kategori bernama tujuan di unit yang sama? Pindahkan barangnya.
    const sudahAda = await client.execute({
      sql: "SELECT id, nama FROM categories WHERE bidang_id = ? AND lower(trim(nama)) = ? AND id <> ?",
      args: [bidangId, normalkan(tujuan), id],
    });

    if (sudahAda.rows.length > 0) {
      const tujuanId = String(sudahAda.rows[0].id);
      await client.execute({
        sql: "UPDATE items SET kategori_id = ? WHERE kategori_id = ?",
        args: [tujuanId, id],
      });
      await client.execute({
        sql: "DELETE FROM categories WHERE id = ?",
        args: [id],
      });
      console.log(`  gabung: "${nama}" -> "${sudahAda.rows[0].nama}" (unit ${bidangId})`);
      digabung++;
      continue;
    }

    await client.execute({
      sql: "UPDATE categories SET nama = ? WHERE id = ?",
      args: [tujuan, id],
    });
    console.log(`  ganti : "${nama}" -> "${tujuan}" (unit ${bidangId})`);
    diganti++;
  }

  console.log(
    `Selesai: ${diganti} kategori diganti nama, ${digabung} digabung, ${dilewati} tidak berubah.`
  );
}

rapikan().catch((err) => {
  console.error("Gagal merapikan kategori:", err);
  process.exit(1);
});
