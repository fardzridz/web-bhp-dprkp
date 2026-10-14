import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { generateSalt, hashPassword } from "@/lib/auth-crypto";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Hanya Superadmin yang berwenang" }, { status: 403 });
  }

  const userList = await db.query.users.findMany({
    columns: {
      id: true,
      username: true,
      nama: true,
      role: true,
      bidangId: true,
      status: true,
      createdAt: true,
    },
    with: {
      // we can left join with bidang
    },
    orderBy: (u, { desc }) => [desc(u.createdAt)],
  });

  const bidangList = await db.query.bidang.findMany();
  const bidangMap = new Map(bidangList.map((b) => [b.id, b.nama]));

  const enrichedUsers = userList.map((u) => ({
    ...u,
    namaBidang: u.bidangId ? bidangMap.get(u.bidangId) || "-" : "Dinas (Semua Bidang)",
  }));

  return NextResponse.json({ data: enrichedUsers });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Hanya Superadmin yang berwenang" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { username, nama, password, role, bidangId } = body;

    if (!username || !nama || !password || !role) {
      return NextResponse.json(
        { error: "Username, Nama, Password, dan Peran wajib diisi" },
        { status: 400 }
      );
    }

    if (role === "OPERATOR_BIDANG" && !bidangId) {
      return NextResponse.json(
        { error: "Operator bidang wajib memilih bidang penugasan" },
        { status: 400 }
      );
    }

    const cleanUsername = String(username).trim().toLowerCase();
    const existing = await db.query.users.findFirst({
      where: eq(schema.users.username, cleanUsername),
    });

    if (existing) {
      return NextResponse.json({ error: "Username sudah digunakan" }, { status: 400 });
    }

    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);
    const now = Date.now();
    const id = "usr-" + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);

    await db.insert(schema.users).values({
      id,
      username: cleanUsername,
      nama: String(nama).trim(),
      passwordHash,
      salt,
      role,
      bidangId: role === "SUPERADMIN" ? null : bidangId,
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({ success: true, id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal menambahkan pengguna";
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
    const { id, nama, role, bidangId, status, password } = body;

    if (!id || !nama || !role) {
      return NextResponse.json({ error: "Data wajib diisi" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {
      nama: String(nama).trim(),
      role,
      bidangId: role === "SUPERADMIN" ? null : bidangId,
      status: status || "ACTIVE",
      updatedAt: Date.now(),
    };

    if (password && password.trim().length > 0) {
      const salt = generateSalt();
      updateData.passwordHash = await hashPassword(password, salt);
      updateData.salt = salt;
    }

    await db.update(schema.users).set(updateData).where(eq(schema.users.id, id));

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal memperbarui pengguna";
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
    if (!id) return NextResponse.json({ error: "ID user diperlukan" }, { status: 400 });

    if (id === session.id) {
      return NextResponse.json({ error: "Tidak dapat menghapus akun Anda sendiri" }, { status: 400 });
    }

    await db.delete(schema.users).where(eq(schema.users.id, id));
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal menghapus pengguna";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
