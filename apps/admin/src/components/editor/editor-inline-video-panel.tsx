"use client";

import type { ChangeEvent, DragEvent } from "react";
import { Button, Input, Select } from "@nite/cms-ui";

export type VideoUploadState =
  "idle" | "uploading" | "processing" | "ready" | "error";

type Props = {
  videoState: VideoUploadState;
  videoProgress: number;
  videoMessage?: string;
  videoPreviewUrl?: string;
  captionsState: VideoUploadState;
  captionsProgress: number;
  captionsMessage?: string;
  playbackMode: "autoplay" | "manual";
  description: string;
  caption: string;
  credit: string;
  layout: "normal" | "wide" | "full";
  durationMs?: number;
  hasAudio?: boolean;
  onVideoFileSelect: (file: File) => void;
  onCaptionsFileSelect: (file: File) => void;
  onCancelVideo: () => void;
  onCancelCaptions: () => void;
  onRetryVideo: () => void;
  onRetryCaptions: () => void;
  onPlaybackModeChange: (mode: "autoplay" | "manual") => void;
  onDescriptionChange: (value: string) => void;
  onCaptionChange: (value: string) => void;
  onCreditChange: (value: string) => void;
  onLayoutChange: (layout: "normal" | "wide" | "full") => void;
  onInsert: () => void;
  onClosePanel: () => void;
};

function selectedFile(event: ChangeEvent<HTMLInputElement>) {
  return event.currentTarget.files?.[0];
}

export function EditorInlineVideoPanel(props: Props) {
  const videoBusy =
    props.videoState === "uploading" || props.videoState === "processing";
  const captionsBusy =
    props.captionsState === "uploading" || props.captionsState === "processing";
  const autoplayTooLong =
    props.playbackMode === "autoplay" &&
    props.durationMs !== undefined &&
    props.durationMs > 60_000;
  const captionsRequired =
    props.playbackMode === "manual" &&
    props.hasAudio === true &&
    props.captionsState !== "ready";

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) props.onVideoFileSelect(file);
  }

  return (
    <section
      className="border-b border-border-subtle bg-surface-subtle/60 px-5 py-5 sm:px-8"
      aria-labelledby="inline-video-title"
    >
      <div className="mx-auto max-w-[760px] space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3
              id="inline-video-title"
              className="text-ui-lg font-semibold text-text-primary"
            >
              Inserir vídeo
            </h3>
            <p className="mt-0.5 text-ui-sm text-text-secondary">
              O vídeo será inserido exatamente na posição atual do cursor.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={props.onClosePanel}
          >
            Cancelar
          </Button>
        </div>

        {props.videoPreviewUrl ? (
          <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface">
            <div className="aspect-video bg-text-primary">
              <video
                src={props.videoPreviewUrl}
                controls
                preload="metadata"
                className="h-full w-full object-contain"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle px-4 py-3">
              <p className="text-ui-sm text-text-secondary">
                Vídeo pronto para inserir.
              </p>
              <label className="inline-flex">
                <span className="sr-only">Substituir vídeo selecionado</span>
                <Input
                  type="file"
                  accept="video/mp4"
                  disabled={videoBusy}
                  className="sr-only"
                  onChange={(event) => {
                    const file = selectedFile(event);
                    if (file) props.onVideoFileSelect(file);
                  }}
                />
                <span className="inline-flex h-9 cursor-pointer items-center rounded-md border border-border bg-surface px-3 text-ui-md font-semibold text-text-primary hover:bg-surface-hover">
                  Substituir
                </span>
              </label>
            </div>
          </div>
        ) : (
          <label
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
            className="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border-strong bg-surface px-6 text-center transition-colors [transition-duration:var(--motion-duration-normal)] hover:border-primary-border hover:bg-primary-subtle/30"
          >
            <span
              className="flex size-9 items-center justify-center rounded-full bg-primary-subtle text-primary"
              aria-hidden="true"
            >
              ▶
            </span>
            <span className="mt-3 text-ui-md font-semibold text-text-primary">
              Arraste um vídeo ou selecione um arquivo
            </span>
            <span className="mt-1 text-ui-sm text-text-secondary">
              MP4 H.264 · até 100 MB
            </span>
            <Input
              aria-label="Selecionar vídeo para o conteúdo"
              type="file"
              accept="video/mp4"
              disabled={videoBusy}
              className="sr-only"
              onChange={(event) => {
                const file = selectedFile(event);
                if (file) props.onVideoFileSelect(file);
              }}
            />
          </label>
        )}

        {props.videoState === "uploading" ? (
          <div className="space-y-1.5" role="status">
            <div className="flex items-center justify-between text-ui-sm text-text-secondary">
              <span>Enviando vídeo…</span>
              <span className="font-mono">{props.videoProgress}%</span>
            </div>
            <progress
              aria-label="Progresso do upload do vídeo"
              max={100}
              value={props.videoProgress}
              className="h-1.5 w-full"
            />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={props.onCancelVideo}
            >
              Cancelar upload
            </Button>
          </div>
        ) : null}

        {props.videoState === "processing" ? (
          <p role="status" className="text-ui-sm text-text-secondary">
            Validando vídeo e preparando para publicação…
          </p>
        ) : null}

        {props.videoState === "error" ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-danger-border bg-danger-bg px-3 py-2.5">
            <p role="alert" className="text-ui-sm text-danger">
              {props.videoMessage ?? "Não foi possível processar o vídeo."}
            </p>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={props.onRetryVideo}
            >
              Tentar novamente
            </Button>
          </div>
        ) : null}

        {props.videoState === "ready" ? (
          <>
            <details className="group rounded-lg border border-border-subtle bg-surface">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-ui-md font-semibold text-text-primary">
                <span>Opções do vídeo</span>
                <span
                  className="text-text-secondary group-open:rotate-180"
                  aria-hidden="true"
                >
                  ⌄
                </span>
              </summary>
              <div className="grid gap-3 border-t border-border-subtle p-4 sm:grid-cols-2">
                <label className="text-ui-md font-semibold text-text-primary">
                  Reprodução
                  <Select
                    aria-label="Modo de reprodução do vídeo"
                    value={props.playbackMode}
                    onChange={(event) =>
                      props.onPlaybackModeChange(
                        event.target.value as "autoplay" | "manual",
                      )
                    }
                    className="mt-1"
                  >
                    <option value="manual">Manual · controles e áudio</option>
                    <option value="autoplay">
                      Automática · sem som, em loop
                    </option>
                  </Select>
                </label>

                <label className="text-ui-md font-semibold text-text-primary">
                  Largura
                  <Select
                    aria-label="Largura do vídeo"
                    value={props.layout}
                    onChange={(event) =>
                      props.onLayoutChange(
                        event.target.value as "normal" | "wide" | "full",
                      )
                    }
                    className="mt-1"
                  >
                    <option value="normal">Normal · coluna de leitura</option>
                    <option value="wide">Ampla · largura editorial</option>
                    <option value="full">Total · área do editor</option>
                  </Select>
                </label>

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-ui-md font-semibold text-text-primary">
                    Descrição acessível{" "}
                    <span className="font-normal text-text-secondary">
                      (opcional)
                    </span>
                  </label>
                  <Input
                    aria-label="Descrição acessível do vídeo"
                    value={props.description}
                    maxLength={500}
                    onChange={(event) =>
                      props.onDescriptionChange(event.target.value)
                    }
                    placeholder="Descreva visualmente o conteúdo do vídeo"
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
                    aria-label="Legenda visual do vídeo"
                    value={props.caption}
                    maxLength={280}
                    onChange={(event) =>
                      props.onCaptionChange(event.target.value)
                    }
                    placeholder="Texto visível abaixo do vídeo"
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
                    aria-label="Crédito do vídeo"
                    value={props.credit}
                    maxLength={160}
                    onChange={(event) =>
                      props.onCreditChange(event.target.value)
                    }
                    placeholder="Vídeo: autor ou instituição"
                  />
                </div>

                {props.playbackMode === "manual" ? (
                  <div className="space-y-2 sm:col-span-2">
                    <label className="block text-ui-md font-semibold text-text-primary">
                      Legenda acessível WebVTT pt-BR
                      <Input
                        aria-label="Legenda WebVTT pt-BR"
                        type="file"
                        accept="text/vtt,.vtt"
                        disabled={captionsBusy}
                        className="mt-1"
                        onChange={(event) => {
                          const file = selectedFile(event);
                          if (file) props.onCaptionsFileSelect(file);
                        }}
                      />
                    </label>
                    {props.captionsState === "uploading" ? (
                      <div className="space-y-1">
                        <progress
                          aria-label="Progresso do upload da legenda"
                          max={100}
                          value={props.captionsProgress}
                          className="h-1.5 w-full"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={props.onCancelCaptions}
                        >
                          Cancelar legenda
                        </Button>
                      </div>
                    ) : null}
                    {props.captionsState === "error" ? (
                      <div className="flex items-center justify-between gap-2">
                        <p role="alert" className="text-ui-sm text-danger">
                          {props.captionsMessage ??
                            "Não foi possível processar a legenda."}
                        </p>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={props.onRetryCaptions}
                        >
                          Tentar novamente
                        </Button>
                      </div>
                    ) : null}
                    {props.captionsState === "ready" ? (
                      <p className="text-ui-sm text-success">
                        WebVTT pt-BR pronto.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </details>

            {autoplayTooLong ? (
              <p role="alert" className="text-ui-sm text-danger">
                Reprodução automática aceita vídeos de até 60 segundos.
              </p>
            ) : null}
            {captionsRequired ? (
              <p role="alert" className="text-ui-sm text-warning">
                Vídeos manuais com áudio precisam de legenda WebVTT pt-BR antes
                da publicação.
              </p>
            ) : null}

            <div className="flex justify-end">
              <Button
                type="button"
                disabled={autoplayTooLong || captionsRequired}
                onClick={props.onInsert}
              >
                Inserir vídeo
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
