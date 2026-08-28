import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "NITE CMS",
  description: "Ambiente editorial administrativo do Portal NITE.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" data-theme="dark">
      <body className="min-h-screen bg-nite-background font-sans text-nite-text-primary antialiased">
        {children}
      </body>
    </html>
  );
}
