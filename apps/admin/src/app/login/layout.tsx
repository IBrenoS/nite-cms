import type { ReactNode } from "react";
import { Sora } from "next/font/google";

const sora = Sora({
  subsets: ["latin"],
  weight: "600",
  variable: "--font-sora",
});

export default function LoginLayout({ children }: { children: ReactNode }) {
  return <div className={sora.variable}>{children}</div>;
}
