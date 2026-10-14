import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db, schema } from "@/db";
import { eq, count } from "drizzle-orm";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const list = await db.query.bidang.findMany({
    orderBy: (b, { asc }) => [asc(b.nama)],
  });

  return NextResponse.json({ data: list });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Hanya Superadmin yang berwenang" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { nama, kode, deskripsi, namaAtasan, nipAtasan, jabatanAtasan, pangkatAtasan, namaPengurus, nipPengurus, jabatanPengurus, pangkatPengurus } = body;

    if (!nama || !kode) {
      return NextResponse.json({ error: "Nama dan Kode bidang wajib diisi" }, { status: 400 });
    }

    const cleanKode = String(kode).trim().toUpperCase();
    const id = cleanKode.toLowerCase().replace(/[^a-z0-9]/g, "-") + "-" + Date.now().toString(36);

    const now = Date.now();
    await db.insert(schema.bidang).values({
      id,
      nama: String(nama).trim(),
      kode: cleanKode,
      deskripsi: deskripsi || null,
      namaAtasan: namaAtasan || null,
      nipAtasan: nipAtasan || null,
      jabatanAtasan: jabatanAtasan || null,
      pangkatAtasan: pangkatAtasan || null,
      namaPengurus: namaPengurus || null,
      nipPengurus: nipPengurus || null,
      jabatanPengurus: jabatanPengurus || null,
      pangkatPengurus: pangkatPengurus || null,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({ success: true, id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal menambahkan bidang";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Hanya Superadmin yang berwenang" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { id, nama, kode, deskripsi, namaAtasan, nipAtasan, jabatanAtasan, pangkatAtasan, namaPengurus, nipPengurus, jabatanPengurus, pangkatPengurus } = body;

    if (!id || !nama || !kode) {
      return NextResponse.json({ error: "ID, Nama dan Kode wajib diisi" }, { status: 400 });
    }

    await db
      .update(schema.bidang)
      .set({
        nama: String(nama).trim(),
        kode: String(kode).trim().toUpperCase(),
        deskripsi: deskripsi || null,
        namaAtasan: namaAtasan || null,
        nipAtasan: nipAtasan || null,
        jabatanAtasan: jabatanAtasan || null,
        pangkatAtasan: pangkatAtasan || null,
        namaPengurus: namaPengurus || null,
        nipPengurus: nipPengurus || null,
        jabatanPengurus: jabatanPengurus || null,
        pangkatPengurus: pangkatPengurus || null,
        updatedAt: Date.now(),
      })
      .where(eq(schema.bidang.id, id));

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal memperbarui bidang";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Hanya Superadmin yang berwenang" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID bidang diperlukan" }, { status: 400 });

    // Check if any items belong to this bidang
    const [itemCount] = await db
      .select({ count: count() })
      .from(schema.items)
      .where(eq(schema.items.bidangId, id));

    if (itemCount && itemCount.count > 0) {
      return NextResponse.json(
        { error: "Bidang tidak dapat dihapus karena masih memiliki master barang." },
        { status: 400 }
      );
    }

    await db.delete(schema.bidang).where(eq(schema.bidang.id, id));
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal menghapus bidang";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
