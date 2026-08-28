import Link from "next/link";

import { ArticleEditor } from "@/components/article-editor";
import { requireCmsPageContext } from "@/lib/auth";

export default async function NewArticlePage() {
  const context = await requireCmsPageContext();

  return (
    <main className="grid gap-8">
      <header className="grid gap-3 border-b border-nite-border-subtle pb-7">
        <Link
          href="/"
          className="w-fit rounded-md font-mono text-xs uppercase tracking-[0.12em] text-nite-brand-accent outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          ← Matérias
        </Link>
        <h1 className="font-heading text-3xl font-semibold tracking-[-0.03em]">
          Nova matéria
        </h1>
        <p className="text-nite-text-secondary">
          O primeiro salvamento cria o artigo e sua revisão v1 como rascunho.
        </p>
      </header>
      <ArticleEditor canPublish={context.membership.role !== "author"} />
    </main>
  );
}
