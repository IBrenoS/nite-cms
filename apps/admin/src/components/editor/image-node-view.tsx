"use client";

import { useState } from "react";
import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";
import { Button, ImageIcon, Input } from "@nite/cms-ui";

export function ImageNodeView({
  node,
  updateAttributes,
  deleteNode,
  selected,
}: NodeViewProps) {
  const [isEditing, setIsEditing] = useState(false);

  const attrs = node.attrs as {
    mediaId?: string;
    alt?: string;
    caption?: string;
    credit?: string;
    layout?: "normal" | "wide" | "full";
  };

  const alt = attrs.alt || "";
  const caption = attrs.caption || "";
  const credit = attrs.credit || "";
  const layout = attrs.layout || "normal";
  const hasAlt = Boolean(alt.trim());

  const showEditPanel = isEditing || selected;

  return (
    <NodeViewWrapper
      as="figure"
      data-media-id={attrs.mediaId}
      className={`my-4 overflow-hidden rounded-xl border bg-nite-surface transition-all ${
        selected
          ? "border-nite-brand-primary shadow-sm ring-1 ring-nite-brand-primary"
          : "border-nite-border-subtle hover:border-nite-border-hover"
      }`}
    >
      {/* Bloco editorial de mídia rico */}
      <div className="flex flex-col gap-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-nite-border-subtle pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-nite-brand-primary/10 text-nite-brand-primary">
              <ImageIcon className="size-4" aria-hidden="true" />
            </span>
            <span className="text-xs font-semibold text-nite-text-primary">
              Imagem inserida
            </span>
            <span className="rounded bg-nite-section px-2 py-0.5 text-[11px] font-medium text-nite-text-secondary">
              {layout === "wide"
                ? "Largura ampla"
                : layout === "full"
                  ? "Largura total"
                  : "Largura normal"}
            </span>
            <span
              className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                hasAlt
                  ? "bg-status-done/10 text-status-done"
                  : "bg-status-warning/15 text-status-warning"
              }`}
            >
              {hasAlt ? "Texto alternativo presente" : "Alt ausente"}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="quiet"
              size="sm"
              onClick={() => setIsEditing((prev) => !prev)}
            >
              {showEditPanel ? "Fechar edição" : "Editar"}
            </Button>
            <Button
              type="button"
              variant="quiet"
              size="sm"
              aria-label="Remover imagem do conteúdo"
              onClick={() => deleteNode()}
              className="text-status-error hover:bg-status-error/10"
            >
              Remover
            </Button>
          </div>
        </div>

        {/* Resumo e metadados informativos */}
        <div className="space-y-1.5 text-xs">
          {alt ? (
            <p className="text-nite-text-secondary">
              <strong className="font-semibold text-nite-text-primary">
                Alt:
              </strong>{" "}
              {alt}
            </p>
          ) : (
            <p className="text-[11px] italic text-status-warning">
              Sem texto alternativo. Adicione um texto descritivo para leitores
              de tela.
            </p>
          )}

          {caption ? (
            <p className="text-nite-text-secondary">
              <strong className="font-semibold text-nite-text-primary">
                Legenda:
              </strong>{" "}
              {caption}
            </p>
          ) : null}

          {credit ? (
            <p className="text-nite-text-secondary">
              <strong className="font-semibold text-nite-text-primary">
                Crédito:
              </strong>{" "}
              {credit}
            </p>
          ) : null}

          {attrs.mediaId ? (
            <div className="pt-1 text-[10px] font-mono text-nite-text-muted">
              ID: {attrs.mediaId.slice(0, 8)}…
            </div>
          ) : null}
        </div>

        {/* Painel contextual de edição in-place */}
        {showEditPanel ? (
          <div className="mt-2 grid gap-3 rounded-lg border border-nite-border-subtle bg-nite-section/40 p-3.5 sm:grid-cols-2">
            <h3
              id="selected-image-title"
              className="text-xs font-semibold text-nite-text-primary sm:col-span-2"
            >
              Editar imagem interna
            </h3>

            <div className="sm:col-span-2">
              <div className="mb-1 flex items-center justify-between text-xs font-semibold text-nite-text-primary">
                <label htmlFor={`image-alt-${attrs.mediaId || "node"}`}>
                  Texto alternativo
                </label>
                <span className="font-mono text-[10px] text-nite-text-muted">
                  {alt.length} caracteres
                </span>
              </div>
              <Input
                id={`image-alt-${attrs.mediaId || "node"}`}
                aria-label="Alt da imagem selecionada"
                value={alt}
                placeholder="Descreva visualmente o conteúdo da imagem para acessibilidade"
                className="min-h-8 rounded-md text-xs"
                onChange={(event) =>
                  updateAttributes({ alt: event.target.value })
                }
              />
              <p className="mt-1 text-[11px] text-nite-text-secondary">
                Essencial para leitores de tela e acessibilidade.
              </p>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-xs font-semibold text-nite-text-primary">
                <label htmlFor={`image-caption-${attrs.mediaId || "node"}`}>
                  Legenda{" "}
                  <span className="font-normal text-nite-text-secondary">
                    (opcional)
                  </span>
                </label>
                <span className="font-mono text-[10px] text-nite-text-muted">
                  {caption.length}/280
                </span>
              </div>
              <Input
                id={`image-caption-${attrs.mediaId || "node"}`}
                aria-label="Legenda da imagem selecionada"
                value={caption}
                maxLength={280}
                placeholder="Texto explicativo visível abaixo da imagem"
                className="min-h-8 rounded-md text-xs"
                onChange={(event) =>
                  updateAttributes({ caption: event.target.value })
                }
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-xs font-semibold text-nite-text-primary">
                <label htmlFor={`image-credit-${attrs.mediaId || "node"}`}>
                  Crédito{" "}
                  <span className="font-normal text-nite-text-secondary">
                    (opcional)
                  </span>
                </label>
                <span className="font-mono text-[10px] text-nite-text-muted">
                  {credit.length}/160
                </span>
              </div>
              <Input
                id={`image-credit-${attrs.mediaId || "node"}`}
                aria-label="Crédito da imagem selecionada"
                value={credit}
                maxLength={160}
                placeholder="Foto: autor ou instituição"
                className="min-h-8 rounded-md text-xs"
                onChange={(event) =>
                  updateAttributes({ credit: event.target.value })
                }
              />
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor={`image-layout-${attrs.mediaId || "node"}`}
                className="mb-1 block text-xs font-semibold text-nite-text-primary"
              >
                Largura da imagem selecionada
              </label>
              <select
                id={`image-layout-${attrs.mediaId || "node"}`}
                aria-label="Largura da imagem selecionada"
                value={layout}
                onChange={(event) =>
                  updateAttributes({
                    layout: event.target.value as "normal" | "wide" | "full",
                  })
                }
                className="nite-form-field min-h-8 w-full rounded-md border border-nite-border-subtle bg-nite-surface px-2 text-xs"
              >
                <option value="normal">Normal · coluna do texto</option>
                <option value="wide">Ampla · largura editorial</option>
                <option value="full">Total · container principal</option>
              </select>
            </div>

            <div className="flex items-center justify-between sm:col-span-2 pt-1 border-t border-nite-border-subtle">
              <Button
                type="button"
                variant="quiet"
                size="sm"
                className="text-status-error hover:bg-status-error/10"
                onClick={() => deleteNode()}
              >
                Remover imagem
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsEditing(false)}
              >
                Concluir edição
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </NodeViewWrapper>
  );
}
