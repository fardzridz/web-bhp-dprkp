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
  const currentBidangId = session.role === "SUPERADMIN" ? session.activeBidangId : (session.bidangId || session.activeBidangId);
  if (currentBidangId) {
    activeBidang = await db.query.bidang.findFirst({
      where: eq(schema.bidang.id, currentBidangId),
    });
  }

  // Superadmin gets all bidang, Operators get only their own bidang
  const allBidang = session.role === "SUPERADMIN"
    ? await db.query.bidang.findMany({
        orderBy: (b, { asc }) => [asc(b.nama)],
      })
    : (activeBidang ? [activeBidang] : []);

  return NextResponse.json({
    authenticated: true,
    user: session,
    activeBidang,
    allBidang,
  });
}
