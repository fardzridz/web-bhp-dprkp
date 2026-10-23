import { createClient } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";

const client = createClient({
  url: process.env.DATABASE_URL || "file:local.sqlite",
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

/**
 * Menjalankan file migrasi di folder drizzle/ yang BELUM pernah diterapkan.
 * Riwayat disimpan di tabel `_applied_migrations` sehingga perintah ini aman
 * diulang dan tidak mencoba membuat tabel yang sudah ada.
 */
async function runMigrations() {
  console.log("Applying migrations...");
  const migrationDir = path.resolve("drizzle");
  const sqlFiles = fs
    .readdirSync(migrationDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  await client.execute(`
    CREATE TABLE IF NOT EXISTS _applied_migrations (
      tag TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL
    )
  `);

  const appliedRows = await client.execute("SELECT tag FROM _applied_migrations");
  const applied = new Set(appliedRows.rows.map((r) => String(r.tag)));

  let executed = 0;

  for (const file of sqlFiles) {
    if (applied.has(file)) {
      console.log(`- ${file} (sudah diterapkan, dilewati)`);
      continue;
    }

    const fullPath = path.join(migrationDir, file);
    const sql = fs.readFileSync(fullPath, "utf-8");
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

    console.log(`- ${file} (${statements.length} pernyataan)`);
    let skipped = 0;
    for (const stmt of statements) {
      try {
        await client.execute(stmt);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/already exists|duplicate column name/i.test(msg)) {
          // Objek sudah ada (database dibuat sebelum migrasi dicatat):
          // lewati pernyataan ini, lanjutkan sisanya.
          console.log(`  ! dilewati karena objek sudah ada: ${stmt.split("\n")[0].slice(0, 80)}`);
          skipped++;
          continue;
        }
        throw err;
      }
    }
    if (skipped > 0) {
      console.log(`  (${skipped} pernyataan dilewati karena objek sudah ada)`);
    }

    await client.execute({
      sql: `INSERT OR REPLACE INTO _applied_migrations (tag, applied_at) VALUES (?, ?)`,
      args: [file, Date.now()],
    });
    executed++;
  }

  console.log(
    executed > 0
      ? `Migrations applied successfully! (${executed} file baru)`
      : "Tidak ada migrasi baru."
  );
}

runMigrations().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
