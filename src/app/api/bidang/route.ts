import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db, schema } from "@/db";
import { eq, count } from "drizzle-orm";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Non-superadmin is strictly restricted to their own assigned bidang
  if (session.role !== "SUPERADMIN") {
    const myBidangId = session.bidangId || session.activeBidangId;
    if (!myBidangId) {
      return NextResponse.json({ data: [] });
    }
    const list = await db.query.bidang.findMany({
      where: eq(schema.bidang.id, myBidangId),
    });
    return NextResponse.json({ data: list });
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
    const { id, nama, kode, deskripsi, namaAtasan, nipAtasan, jabatanAtasan, pangkatAtasan, namaPengurus, nipPengurus, jabatanPengurus, pangkatPengurus } = body;

    if (!nama || !kode) {
      return NextResponse.json({ error: "Nama dan Kode bidang wajib diisi" }, { status: 400 });
    }

    const bidangId = (id || kode).toLowerCase().replace(/[^a-z0-9]/g, "-");
    const existing = await db.query.bidang.findFirst({
      where: eq(schema.bidang.kode, kode.toUpperCase()),
    });
    if (existing) {
      return NextResponse.json({ error: "Kode bidang sudah digunakan" }, { status: 400 });
    }

    const now = Date.now();
    await db.insert(schema.bidang).values({
      id: bidangId,
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
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({ success: true, id: bidangId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal menambah bidang";
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
      return NextResponse.json({ error: "ID, Nama, dan Kode bidang wajib diisi" }, { status: 400 });
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
    if (!id) {
      return NextResponse.json({ error: "ID bidang diperlukan" }, { status: 400 });
    }

    // Check if items or users are associated
    const itemsCount = await db
      .select({ val: count() })
      .from(schema.items)
      .where(eq(schema.items.bidangId, id));

    if (itemsCount[0].val > 0) {
      return NextResponse.json(
        { error: `Tidak dapat menghapus bidang karena masih memiliki ${itemsCount[0].val} item barang.` },
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
