import { db, schema } from "@/db";

export interface LogParams {
  userId?: string | null;
  userName: string;
  userRole: string;
  bidangId?: string | null;
  bidangNama?: string | null;
  action:
    | "LOGIN"
    | "LOGOUT"
    | "INPUT_MASUK"
    | "UBAH_PENERIMAAN"
    | "HAPUS_PENERIMAAN"
    | "INPUT_KELUAR"
    | "UBAH_KELUAR"
    | "HAPUS_KELUAR"
    | "TAMBAH_BARANG"
    | "UBAH_BARANG"
    | "HAPUS_BARANG"
    | "TAMBAH_BIDANG"
    | "UBAH_BIDANG"
    | "UBAH_PENGATURAN";
  description: string;
  metadata?: Record<string, unknown> | null;
}

export async function recordActivityLog(params: LogParams): Promise<void> {
  try {
    const id = "log-" + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    await db.insert(schema.activityLogs).values({
      id,
      userId: params.userId || null,
      userName: params.userName,
      userRole: params.userRole,
      bidangId: params.bidangId || null,
      bidangNama: params.bidangNama || null,
      action: params.action,
      description: params.description,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      createdAt: Date.now(),
    });
  } catch (err) {
    // Log failure should not break user operations
    console.error("Failed to record activity log:", err);
  }
}
