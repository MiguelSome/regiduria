import type { Metadata } from "next";
import "./globals.css";

import { AppShell } from "@/components/layout/app-shell";

export const metadata: Metadata = {
  title: "Regiduría",
  description: "Aplicación de gestión escénica para producciones, cues y modo función.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning className="h-full">
      <body className="min-h-full bg-slate-950 text-slate-100 antialiased"> 
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
