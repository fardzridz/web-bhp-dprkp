import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { verifyPassword } from "@/lib/auth-crypto";
import { setSessionCookie } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username dan password wajib diisi." },
        { status: 400 }
      );
    }

    const user = await db.query.users.findFirst({
      where: eq(schema.users.username, String(username).trim().toLowerCase()),
    });

    if (!user || user.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Username atau password salah / akun non-aktif." },
        { status: 401 }
      );
    }

    const isMatch = await verifyPassword(password, user.salt, user.passwordHash);
    if (!isMatch) {
      return NextResponse.json(
        { error: "Username atau password salah." },
        { status: 401 }
      );
    }

    // Determine initial active bidang
    let activeBidangId = user.bidangId;
    if (user.role === "SUPERADMIN") {
      const firstBidang = await db.query.bidang.findFirst();
      activeBidangId = firstBidang?.id || null;
    }

    await setSessionCookie({
      id: user.id,
      username: user.username,
      nama: user.nama,
      role: user.role as "SUPERADMIN" | "OPERATOR_BIDANG" | "KEPALA_BIDANG",
      bidangId: user.bidangId,
      activeBidangId,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        nama: user.nama,
        role: user.role,
        bidangId: user.bidangId,
        activeBidangId,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Terjadi kesalahan server";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
