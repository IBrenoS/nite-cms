"use client";

import type { ChangeEvent } from "react";
import { Button, Input } from "@nite/cms-ui";

export type VideoUploadState =
  "idle" | "uploading" | "processing" | "ready" | "error";

type Props = {
  videoState: VideoUploadState;
  videoProgress: number;
  videoMessage?: string;
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

  return (
    <section
      className="grid gap-3 border-b border-nite-border-subtle bg-nite-section/70 p-3.5 sm:grid-cols-2"
      aria-labelledby="inline-video-title"
    >
      <div className="space-y-1.5">
        <h3 id="inline-video-title" className="text-xs font-semibold">
          Inserir vídeo MP4
        </h3>
        <Input
          aria-label="Vídeo MP4"
          type="file"
          accept="video/mp4"
          disabled={videoBusy}
          onChange={(event) => {
            const file = selectedFile(event);
            if (file) props.onVideoFileSelect(file);
          }}
        />
        {props.videoState === "uploading" ? (
          <div className="flex items-center gap-2">
            <progress
              aria-label="Progresso do upload do vídeo"
              max={100}
              value={props.videoProgress}
              className="min-w-0 flex-1"
            />
            <Button
              type="button"
              size="sm"
              variant="quiet"
              onClick={props.onCancelVideo}
            >
              Cancelar
            </Button>
          </div>
        ) : null}
        {props.videoState === "error" ? (
          <Button
            type="button"
            size="sm"
            variant="quiet"
            onClick={props.onRetryVideo}
          >
            Tentar vídeo novamente
          </Button>
        ) : null}
        {props.videoState !== "idle" ? (
          <p
            role={props.videoState === "error" ? "alert" : "status"}
            className="text-xs text-nite-text-secondary"
          >
            {props.videoMessage ??
              (props.videoState === "ready"
                ? "Vídeo pronto para inserir."
                : props.videoState === "processing"
                  ? "Validando contêiner, codecs e metadados…"
                  : "Enviando vídeo…")}
          </p>
        ) : null}
      </div>

      <label className="text-xs font-semibold text-nite-text-primary">
        Reprodução
        <select
          aria-label="Modo de reprodução do vídeo"
          value={props.playbackMode}
          onChange={(event) =>
            props.onPlaybackModeChange(
              event.target.value as "autoplay" | "manual",
            )
          }
          className="nite-form-field mt-1 min-h-9 w-full rounded-md border px-2 text-xs"
        >
          <option value="manual">Manual · controles e áudio</option>
          <option value="autoplay">Automática · sem som, em loop</option>
        </select>
      </label>

      <Input
        aria-label="Descrição acessível do vídeo"
        value={props.description}
        maxLength={500}
        onChange={(event) => props.onDescriptionChange(event.target.value)}
        placeholder="Descrição acessível (opcional)"
      />
      <Input
        aria-label="Legenda visual do vídeo"
        value={props.caption}
        maxLength={280}
        onChange={(event) => props.onCaptionChange(event.target.value)}
        placeholder="Legenda visível (opcional)"
      />
      <Input
        aria-label="Crédito do vídeo"
        value={props.credit}
        maxLength={160}
        onChange={(event) => props.onCreditChange(event.target.value)}
        placeholder="Crédito (opcional)"
      />
      <label className="text-xs font-semibold text-nite-text-primary">
        Largura do vídeo
        <select
          aria-label="Largura do vídeo"
          value={props.layout}
          onChange={(event) =>
            props.onLayoutChange(
              event.target.value as "normal" | "wide" | "full",
            )
          }
          className="nite-form-field mt-1 min-h-9 w-full rounded-md border px-2 text-xs"
        >
          <option value="normal">Normal · coluna do texto</option>
          <option value="wide">Ampla · largura editorial</option>
          <option value="full">Total · container principal</option>
        </select>
      </label>

      {props.playbackMode === "manual" ? (
        <div className="space-y-1.5 sm:col-span-2">
          <label className="block text-xs font-semibold text-nite-text-primary">
            Legenda acessível WebVTT pt-BR
            <Input
              aria-label="Legenda WebVTT pt-BR"
              type="file"
              accept="text/vtt,.vtt"
              disabled={captionsBusy}
              onChange={(event) => {
                const file = selectedFile(event);
                if (file) props.onCaptionsFileSelect(file);
              }}
            />
          </label>
          {props.captionsState === "uploading" ? (
            <div className="flex items-center gap-2">
              <progress
                aria-label="Progresso do upload da legenda"
                max={100}
                value={props.captionsProgress}
                className="min-w-0 flex-1"
              />
              <Button
                type="button"
                size="sm"
                variant="quiet"
                onClick={props.onCancelCaptions}
              >
                Cancelar legenda
              </Button>
            </div>
          ) : null}
          {props.captionsState === "error" ? (
            <Button
              type="button"
              size="sm"
              variant="quiet"
              onClick={props.onRetryCaptions}
            >
              Tentar legenda novamente
            </Button>
          ) : null}
          {props.captionsMessage ? (
            <p
              role={props.captionsState === "error" ? "alert" : "status"}
              className="text-xs text-nite-text-secondary"
            >
              {props.captionsMessage}
            </p>
          ) : null}
        </div>
      ) : null}

      {captionsRequired ? (
        <p role="status" className="text-xs text-status-warning sm:col-span-2">
          Este vídeo contém áudio. Adicione WebVTT pt-BR antes de abrir o
          preview ou publicar.
        </p>
      ) : null}
      {autoplayTooLong ? (
        <p role="alert" className="text-xs text-status-error sm:col-span-2">
          Autoplay aceita vídeos de até 60 segundos. Use reprodução manual para
          este arquivo.
        </p>
      ) : null}
      <p className="text-[11px] text-nite-text-muted sm:col-span-2">
        Autoplay é sempre silencioso, sem controles e em loop. O navegador pode
        bloquear a reprodução ou respeitar movimento reduzido.
      </p>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={props.videoState !== "ready"}
        className="sm:col-span-2 justify-self-start"
        onClick={props.onInsert}
      >
        Inserir vídeo
      </Button>
    </section>
  );
}
