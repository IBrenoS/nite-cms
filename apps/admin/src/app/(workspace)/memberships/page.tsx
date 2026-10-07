import { asc, eq, getTableColumns, sql } from "drizzle-orm";
import {
  cmsMembershipInvitations,
  cmsMemberships,
  emailDeliveries,
} from "@nite/cms-db";
import { MembershipsPanel } from "@/components/memberships-panel";
import { MembershipInviteDialog } from "@/components/memberships/membership-invite-dialog";
import { requireCmsPageContext } from "@/lib/auth";

export default async function MembershipsPage() {
  const context = await requireCmsPageContext();
  if (context.membership.role !== "admin") {
    return (
      <main className="px-4 py-6 sm:px-6 lg:px-8">
        <h1 className="font-heading text-heading-md font-semibold">
          Acesso negado
        </h1>
        <p className="mt-3 text-text-secondary">
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
        deliveryStatus: emailDeliveries.status,
      })
      .from(cmsMembershipInvitations)
      .leftJoin(
        emailDeliveries,
        eq(emailDeliveries.invitationId, cmsMembershipInvitations.id),
      )
      .where(eq(cmsMembershipInvitations.tenantId, context.membership.tenantId))
      .orderBy(asc(cmsMembershipInvitations.email)),
  ]);
  return (
    <main className="grid w-full gap-6 px-4 py-6 sm:px-6 lg:px-8 xl:px-10">
      <header className="flex flex-col gap-4 border-b border-border-subtle pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-3xl">
          <h1 className="text-heading-md font-semibold tracking-tight">
            Equipe e acessos
          </h1>
          <p className="mt-1 text-ui-lg text-text-secondary">
            Gerencie a equipe da redação, atribua permissões e controle os
            acessos ativos.
          </p>
        </div>
        <MembershipInviteDialog />
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
