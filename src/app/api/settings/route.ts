import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db, schema } from "@/db";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db.query.agencySettings.findMany();
  const settings: Record<string, string> = {};
  for (const r of rows) {
    settings[r.key] = r.value;
  }

  return NextResponse.json({ data: settings });
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Hanya Superadmin yang berwenang" }, { status: 403 });
  }

  try {
    const settings = await request.json();
    for (const [key, value] of Object.entries(settings)) {
      if (typeof value === "string") {
        await db
          .insert(schema.agencySettings)
          .values({ key, value })
          .onConflictDoUpdate({
            target: schema.agencySettings.key,
            set: { value },
          });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal menyimpan pengaturan";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
