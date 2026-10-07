"use client";

import { useRef, useState, type ChangeEvent } from "react";
import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";
import { Button, Input, Select } from "@nite/cms-ui";
import { useNodeViewContext } from "./node-view-context";

export function VideoNodeView({
  node,
  updateAttributes,
  deleteNode,
  selected,
}: NodeViewProps) {
  const [optionsOpen, setOptionsOpen] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const captionsInputRef = useRef<HTMLInputElement>(null);
  const {
    mediaById,
    onReplaceVideo,
    onReplaceCaptions,
    mediaReplacementPending,
    mediaReplacementMessage,
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
  const videoPreview = attrs.mediaId ? mediaById?.[attrs.mediaId] : undefined;
  const captionsPreview = attrs.captionsMediaId
    ? mediaById?.[attrs.captionsMediaId]
    : undefined;
  const showControls = selected || optionsOpen;

  function handleVideoFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (file) onReplaceVideo?.(file);
    event.currentTarget.value = "";
  }

  function handleCaptionsFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (file) onReplaceCaptions?.(file);
    event.currentTarget.value = "";
  }

  return (
    <NodeViewWrapper
      as="figure"
      data-editorial-video="true"
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
        {videoPreview?.src ? (
          <div className="aspect-video bg-text-primary">
            <video
              src={videoPreview.src}
              controls={playbackMode === "manual"}
              autoPlay={playbackMode === "autoplay"}
              muted={playbackMode === "autoplay"}
              loop={playbackMode === "autoplay"}
              playsInline
              preload="metadata"
              aria-label={description || "Vídeo editorial"}
              className="h-full w-full object-contain"
            >
              {captionsPreview?.src ? (
                <track
                  kind="captions"
                  src={captionsPreview.src}
                  srcLang="pt-BR"
                  label="Português"
                  default
                />
              ) : null}
            </video>
          </div>
        ) : (
          <div className="flex aspect-video flex-col items-center justify-center bg-surface-subtle px-6 text-center">
            <span
              className="flex size-10 items-center justify-center rounded-full bg-primary-subtle text-primary"
              aria-hidden="true"
            >
              ▶
            </span>
            <p className="mt-2 text-ui-md font-semibold text-text-primary">
              Vídeo editorial
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
                ref={videoInputRef}
                type="file"
                accept="video/mp4"
                aria-label="Substituir vídeo selecionado"
                disabled={mediaReplacementPending}
                className="sr-only"
                onChange={handleVideoFile}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={!onReplaceVideo || mediaReplacementPending}
                onClick={() => videoInputRef.current?.click()}
              >
                Substituir
              </Button>

              <Select
                aria-label="Largura do vídeo selecionado"
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
                aria-expanded={optionsOpen}
                onClick={() => setOptionsOpen((open) => !open)}
              >
                Opções
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

            {optionsOpen ? (
              <div className="mt-3 grid gap-3 border-t border-border-subtle pt-3 sm:grid-cols-2">
                <label className="text-ui-md font-semibold text-text-primary">
                  Reprodução
                  <Select
                    aria-label="Reprodução do vídeo selecionado"
                    value={playbackMode}
                    className="mt-1"
                    onChange={(event) =>
                      updateAttributes({
                        playbackMode: event.target.value as
                          "autoplay" | "manual",
                      })
                    }
                  >
                    <option value="manual">Manual · controles e áudio</option>
                    <option value="autoplay">
                      Automática · sem som, em loop
                    </option>
                  </Select>
                </label>

                <div>
                  <label className="mb-1 block text-ui-md font-semibold text-text-primary">
                    Legenda WebVTT
                  </label>
                  <Input
                    ref={captionsInputRef}
                    type="file"
                    accept="text/vtt,.vtt"
                    aria-label="Substituir legenda WebVTT do vídeo"
                    disabled={mediaReplacementPending}
                    className="sr-only"
                    onChange={handleCaptionsFile}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={!onReplaceCaptions || mediaReplacementPending}
                    onClick={() => captionsInputRef.current?.click()}
                  >
                    {attrs.captionsMediaId
                      ? "Substituir WebVTT"
                      : "Adicionar WebVTT"}
                  </Button>
                  <p className="mt-1 text-ui-sm text-text-secondary">
                    {attrs.captionsMediaId
                      ? "Legenda pt-BR presente."
                      : "Recomendado para vídeos com áudio."}
                  </p>
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-ui-md font-semibold text-text-primary">
                    Descrição acessível{" "}
                    <span className="font-normal text-text-secondary">
                      (opcional)
                    </span>
                  </label>
                  <Input
                    aria-label="Descrição do vídeo selecionado"
                    value={description}
                    maxLength={500}
                    placeholder="Descreva o conteúdo visual do vídeo"
                    onChange={(event) =>
                      updateAttributes({ description: event.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="mb-1 block text-ui-md font-semibold text-text-primary">
                    Legenda{" "}
                    <span className="font-normal text-text-secondary">
                      (opcional)
                    </span>
                  </label>
                  <Input
                    aria-label="Legenda do vídeo selecionado"
                    value={caption}
                    maxLength={280}
                    placeholder="Texto visível abaixo do vídeo"
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
                    aria-label="Crédito do vídeo selecionado"
                    value={credit}
                    maxLength={160}
                    placeholder="Vídeo: autor ou instituição"
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
