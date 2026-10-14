import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db, schema } from "@/db";
import { eq, and, count } from "drizzle-orm";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || !session.activeBidangId) {
    return NextResponse.json({ error: "Unauthorized / Bidang belum dipilih" }, { status: 401 });
  }

  const list = await db.query.categories.findMany({
    where: eq(schema.categories.bidangId, session.activeBidangId),
    orderBy: (c, { asc }) => [asc(c.nama)],
  });

  return NextResponse.json({ data: list });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !session.activeBidangId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { nama } = await request.json();
    if (!nama || !nama.trim()) {
      return NextResponse.json({ error: "Nama kategori wajib diisi" }, { status: 400 });
    }

    const cleanNama = String(nama).trim();
    const id = "ktg-" + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);

    await db.insert(schema.categories).values({
      id,
      bidangId: session.activeBidangId,
      nama: cleanNama,
      createdAt: Date.now(),
    });

    return NextResponse.json({ success: true, id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal menambah kategori";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session || !session.activeBidangId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id, nama } = await request.json();
    if (!id || !nama) {
      return NextResponse.json({ error: "ID dan Nama kategori wajib diisi" }, { status: 400 });
    }

    await db
      .update(schema.categories)
      .set({ nama: String(nama).trim() })
      .where(and(eq(schema.categories.id, id), eq(schema.categories.bidangId, session.activeBidangId)));

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal memperbarui kategori";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session || !session.activeBidangId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID kategori diperlukan" }, { status: 400 });

    const [itemCount] = await db
      .select({ count: count() })
      .from(schema.items)
      .where(and(eq(schema.items.kategoriId, id), eq(schema.items.bidangId, session.activeBidangId)));

    if (itemCount && itemCount.count > 0) {
      return NextResponse.json(
        { error: "Kategori tidak dapat dihapus karena masih digunakan oleh barang." },
        { status: 400 }
      );
    }

    await db
      .delete(schema.categories)
      .where(and(eq(schema.categories.id, id), eq(schema.categories.bidangId, session.activeBidangId)));

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal menghapus kategori";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
