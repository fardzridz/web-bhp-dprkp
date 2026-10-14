import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  // Get active bidang details
  let activeBidang = null;
  if (session.activeBidangId) {
    activeBidang = await db.query.bidang.findFirst({
      where: eq(schema.bidang.id, session.activeBidangId),
    });
  }

  // Get all available bidang list
  const allBidang = await db.query.bidang.findMany({
    orderBy: (b, { asc }) => [asc(b.nama)],
  });

  return NextResponse.json({
    authenticated: true,
    user: session,
    activeBidang,
    allBidang,
  });
}
