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
  if (session.activeBidangId) {
    activeBidang = await db.query.bidang.findFirst({
      where: eq(schema.bidang.id, session.activeBidangId),
    });
  }

  // Fetch all bidang for switcher
  const bidangList = await db.query.bidang.findMany({
    orderBy: (b, { asc }) => [asc(b.nama)],
  });

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
