"use client";

import Image from "next/image";
import { useRef, useState, type ChangeEvent } from "react";
import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";
import { Button, ImageIcon, Input, Select } from "@nite/cms-ui";
import { useNodeViewContext } from "./node-view-context";

export function ImageNodeView({
  node,
  updateAttributes,
  deleteNode,
  selected,
}: NodeViewProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const {
    mediaById,
    onReplaceImage,
    mediaReplacementPending,
    mediaReplacementMessage,
  } = useNodeViewContext();

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
  const preview = attrs.mediaId ? mediaById?.[attrs.mediaId] : undefined;
  const showControls = selected || detailsOpen;

  function handleReplacement(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (file) onReplaceImage?.(file);
    event.currentTarget.value = "";
  }

  return (
    <NodeViewWrapper
      as="figure"
      data-media-id={attrs.mediaId}
      className={`editor-media my-7 ${
        layout === "normal"
          ? "editor-media-normal"
          : layout === "wide"
            ? "editor-media-wide"
            : "editor-media-full"
      }`}
    >
      <div
        className={`overflow-hidden rounded-lg border bg-surface transition-colors [transition-duration:var(--motion-duration-normal)] ${
          selected
            ? "border-primary-border ring-1 ring-primary-border"
            : "border-border-subtle"
        }`}
      >
        {preview?.src ? (
          <div
            className="relative w-full bg-surface-subtle"
            style={
              preview.width && preview.height
                ? { aspectRatio: `${preview.width} / ${preview.height}` }
                : { aspectRatio: "16 / 9" }
            }
          >
            <Image
              src={preview.src}
              alt={alt || "Imagem editorial"}
              fill
              unoptimized
              sizes="(max-width: 768px) 100vw, 760px"
              className="object-contain"
            />
          </div>
        ) : (
          <div className="flex min-h-48 flex-col items-center justify-center bg-surface-subtle px-6 text-center">
            <ImageIcon className="size-6 text-primary" aria-hidden="true" />
            <p className="mt-2 text-ui-md font-semibold text-text-primary">
              Imagem editorial
            </p>
            <p className="mt-1 text-ui-sm text-text-secondary">
              A prévia ficará disponível quando a mídia pública puder ser
              resolvida.
            </p>
          </div>
        )}

        {caption || credit ? (
          <figcaption className="border-t border-border-subtle px-4 py-2.5 text-ui-sm text-text-secondary">
            {caption ? <span>{caption}</span> : null}
            {caption && credit ? <span aria-hidden="true"> · </span> : null}
            {credit ? <span>{credit}</span> : null}
          </figcaption>
        ) : null}

        {showControls ? (
          <div className="border-t border-border-subtle bg-surface px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                ref={replaceInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                aria-label="Substituir imagem selecionada"
                disabled={mediaReplacementPending}
                className="sr-only"
                onChange={handleReplacement}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={!onReplaceImage || mediaReplacementPending}
                onClick={() => replaceInputRef.current?.click()}
              >
                Substituir
              </Button>

              <Select
                aria-label="Largura da imagem selecionada"
                value={layout}
                className="h-8 w-auto min-w-32"
                onChange={(event) =>
                  updateAttributes({
                    layout: event.target.value as "normal" | "wide" | "full",
                  })
                }
              >
                <option value="normal">Largura normal</option>
                <option value="wide">Largura ampla</option>
                <option value="full">Largura total</option>
              </Select>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-expanded={detailsOpen}
                onClick={() => setDetailsOpen((open) => !open)}
              >
                Detalhes
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => deleteNode()}
                className="ml-auto text-danger hover:bg-danger-bg hover:text-danger"
              >
                Remover
              </Button>
            </div>

            {mediaReplacementMessage ? (
              <p role="status" className="mt-2 text-ui-sm text-text-secondary">
                {mediaReplacementMessage}
              </p>
            ) : null}

            {detailsOpen ? (
              <div className="mt-3 grid gap-3 border-t border-border-subtle pt-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-ui-md font-semibold text-text-primary">
                    Texto alternativo
                  </label>
                  <Input
                    aria-label="Alt da imagem selecionada"
                    value={alt}
                    placeholder="Descreva o conteúdo visual da imagem"
                    onChange={(event) =>
                      updateAttributes({ alt: event.target.value })
                    }
                  />
                  <p className="mt-1 text-ui-sm text-text-secondary">
                    Necessário para leitores de tela e acessibilidade.
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-ui-md font-semibold text-text-primary">
                    Legenda{" "}
                    <span className="font-normal text-text-secondary">
                      (opcional)
                    </span>
                  </label>
                  <Input
                    aria-label="Legenda da imagem selecionada"
                    value={caption}
                    maxLength={280}
                    placeholder="Texto visível abaixo da imagem"
                    onChange={(event) =>
                      updateAttributes({ caption: event.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block text-ui-md font-semibold text-text-primary">
                    Crédito{" "}
                    <span className="font-normal text-text-secondary">
                      (opcional)
                    </span>
                  </label>
                  <Input
                    aria-label="Crédito da imagem selecionada"
                    value={credit}
                    maxLength={160}
                    placeholder="Foto: autor ou instituição"
                    onChange={(event) =>
                      updateAttributes({ credit: event.target.value })
                    }
                  />
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </NodeViewWrapper>
  );
}
