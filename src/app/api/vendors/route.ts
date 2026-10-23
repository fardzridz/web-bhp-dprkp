import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db, schema } from "@/db";
import { eq, asc } from "drizzle-orm";
import { recordActivityLog } from "@/lib/activity-log";
import { DataError, errorResponse, newId } from "@/lib/inventory";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const list = await db.query.vendors.findMany({
    orderBy: [asc(schema.vendors.nama)],
  });

  return NextResponse.json({ data: list });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "SUPERADMIN") {
    return NextResponse.json(
      { error: "Hanya Superadmin yang berwenang mengubah master vendor." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { nama, npwp, alamat, telepon } = body;

    if (!nama || !String(nama).trim()) {
      return NextResponse.json({ error: "Nama vendor / rekanan wajib diisi" }, { status: 400 });
    }

    const cleanNama = String(nama).trim();
    const duplicate = await db.query.vendors.findFirst({
      where: (v, { sql }) => sql`lower(trim(${v.nama})) = ${cleanNama.toLowerCase()}`,
      columns: { id: true },
    });
    if (duplicate) {
      throw new DataError("Vendor dengan nama tersebut sudah ada.");
    }

    const id = newId("vnd");
    await db.insert(schema.vendors).values({
      id,
      nama: cleanNama,
      npwp: npwp?.trim() || null,
      alamat: alamat?.trim() || null,
      telepon: telepon?.trim() || null,
      createdAt: Date.now(),
    });

    await recordActivityLog({
      userId: session.id,
      userName: session.nama,
      userRole: session.role,
      bidangId: session.activeBidangId || session.bidangId,
      action: "UBAH_PENGATURAN",
      description: `Menambahkan vendor "${cleanNama}".`,
      metadata: { vendorId: id, nama: cleanNama },
    });

    return NextResponse.json({ success: true, id, nama: cleanNama });
  } catch (err: unknown) {
    return errorResponse(err);
  }
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "SUPERADMIN") {
    return NextResponse.json(
      { error: "Hanya Superadmin yang berwenang mengubah master vendor." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { id, nama, npwp, alamat, telepon } = body;

    if (!id || !nama || !String(nama).trim()) {
      return NextResponse.json({ error: "ID dan Nama vendor wajib diisi" }, { status: 400 });
    }

    const cleanNama = String(nama).trim();
    const duplicate = await db.query.vendors.findFirst({
      where: (v, { sql }) => sql`lower(trim(${v.nama})) = ${cleanNama.toLowerCase()}`,
      columns: { id: true },
    });
    if (duplicate && duplicate.id !== id) {
      throw new DataError("Vendor dengan nama tersebut sudah ada.");
    }

    const existing = await db.query.vendors.findFirst({
      where: eq(schema.vendors.id, id),
      columns: { id: true },
    });
    if (!existing) throw new DataError("Vendor tidak ditemukan", 404);

    await db
      .update(schema.vendors)
      .set({
        nama: cleanNama,
        npwp: npwp?.trim() || null,
        alamat: alamat?.trim() || null,
        telepon: telepon?.trim() || null,
      })
      .where(eq(schema.vendors.id, id));

    await recordActivityLog({
      userId: session.id,
      userName: session.nama,
      userRole: session.role,
      bidangId: session.activeBidangId || session.bidangId,
      action: "UBAH_PENGATURAN",
      description: `Memperbarui vendor "${cleanNama}".`,
      metadata: { vendorId: id, nama: cleanNama },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return errorResponse(err);
  }
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "SUPERADMIN") {
    return NextResponse.json(
      { error: "Hanya Superadmin yang berwenang mengubah master vendor." },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID vendor diperlukan" }, { status: 400 });

    const existing = await db.query.vendors.findFirst({
      where: eq(schema.vendors.id, id),
    });
    if (!existing) throw new DataError("Vendor tidak ditemukan", 404);

    const usedReceipts = await db.query.receipts.findMany({
      where: eq(schema.receipts.vendorId, id),
      columns: { id: true },
    });
    if (usedReceipts.length > 0) {
      throw new DataError(
        `Vendor tidak dapat dihapus karena masih dipakai pada ${usedReceipts.length} dokumen penerimaan.`
      );
    }

    await db.delete(schema.vendors).where(eq(schema.vendors.id, id));

    await recordActivityLog({
      userId: session.id,
      userName: session.nama,
      userRole: session.role,
      bidangId: session.activeBidangId || session.bidangId,
      action: "UBAH_PENGATURAN",
      description: `Menghapus vendor "${existing.nama}".`,
      metadata: { vendorId: id, nama: existing.nama },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return errorResponse(err);
  }
}
