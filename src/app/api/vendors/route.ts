import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db, schema } from "@/db";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const list = await db.query.vendors.findMany({
    orderBy: (v, { asc }) => [asc(v.nama)],
  });

  return NextResponse.json({ data: list });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { nama, alamat, telepon } = await request.json();
    if (!nama || !nama.trim()) {
      return NextResponse.json({ error: "Nama vendor / rekanan wajib diisi" }, { status: 400 });
    }

    const id = "vnd-" + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    await db.insert(schema.vendors).values({
      id,
      nama: String(nama).trim(),
      alamat: alamat || null,
      telepon: telepon || null,
      createdAt: Date.now(),
    });

    return NextResponse.json({ success: true, id, nama: String(nama).trim() });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal menambah vendor";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
