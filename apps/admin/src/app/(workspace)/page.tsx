import Link from "next/link";
import { Button, EmptyState, StatusBadge } from "@nite/ui";

import { listEditorialArticles } from "@nite/content/admin";
import { requireCmsPageContext } from "@/lib/auth";

export default async function DashboardPage() {
  const context = await requireCmsPageContext();
  const records = await listEditorialArticles(
    context.database,
    context.membership,
  );

  return (
    <main className="grid gap-8">
      <div className="flex flex-col gap-5 border-b border-nite-border-subtle pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid gap-2">
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-nite-brand-accent">
            Operação editorial
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
            Matérias
          </h1>
          <p className="text-nite-text-secondary">
            Rascunhos, revisões fixadas e publicações do Nite News.
          </p>
        </div>
        <Button render={<Link href="/articles/new" />}>Nova matéria</Button>
      </div>

      {records.length === 0 ? (
        <EmptyState
          title="Nenhuma matéria criada"
          description="Comece por um rascunho. Nada será exibido no portal antes de uma publicação explícita."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-nite-border-subtle">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-nite-section font-mono text-xs uppercase tracking-[0.1em] text-nite-text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Matéria</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">
                  Revisão
                </th>
                <th className="px-4 py-3 text-right font-medium">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-nite-border-subtle">
              {records.map(({ article, revision }) => (
                <tr key={article.id}>
                  <td className="px-4 py-4">
                    <p className="font-medium text-nite-text-primary">
                      {revision?.title ?? "Rascunho sem revisão"}
                    </p>
                    <p className="mt-1 text-xs text-nite-text-muted">
                      /{article.slug}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <StatusBadge
                      status={
                        article.status === "published" ? "done" : article.status
                      }
                      label={
                        article.status === "published"
                          ? "Publicado"
                          : article.status === "draft"
                            ? "Rascunho"
                            : "Arquivado"
                      }
                    />
                  </td>
                  <td className="hidden px-4 py-4 text-nite-text-secondary md:table-cell">
                    {revision ? `v${revision.version}` : "—"}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <Link
                      className="rounded-md text-nite-brand-accent outline-none hover:text-nite-text-primary focus-visible:ring-2 focus-visible:ring-ring"
                      href={`/articles/${article.id}/edit`}
                    >
                      Editar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
