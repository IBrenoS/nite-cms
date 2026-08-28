import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Chip } from "@nite/cms-ui";

import { getCmsContext } from "@/lib/auth";
import { SignOutButton } from "@/components/sign-out-button";

export default async function WorkspaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  const context = await getCmsContext();
  if (context.status === "anonymous" || context.status === "unconfigured") {
    redirect("/login");
  }
  if (context.status === "forbidden") {
    return (
      <main className="grid min-h-screen place-items-center px-5">
        <section className="nite-panel grid max-w-lg gap-4 rounded-xl border border-status-error/35 p-7">
          <Chip variant="quiet">Acesso negado</Chip>
          <h1 className="font-heading text-2xl font-semibold">
            Membership editorial necessária
          </h1>
          <p className="leading-7 text-nite-text-secondary">
            A identidade Microsoft está válida, mas o par de tenant e objeto não
            está autorizado no CMS.
          </p>
          <SignOutButton />
        </section>
      </main>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-nite-border-subtle bg-nite-background/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-[90rem] items-center justify-between gap-5 px-5 sm:px-8">
          <div className="flex items-center gap-5">
            <Link
              href="/"
              className="font-heading font-semibold tracking-tight"
            >
              NITE CMS
            </Link>
            <span className="hidden font-mono text-xs uppercase tracking-[0.12em] text-nite-text-muted sm:inline">
              {context.membership.role}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-nite-text-secondary md:inline">
              {context.membership.displayName}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-[90rem] px-5 py-8 sm:px-8 sm:py-10">
        {children}
      </div>
    </div>
  );
}
