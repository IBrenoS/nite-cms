import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const failures = [];

function source(file) {
  return readFileSync(join(root, file), "utf8");
}

function requireFragments(file, fragments) {
  const content = source(file);
  for (const fragment of fragments) {
    if (!content.includes(fragment)) {
      failures.push(`${file} — contrato Matérias v1 ausente: ${fragment}`);
    }
  }
}

function forbidFragments(file, fragments) {
  const content = source(file);
  for (const fragment of fragments) {
    if (content.includes(fragment)) {
      failures.push(`${file} — regressão Matérias v1: ${fragment}`);
    }
  }
}

requireFragments("apps/admin/src/app/(workspace)/page.tsx", [
  "Acompanhe o que está em produção e o que já foi publicado.",
  'label: "Todas"',
  'label: "Em produção"',
  'label: "Publicadas"',
  'label: "Arquivadas"',
  'aria-label="Visões editoriais"',
  "font-editorial text-ui-lg",
  "Atualizada {formatUpdatedAt(article.updatedAt)}",
  "Nenhuma matéria por aqui",
  "Nenhuma matéria corresponde aos filtros",
  "Índice editorial de matérias",
  "grid grid-cols-4",
  "sm:flex sm:min-w-max",
  "justify-center gap-1 whitespace-nowrap",
]);

forbidFragments("apps/admin/src/app/(workspace)/page.tsx", [
  'label: "Rascunhos"',
  ">Revisão<",
]);

requireFragments("apps/admin/src/components/article-filters.tsx", [
  'name="status"',
  'name="category"',
  'placeholder="Buscar matérias"',
  "Limpar filtros",
]);

forbidFragments("apps/admin/src/components/article-filters.tsx", [
  "Filtrar por estado",
  "Todos os estados",
]);

requireFragments("apps/admin/src/components/workspace-navigation.tsx", [
  "Redação",
  "Gestão",
  ">\n                  Equipe\n                </span>",
  "border-l-2",
  "Sheet",
  "SheetContent",
  'side="left"',
  'aria-label="Navegação móvel"',
  "w-full max-w-xs",
]);

forbidFragments("apps/admin/src/components/workspace-navigation.tsx", [
  "Operação editorial",
  ">\n                  Equipe e acessos\n                </span>",
  "fixed inset-x-0 top-14",
]);

if (failures.length > 0) {
  console.error("NITE CMS — Matérias v1: violações encontradas:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("NITE CMS — Matérias v1: contrato estático aprovado.");
