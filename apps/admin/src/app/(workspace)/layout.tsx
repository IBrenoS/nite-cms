import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Chip } from "@nite/cms-ui";

import { getCmsContext } from "@/lib/auth";
import { SignOutButton } from "@/components/sign-out-button";
import { WorkspaceNavigation } from "@/components/workspace-navigation";

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
    <div className="min-h-screen bg-nite-background">
      <WorkspaceNavigation
        displayName={context.membership.displayName}
        role={context.membership.role}
      />
      <div className="min-w-0 flex-1 lg:pl-[220px]">{children}</div>
    </div>
  );
}
