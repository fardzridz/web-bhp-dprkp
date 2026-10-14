import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SIPERSEDIA — Pengelolaan BHP DPRKP",
  description: "Sistem Informasi Persediaan Barang Habis Pakai - Dinas Perumahan Rakyat dan Kawasan Permukiman",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="min-h-screen antialiased bg-slate-50 text-slate-800">
        {children}
      </body>
    </html>
  );
}
