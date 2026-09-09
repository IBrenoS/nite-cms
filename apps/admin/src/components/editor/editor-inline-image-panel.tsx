"use client";

import type { ChangeEvent } from "react";
import { Button, Input } from "@nite/cms-ui";

type EditorInlineImagePanelProps = {
  inlineMediaState: "idle" | "uploading" | "processing" | "ready" | "error";
  inlineMediaMessage?: string;
  inlineAlt: string;
  inlineCaption: string;
  inlineCredit: string;
  inlineLayout: "normal" | "wide" | "full";
  inlineAltError?: string;
  onAltChange: (value: string) => void;
  onCaptionChange: (value: string) => void;
  onCreditChange: (value: string) => void;
  onLayoutChange: (value: "normal" | "wide" | "full") => void;
  onFileSelect: (file: File) => void;
  onInsert: () => void;
};

export function EditorInlineImagePanel({
  inlineMediaState,
  inlineMediaMessage,
  inlineAlt,
  inlineCaption,
  inlineCredit,
  inlineLayout,
  inlineAltError,
  onAltChange,
  onCaptionChange,
  onCreditChange,
  onLayoutChange,
  onFileSelect,
  onInsert,
}: EditorInlineImagePanelProps) {
  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (file) onFileSelect(file);
  }

  return (
    <div className="grid gap-2.5 border-b border-nite-border-subtle bg-nite-section/70 p-3.5 sm:grid-cols-2">
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
      <Input
        aria-label="Legenda da imagem inline"
        value={inlineCaption}
        maxLength={280}
        onChange={(event) => onCaptionChange(event.target.value)}
        placeholder="Legenda visível (opcional)"
      />
      <Input
        aria-label="Crédito da imagem inline"
        value={inlineCredit}
        maxLength={160}
        onChange={(event) => onCreditChange(event.target.value)}
        placeholder="Crédito (opcional)"
      />
      <label className="text-xs font-semibold text-nite-text-primary">
        Largura da imagem inline
        <select
          value={inlineLayout}
          onChange={(event) =>
            onLayoutChange(event.target.value as "normal" | "wide" | "full")
          }
          className="nite-form-field mt-1 min-h-9 w-full rounded-md border px-2 text-xs"
        >
          <option value="normal">Normal · coluna do texto</option>
          <option value="wide">Ampla · largura editorial</option>
          <option value="full">Total · container principal</option>
        </select>
      </label>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={inlineMediaState !== "ready"}
        className="self-end"
        onClick={onInsert}
      >
        Inserir imagem
      </Button>

      {inlineAltError ? (
        <p
          id="inline-alt-error"
          role="alert"
          className="text-xs text-status-error sm:col-span-2"
        >
          {inlineAltError}
        </p>
      ) : null}

      {inlineMediaState !== "idle" ? (
        <p
          role={inlineMediaState === "error" ? "alert" : "status"}
          className="text-xs text-nite-text-secondary sm:col-span-2"
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
