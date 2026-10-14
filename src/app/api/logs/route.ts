import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db, schema } from "@/db";
import { desc, eq, and } from "drizzle-orm";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const actionFilter = searchParams.get("action");
  const bidangFilter = searchParams.get("bidangId");

  // Operators can only see logs from their own bidang, superadmins can see all or filter
  const targetBidangId = session.role === "SUPERADMIN" ? (bidangFilter || null) : session.bidangId;

  const logs = await db.query.activityLogs.findMany({
    where: (l, { eq, and }) => {
      const conditions = [];
      if (actionFilter) conditions.push(eq(l.action, actionFilter));
      if (targetBidangId) conditions.push(eq(l.bidangId, targetBidangId));
      return conditions.length > 0 ? and(...conditions) : undefined;
    },
    orderBy: [desc(schema.activityLogs.createdAt)],
    limit: 100,
  });

  return NextResponse.json({ data: logs });
}
