import { getSession } from "@/lib/session";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

export async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  // Fetch active bidang details
  let activeBidang = null;
  const currentBidangId = session.role === "SUPERADMIN" ? session.activeBidangId : (session.bidangId || session.activeBidangId);
  if (currentBidangId) {
    activeBidang = await db.query.bidang.findFirst({
      where: eq(schema.bidang.id, currentBidangId),
    });
  }

  // Superadmin gets all bidang for switching; Operators get only their own bidang
  const bidangList = session.role === "SUPERADMIN"
    ? await db.query.bidang.findMany({
        orderBy: (b, { asc }) => [asc(b.nama)],
      })
    : (activeBidang ? [activeBidang] : []);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar
        user={{
          nama: session.nama,
          role: session.role,
          activeBidangNama: activeBidang?.nama,
        }}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          user={session}
          bidangList={bidangList}
          activeBidang={activeBidang}
        />
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
