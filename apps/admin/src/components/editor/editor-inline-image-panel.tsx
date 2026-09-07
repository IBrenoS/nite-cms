"use client";

import type { ChangeEvent } from "react";
import { Button, Input } from "@nite/cms-ui";

type EditorInlineImagePanelProps = {
  inlineMediaState: "idle" | "uploading" | "processing" | "ready" | "error";
  inlineMediaMessage?: string;
  inlineAlt: string;
  inlineAltError?: string;
  onAltChange: (value: string) => void;
  onFileSelect: (file: File) => void;
  onInsert: () => void;
};

export function EditorInlineImagePanel({
  inlineMediaState,
  inlineMediaMessage,
  inlineAlt,
  inlineAltError,
  onAltChange,
  onFileSelect,
  onInsert,
}: EditorInlineImagePanelProps) {
  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (file) onFileSelect(file);
  }

  return (
    <div className="grid gap-2.5 border-b border-nite-border-subtle bg-nite-section/70 p-3.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
      <Input
        aria-label="Imagem inline pronta"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={
          inlineMediaState === "uploading" || inlineMediaState === "processing"
        }
        onChange={handleFileChange}
      />
      <Input
        aria-label="Texto alternativo da imagem inline"
        value={inlineAlt}
        aria-invalid={Boolean(inlineAltError)}
        aria-describedby={inlineAltError ? "inline-alt-error" : undefined}
        onChange={(event) => onAltChange(event.target.value)}
        placeholder="Texto alternativo obrigatório"
      />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={inlineMediaState !== "ready"}
        onClick={onInsert}
      >
        Inserir imagem
      </Button>

      {inlineAltError ? (
        <p
          id="inline-alt-error"
          role="alert"
          className="text-xs text-status-error sm:col-span-3"
        >
          {inlineAltError}
        </p>
      ) : null}

      {inlineMediaState !== "idle" ? (
        <p
          role={inlineMediaState === "error" ? "alert" : "status"}
          className="text-xs text-nite-text-secondary sm:col-span-3"
        >
          {inlineMediaMessage ??
            (inlineMediaState === "ready"
              ? "Imagem pronta para inserir."
              : inlineMediaState === "error"
                ? "Não foi possível processar a imagem inline."
                : "Validando imagem…")}
        </p>
      ) : null}
    </div>
  );
}
