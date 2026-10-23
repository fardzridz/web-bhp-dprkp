import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { D1_INIT_STATEMENTS } from "@/lib/d1-schema-sql";

export const dynamic = "force-dynamic";

export async function GET() {
  return handleInit();
}

export async function POST() {
  return handleInit();
}

async function handleInit() {
  try {
    let executed = 0;
    const errors: string[] = [];

    for (const statement of D1_INIT_STATEMENTS) {
      try {
        await db.run(sql.raw(statement));
        executed++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        // ignore benign errors like already exists
        if (!msg.includes("already exists")) {
          errors.push(msg);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Inisialisasi database Cloudflare D1 selesai. ${executed} dari ${D1_INIT_STATEMENTS.length} pernyataan berhasil dieksekusi.`,
      executed,
      total: D1_INIT_STATEMENTS.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Terjadi kesalahan";
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
