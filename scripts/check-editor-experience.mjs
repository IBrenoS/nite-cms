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
      failures.push(`${file} — contrato Editor v1 ausente: ${fragment}`);
    }
  }
}

function forbidFragments(file, fragments) {
  const content = source(file);
  for (const fragment of fragments) {
    if (content.includes(fragment)) {
      failures.push(`${file} — regressão Editor v1: ${fragment}`);
    }
  }
}

requireFragments("apps/admin/src/components/article-editor.tsx", [
  "inspector-rail:h-dvh",
  "inspector-rail:overflow-hidden",
  "inspector-rail:overflow-y-auto",
  "inspector-rail:grid-cols-[minmax(0,1fr)_360px]",
  "EditorPreflightDialog",
  "initialBodyMedia",
  "onNavigateToField: focusEditorialField",
  ".scrollIntoView()",
  "setInlinePanelOpen(true)",
  "setVideoPanelOpen(true)",
]);

requireFragments("apps/admin/src/components/editor/editor-canvas.tsx", [
  "max-w-[760px]",
  "max-w-[72ch]",
  "mediaById",
  "onReplaceSelectedImage",
  "inlineMediaProgress",
  "videoPreviewUrl",
  "mediaInsertPanelRef",
  'data-media-insert-panel="image"',
  'data-media-insert-panel="video"',
]);

requireFragments("apps/admin/src/components/editor/editor-toolbar.tsx", [
  "sticky",
  "Inserir",
  "Imagem",
  "Vídeo",
  "DropdownMenu",
]);

forbidFragments("apps/admin/src/components/editor/editor-toolbar.tsx", [
  "Adicionar:",
]);

requireFragments("apps/admin/src/components/editor/editor-inspector.tsx", [
  "Publicação",
  "Revisões",
  "Preparação",
  "Essencial",
  "Apresentação",
  "Distribuição",
  "Busca e URL",
  "Estado editorial",
  "onNavigateToField",
]);

requireFragments(
  "apps/admin/src/components/editor/editor-inline-image-panel.tsx",
  [
    "Arraste uma imagem ou selecione um arquivo",
    "Tentar novamente",
    "Progresso do upload da imagem",
  ],
);

requireFragments(
  "apps/admin/src/components/editor/editor-inline-video-panel.tsx",
  ["Arraste um vídeo ou selecione um arquivo", "Tentar novamente", "WebVTT"],
);

forbidFragments("apps/admin/src/components/editor/image-node-view.tsx", [
  "ID:",
  "mediaId:",
]);
forbidFragments("apps/admin/src/components/editor/video-node-view.tsx", [
  "ID:",
  "mediaId:",
]);

requireFragments("apps/admin/src/app/(workspace)/articles/[id]/edit/page.tsx", [
  "getEditorialMediaIds",
  "initialBodyMedia={bodyMedia}",
  "getPublicMediaUrl",
]);

requireFragments("apps/admin/src/app/(workspace)/articles/actions.ts", [
  "publicUrl: getPublicMediaUrl(media.publicObjectKey)",
]);

if (failures.length > 0) {
  console.error("NITE CMS — Editor v1: violações encontradas:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("NITE CMS — Editor v1: contrato estático aprovado.");
