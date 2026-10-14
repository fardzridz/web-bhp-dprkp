import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db, schema } from "@/db";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const list = await db.query.units.findMany({
    orderBy: (u, { asc }) => [asc(u.nama)],
  });

  return NextResponse.json({ data: list });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { nama } = await request.json();
    if (!nama || !nama.trim()) {
      return NextResponse.json({ error: "Nama satuan wajib diisi" }, { status: 400 });
    }

    const cleanNama = String(nama).trim().toLowerCase();
    const id = "unit-" + cleanNama.replace(/[^a-z0-9]/g, "-");

    await db
      .insert(schema.units)
      .values({
        id,
        nama: cleanNama,
        createdAt: Date.now(),
      })
      .onConflictDoNothing();

    return NextResponse.json({ success: true, id, nama: cleanNama });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal menambah satuan";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
