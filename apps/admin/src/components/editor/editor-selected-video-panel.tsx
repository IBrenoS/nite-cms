"use client";

import type { ChangeEvent } from "react";
import type { Editor } from "@tiptap/react";
import { Button, Input } from "@nite/cms-ui";

type VideoAttrs = {
  playbackMode: "autoplay" | "manual";
  layout: "normal" | "wide" | "full";
  description: string;
  caption: string;
  credit: string;
};

export function EditorSelectedVideoPanel({
  editor,
  video,
  replacementMessage,
  replacementPending,
  onReplaceVideo,
  onReplaceCaptions,
}: {
  editor: Editor;
  video: VideoAttrs;
  replacementMessage?: string;
  replacementPending: boolean;
  onReplaceVideo: (file: File) => void;
  onReplaceCaptions: (file: File) => void;
}) {
  function update(attrs: Partial<VideoAttrs>) {
    editor.chain().focus().updateAttributes("video", attrs).run();
  }

  function file(event: ChangeEvent<HTMLInputElement>) {
    return event.currentTarget.files?.[0];
  }

  return (
    <section
      className="grid gap-2.5 border-b border-nite-border-subtle bg-blue-50/60 p-3.5 sm:grid-cols-2"
      aria-labelledby="selected-video-title"
    >
      <h3
        id="selected-video-title"
        className="text-xs font-semibold sm:col-span-2"
      >
        Editar vídeo interno
      </h3>
      <label className="text-xs font-semibold">
        Reprodução
        <select
          aria-label="Reprodução do vídeo selecionado"
          value={video.playbackMode}
          onChange={(event) =>
            update({
              playbackMode: event.target.value as VideoAttrs["playbackMode"],
            })
          }
          className="nite-form-field mt-1 min-h-9 w-full rounded-md border px-2 text-xs"
        >
          <option value="manual">Manual</option>
          <option value="autoplay">Automática, silenciosa e em loop</option>
        </select>
      </label>
      <label className="text-xs font-semibold">
        Largura
        <select
          aria-label="Largura do vídeo selecionado"
          value={video.layout}
          onChange={(event) =>
            update({ layout: event.target.value as VideoAttrs["layout"] })
          }
          className="nite-form-field mt-1 min-h-9 w-full rounded-md border px-2 text-xs"
        >
          <option value="normal">Normal</option>
          <option value="wide">Ampla</option>
          <option value="full">Total</option>
        </select>
      </label>
      <Input
        aria-label="Descrição do vídeo selecionado"
        value={video.description}
        maxLength={500}
        onChange={(event) => update({ description: event.target.value })}
      />
      <Input
        aria-label="Legenda do vídeo selecionado"
        value={video.caption}
        maxLength={280}
        onChange={(event) => update({ caption: event.target.value })}
      />
      <Input
        aria-label="Crédito do vídeo selecionado"
        value={video.credit}
        maxLength={160}
        onChange={(event) => update({ credit: event.target.value })}
      />
      <label className="text-xs font-semibold">
        Substituir MP4
        <Input
          aria-label="Substituir vídeo selecionado"
          type="file"
          accept="video/mp4"
          disabled={replacementPending}
          onChange={(event) => {
            const selected = file(event);
            if (selected) onReplaceVideo(selected);
          }}
        />
      </label>
      <label className="text-xs font-semibold">
        Substituir WebVTT
        <Input
          aria-label="Substituir legenda do vídeo selecionado"
          type="file"
          accept="text/vtt,.vtt"
          disabled={replacementPending}
          onChange={(event) => {
            const selected = file(event);
            if (selected) onReplaceCaptions(selected);
          }}
        />
      </label>
      {replacementMessage ? (
        <p
          role="status"
          className="text-xs text-nite-text-secondary sm:col-span-2"
        >
          {replacementMessage}
        </p>
      ) : null}
      <Button
        type="button"
        variant="quiet"
        size="sm"
        aria-label="Remover vídeo do conteúdo"
        className="sm:col-span-2 justify-self-start text-status-error"
        onClick={() => editor.chain().focus().deleteSelection().run()}
      >
        Remover vídeo
      </Button>
    </section>
  );
}
