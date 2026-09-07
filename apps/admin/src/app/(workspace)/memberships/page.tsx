import { asc, eq } from "drizzle-orm";
import { cmsMemberships } from "@nite/cms-db";
import { MembershipsPanel } from "@/components/memberships-panel";
import { requireCmsPageContext } from "@/lib/auth";

export default async function MembershipsPage() {
  const context = await requireCmsPageContext();
  if (context.membership.role !== "admin") {
    return (
      <main>
        <h1 className="font-heading text-2xl font-semibold">Acesso negado</h1>
        <p className="mt-3 text-nite-text-secondary">
          A gestão de memberships é restrita a admins.
        </p>
      </main>
    );
  }
  const memberships = await context.database
    .select()
    .from(cmsMemberships)
    .where(eq(cmsMemberships.tenantId, context.membership.tenantId))
    .orderBy(asc(cmsMemberships.displayName));
  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 grid gap-5">
      <header className="flex flex-col gap-1">
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-nite-brand-accent">
          Administração
        </p>
        <h1 className="font-heading text-3xl font-semibold">Memberships</h1>
        <p className="text-sm text-nite-text-secondary">
          Gerencie a equipe da redação, atribua permissões e controle os acessos
          ativos.
        </p>
      </header>
      <MembershipsPanel memberships={memberships} />
    </main>
  );
}
