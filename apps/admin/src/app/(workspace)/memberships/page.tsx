import { asc, eq, getTableColumns, sql } from "drizzle-orm";
import { cmsMembershipInvitations, cmsMemberships } from "@nite/cms-db";
import { MembershipsPanel } from "@/components/memberships-panel";
import { requireCmsPageContext } from "@/lib/auth";

export default async function MembershipsPage() {
  const context = await requireCmsPageContext();
  if (context.membership.role !== "admin") {
    return (
      <main>
        <h1 className="font-heading text-2xl font-semibold">Acesso negado</h1>
        <p className="mt-3 text-nite-text-secondary">
          A gestão da equipe é restrita a pessoas com acesso administrativo.
        </p>
      </main>
    );
  }
  const [memberships, invitations] = await Promise.all([
    context.database
      .select()
      .from(cmsMemberships)
      .where(eq(cmsMemberships.tenantId, context.membership.tenantId))
      .orderBy(asc(cmsMemberships.displayName)),
    context.database
      .select({
        ...getTableColumns(cmsMembershipInvitations),
        expired: sql<boolean>`${cmsMembershipInvitations.expiresAt} <= now()`,
      })
      .from(cmsMembershipInvitations)
      .where(eq(cmsMembershipInvitations.tenantId, context.membership.tenantId))
      .orderBy(asc(cmsMembershipInvitations.email)),
  ]);
  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 grid gap-5">
      <header className="flex flex-col gap-1">
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-nite-brand-accent">
          Administração
        </p>
        <h1 className="font-heading text-3xl font-semibold">
          Equipe e acessos
        </h1>
        <p className="text-sm text-nite-text-secondary">
          Gerencie a equipe da redação, atribua permissões e controle os acessos
          ativos.
        </p>
      </header>
      <MembershipsPanel
        memberships={memberships}
        invitations={invitations
          .filter((invitation) => invitation.status === "pending")
          .map((invitation) => ({
            ...invitation,
            expiresAt: invitation.expiresAt.toISOString(),
            expired: invitation.expired,
          }))}
        currentMembershipId={context.membership.id}
      />
    </main>
  );
}
