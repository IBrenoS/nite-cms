import type { Metadata } from "next";
import type { ReactNode } from "react";
import { IBM_Plex_Mono, Newsreader, Source_Sans_3 } from "next/font/google";

import "./globals.css";

export const metadata: Metadata = {
  title: "NITE CMS",
  description: "Ambiente editorial administrativo do Portal NITE.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-source-sans",
});
const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
});
const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-ibm-plex-mono",
});

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" data-theme="light">
      <body
        className={`${sourceSans.variable} ${newsreader.variable} ${ibmPlexMono.variable} min-h-screen bg-nite-background font-sans text-nite-text-primary antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
