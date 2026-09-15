"use client";

import { useState, type ChangeEvent } from "react";
import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";
import { Button, Input } from "@nite/cms-ui";
import { useNodeViewContext } from "./node-view-context";

function VideoGlyph({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className || "size-4"}
      fill="none"
      height="24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="24"
    >
      <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.934a.5.5 0 0 0-.777-.416L16 11" />
      <rect height="12" rx="2" width="14" x="2" y="6" />
    </svg>
  );
}

export function VideoNodeView({
  node,
  updateAttributes,
  deleteNode,
  selected,
}: NodeViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const {
    onReplaceVideo,
    onReplaceCaptions,
    videoReplacementPending = false,
    videoReplacementMessage,
  } = useNodeViewContext();

  const attrs = node.attrs as {
    mediaId?: string;
    captionsMediaId?: string;
    playbackMode?: "autoplay" | "manual";
    layout?: "normal" | "wide" | "full";
    description?: string;
    caption?: string;
    credit?: string;
  };

  const playbackMode = attrs.playbackMode || "manual";
  const layout = attrs.layout || "normal";
  const description = attrs.description || "";
  const caption = attrs.caption || "";
  const credit = attrs.credit || "";
  const hasCaptions = Boolean(attrs.captionsMediaId);

  const showEditPanel = isEditing || selected;

  function handleVideoFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (file && onReplaceVideo) {
      onReplaceVideo(file);
    }
  }

  function handleCaptionsFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (file && onReplaceCaptions) {
      onReplaceCaptions(file);
    }
  }

  return (
    <NodeViewWrapper
      as="figure"
      data-editorial-video="true"
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
              <VideoGlyph className="size-4" />
            </span>
            <span className="text-xs font-semibold text-nite-text-primary">
              Vídeo inserido
            </span>
            <span className="rounded bg-nite-section px-2 py-0.5 text-[11px] font-medium text-nite-text-secondary">
              {playbackMode === "autoplay"
                ? "Automático (loop)"
                : "Reprodução manual"}
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
                hasCaptions
                  ? "bg-status-done/10 text-status-done"
                  : "bg-nite-section text-nite-text-muted"
              }`}
            >
              {hasCaptions ? "WebVTT pt-BR presente" : "Sem legenda WebVTT"}
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
              aria-label="Remover vídeo do conteúdo"
              onClick={() => deleteNode()}
              className="text-status-error hover:bg-status-error/10"
            >
              Remover
            </Button>
          </div>
        </div>

        {/* Resumo e metadados informativos */}
        <div className="space-y-1.5 text-xs">
          {description ? (
            <p className="text-nite-text-secondary">
              <strong className="font-semibold text-nite-text-primary">
                Descrição:
              </strong>{" "}
              {description}
            </p>
          ) : (
            <p className="text-[11px] italic text-status-warning">
              Sem descrição acessível informada. Adicione uma descrição para
              atender às diretrizes de acessibilidade.
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

          <div className="flex items-center justify-between pt-1 text-[11px] text-nite-text-muted">
            <span>
              Player de vídeo disponível em{" "}
              <strong className="font-semibold text-nite-text-secondary">
                Visualizar
              </strong>
              .
            </span>
            {attrs.mediaId ? (
              <span className="font-mono text-[10px]">
                ID: {attrs.mediaId.slice(0, 8)}…
              </span>
            ) : null}
          </div>
        </div>

        {/* Painel contextual de edição in-place */}
        {showEditPanel ? (
          <div className="mt-2 grid gap-3 rounded-lg border border-nite-border-subtle bg-nite-section/40 p-3.5 sm:grid-cols-2">
            <h3 className="text-xs font-semibold text-nite-text-primary sm:col-span-2">
              Editar vídeo interno
            </h3>

            <div>
              <label
                htmlFor={`video-playback-${attrs.mediaId || "node"}`}
                className="mb-1 block text-xs font-semibold text-nite-text-primary"
              >
                Reprodução
              </label>
              <select
                id={`video-playback-${attrs.mediaId || "node"}`}
                aria-label="Reprodução do vídeo selecionado"
                value={playbackMode}
                onChange={(event) =>
                  updateAttributes({
                    playbackMode: event.target.value as "autoplay" | "manual",
                  })
                }
                className="nite-form-field min-h-8 w-full rounded-md border border-nite-border-subtle bg-nite-surface px-2 text-xs"
              >
                <option value="manual">Manual</option>
                <option value="autoplay">
                  Automática, silenciosa e em loop
                </option>
              </select>
            </div>

            <div>
              <label
                htmlFor={`video-layout-${attrs.mediaId || "node"}`}
                className="mb-1 block text-xs font-semibold text-nite-text-primary"
              >
                Largura
              </label>
              <select
                id={`video-layout-${attrs.mediaId || "node"}`}
                aria-label="Largura do vídeo selecionado"
                value={layout}
                onChange={(event) =>
                  updateAttributes({
                    layout: event.target.value as "normal" | "wide" | "full",
                  })
                }
                className="nite-form-field min-h-8 w-full rounded-md border border-nite-border-subtle bg-nite-surface px-2 text-xs"
              >
                <option value="normal">Normal · até 806 px</option>
                <option value="wide">Ampla · largura editorial</option>
                <option value="full">Total · container principal</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <div className="mb-1 flex items-center justify-between text-xs font-semibold text-nite-text-primary">
                <label htmlFor={`video-desc-${attrs.mediaId || "node"}`}>
                  Descrição acessível
                </label>
                <span className="font-mono text-[10px] text-nite-text-muted">
                  {description.length}/500
                </span>
              </div>
              <Input
                id={`video-desc-${attrs.mediaId || "node"}`}
                aria-label="Descrição do vídeo selecionado"
                value={description}
                maxLength={500}
                placeholder="Descreva visualmente o conteúdo do vídeo para acessibilidade"
                className="min-h-8 rounded-md text-xs"
                onChange={(event) =>
                  updateAttributes({ description: event.target.value })
                }
              />
              <p className="mt-1 text-[11px] text-nite-text-secondary">
                Lida por leitores de tela em conformidade com as diretrizes de
                acessibilidade.
              </p>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-xs font-semibold text-nite-text-primary">
                <label htmlFor={`video-caption-${attrs.mediaId || "node"}`}>
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
                id={`video-caption-${attrs.mediaId || "node"}`}
                aria-label="Legenda do vídeo selecionado"
                value={caption}
                maxLength={280}
                placeholder="Texto explicativo exibido abaixo do vídeo"
                className="min-h-8 rounded-md text-xs"
                onChange={(event) =>
                  updateAttributes({ caption: event.target.value })
                }
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-xs font-semibold text-nite-text-primary">
                <label htmlFor={`video-credit-${attrs.mediaId || "node"}`}>
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
                id={`video-credit-${attrs.mediaId || "node"}`}
                aria-label="Crédito do vídeo selecionado"
                value={credit}
                maxLength={160}
                placeholder="Vídeo: autor ou instituição"
                className="min-h-8 rounded-md text-xs"
                onChange={(event) =>
                  updateAttributes({ credit: event.target.value })
                }
              />
            </div>

            <div>
              <label
                htmlFor={`video-replace-mp4-${attrs.mediaId || "node"}`}
                className="mb-1 block text-xs font-semibold text-nite-text-primary"
              >
                Substituir MP4
              </label>
              <Input
                id={`video-replace-mp4-${attrs.mediaId || "node"}`}
                aria-label="Substituir vídeo selecionado"
                type="file"
                accept="video/mp4"
                disabled={videoReplacementPending}
                className="min-h-8 text-xs"
                onChange={handleVideoFile}
              />
            </div>

            <div>
              <label
                htmlFor={`video-replace-vtt-${attrs.mediaId || "node"}`}
                className="mb-1 block text-xs font-semibold text-nite-text-primary"
              >
                Substituir WebVTT
              </label>
              <Input
                id={`video-replace-vtt-${attrs.mediaId || "node"}`}
                aria-label="Substituir legenda do vídeo selecionado"
                type="file"
                accept="text/vtt,.vtt"
                disabled={videoReplacementPending}
                className="min-h-8 text-xs"
                onChange={handleCaptionsFile}
              />
            </div>

            {videoReplacementMessage ? (
              <p
                role="status"
                className="text-xs text-nite-text-secondary sm:col-span-2"
              >
                {videoReplacementMessage}
              </p>
            ) : null}

            <div className="flex items-center justify-between sm:col-span-2 pt-1 border-t border-nite-border-subtle">
              <Button
                type="button"
                variant="quiet"
                size="sm"
                className="text-status-error hover:bg-status-error/10"
                onClick={() => deleteNode()}
              >
                Remover vídeo
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
