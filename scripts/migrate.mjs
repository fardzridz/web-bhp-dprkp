import { createClient } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";

const client = createClient({
  url: process.env.DATABASE_URL || "file:local.sqlite",
});

async function runMigrations() {
  console.log("Applying migrations...");
  const migrationDir = path.resolve("drizzle");
  const sqlFiles = fs.readdirSync(migrationDir).filter((f) => f.endsWith(".sql")).sort();

  for (const file of sqlFiles) {
    console.log(`Executing ${file}...`);
    const fullPath = path.join(migrationDir, file);
    const sql = fs.readFileSync(fullPath, "utf-8");
    
    // Split by semicolons for clean individual execution
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

    for (const stmt of statements) {
      await client.execute(stmt);
    }
  }
  console.log("Migrations applied successfully!");
}

runMigrations().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
