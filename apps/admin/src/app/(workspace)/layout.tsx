import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Chip } from "@nite/cms-ui";

import { getCmsContext } from "@/lib/auth";
import { SignOutButton } from "@/components/sign-out-button";
import { WorkspaceShell } from "@/components/workspace-shell";

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
      <main className="grid min-h-screen place-items-center bg-canvas px-5">
        <section className="grid max-w-lg gap-4 rounded-xl border border-danger-border bg-surface p-7">
          <Chip variant="quiet">Acesso negado</Chip>
          <h1 className="font-heading text-heading-md font-semibold">
            Acesso editorial necessário
          </h1>
          <p className="leading-7 text-nite-text-secondary">
            Sua identidade Microsoft está válida, mas ainda não possui acesso à
            equipe da Redação Digital. Solicite um convite à administração.
          </p>
          <SignOutButton />
        </section>
      </main>
    );
  }

  return (
    <WorkspaceShell
      displayName={context.membership.displayName}
      role={context.membership.role}
    >
      {children}
    </WorkspaceShell>
  );
}
