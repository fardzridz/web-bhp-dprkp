import { NextResponse } from "next/server";
import { getSession, setSessionCookie } from "@/lib/session";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sesi tidak valid" }, { status: 401 });
  }

  if (session.role !== "SUPERADMIN") {
    return NextResponse.json(
      { error: "Hanya Superadmin yang dapat berpindah bidang." },
      { status: 403 }
    );
  }

  const { bidangId } = await request.json();
  if (!bidangId) {
    return NextResponse.json({ error: "bidangId wajib diisi" }, { status: 400 });
  }

  const targetBidang = await db.query.bidang.findFirst({
    where: eq(schema.bidang.id, bidangId),
  });

  if (!targetBidang) {
    return NextResponse.json({ error: "Bidang tidak ditemukan" }, { status: 404 });
  }

  const updatedUser = {
    ...session,
    activeBidangId: targetBidang.id,
  };

  await setSessionCookie(updatedUser);

  return NextResponse.json({
    success: true,
    activeBidang: targetBidang,
  });
}
