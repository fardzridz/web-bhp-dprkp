import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db, schema } from "@/db";
import { eq, count } from "drizzle-orm";

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

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id, nama } = await request.json();
    if (!id || !nama || !String(nama).trim()) {
      return NextResponse.json({ error: "ID dan Nama satuan wajib diisi" }, { status: 400 });
    }

    const cleanNama = String(nama).trim().toLowerCase();

    await db
      .update(schema.units)
      .set({ nama: cleanNama })
      .where(eq(schema.units.id, id));

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal memperbarui satuan";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID satuan diperlukan" }, { status: 400 });

    const [itemCount] = await db
      .select({ count: count() })
      .from(schema.items)
      .where(eq(schema.items.satuanId, id));

    if (itemCount && itemCount.count > 0) {
      return NextResponse.json(
        { error: "Satuan tidak dapat dihapus karena masih digunakan oleh master barang." },
        { status: 400 }
      );
    }

    await db.delete(schema.units).where(eq(schema.units.id, id));

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal menghapus satuan";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
