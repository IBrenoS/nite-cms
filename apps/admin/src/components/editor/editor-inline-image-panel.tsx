"use client";

import Image from "next/image";
import type { ChangeEvent, DragEvent } from "react";
import { Button, ImageUpIcon, Input, Select } from "@nite/cms-ui";

type EditorInlineImagePanelProps = {
  inlineMediaState: "idle" | "uploading" | "processing" | "ready" | "error";
  inlineMediaProgress: number;
  inlineMediaMessage?: string;
  previewUrl?: string;
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
  onRetry: () => void;
  onCancel: () => void;
};

export function EditorInlineImagePanel({
  inlineMediaState,
  inlineMediaProgress,
  inlineMediaMessage,
  previewUrl,
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
  onRetry,
  onCancel,
}: EditorInlineImagePanelProps) {
  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (file) onFileSelect(file);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) onFileSelect(file);
  }

  const busy =
    inlineMediaState === "uploading" || inlineMediaState === "processing";

  return (
    <section
      aria-labelledby="inline-image-upload-title"
      className="border-b border-border-subtle bg-surface-subtle/60 px-5 py-5 sm:px-8"
    >
      <div className="mx-auto max-w-[760px] space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3
              id="inline-image-upload-title"
              className="text-ui-lg font-semibold text-text-primary"
            >
              Inserir imagem
            </h3>
            <p className="mt-0.5 text-ui-sm text-text-secondary">
              A imagem será inserida exatamente na posição atual do cursor.
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancelar
          </Button>
        </div>

        {previewUrl ? (
          <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface">
            <div className="relative aspect-[16/9] bg-surface-subtle">
              <Image
                src={previewUrl}
                alt="Prévia da imagem selecionada"
                fill
                unoptimized
                sizes="760px"
                className="object-contain"
              />
            </div>
            <div className="grid gap-3 border-t border-border-subtle p-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-ui-md font-semibold text-text-primary">
                  Texto alternativo
                </label>
                <Input
                  aria-label="Texto alternativo da imagem inline"
                  value={inlineAlt}
                  aria-invalid={Boolean(inlineAltError)}
                  aria-describedby={
                    inlineAltError ? "inline-alt-error" : undefined
                  }
                  onChange={(event) => onAltChange(event.target.value)}
                  placeholder="Descreva o que é relevante na imagem"
                />
                {inlineAltError ? (
                  <p
                    id="inline-alt-error"
                    role="alert"
                    className="mt-1 text-ui-sm text-danger"
                  >
                    {inlineAltError}
                  </p>
                ) : (
                  <p className="mt-1 text-ui-sm text-text-secondary">
                    Obrigatório para acessibilidade.
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-ui-md font-semibold text-text-primary">
                  Legenda{" "}
                  <span className="font-normal text-text-secondary">
                    (opcional)
                  </span>
                </label>
                <Input
                  aria-label="Legenda da imagem inline"
                  value={inlineCaption}
                  maxLength={280}
                  onChange={(event) => onCaptionChange(event.target.value)}
                  placeholder="Texto visível abaixo da imagem"
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
                  aria-label="Crédito da imagem inline"
                  value={inlineCredit}
                  maxLength={160}
                  onChange={(event) => onCreditChange(event.target.value)}
                  placeholder="Foto: autor ou instituição"
                />
              </div>

              <label className="text-ui-md font-semibold text-text-primary">
                Largura
                <Select
                  value={inlineLayout}
                  onChange={(event) =>
                    onLayoutChange(
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

              <div className="flex items-end justify-end gap-2">
                <label className="inline-flex">
                  <span className="sr-only">
                    Substituir arquivo selecionado
                  </span>
                  <Input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={busy}
                    className="sr-only"
                    onChange={handleFileChange}
                  />
                  <span className="inline-flex h-9 cursor-pointer items-center rounded-md border border-border bg-surface px-3 text-ui-md font-semibold text-text-primary hover:bg-surface-hover">
                    Substituir
                  </span>
                </label>
                <Button
                  type="button"
                  disabled={inlineMediaState !== "ready"}
                  onClick={onInsert}
                >
                  Inserir imagem
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <label
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
            className="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border-strong bg-surface px-6 text-center transition-colors [transition-duration:var(--motion-duration-normal)] hover:border-primary-border hover:bg-primary-subtle/30"
          >
            <ImageUpIcon className="size-6 text-primary" aria-hidden="true" />
            <span className="mt-3 text-ui-md font-semibold text-text-primary">
              Arraste uma imagem ou selecione um arquivo
            </span>
            <span className="mt-1 text-ui-sm text-text-secondary">
              JPEG, PNG ou WebP · até 10 MB
            </span>
            <Input
              aria-label="Selecionar imagem para o conteúdo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={busy}
              className="sr-only"
              onChange={handleFileChange}
            />
          </label>
        )}

        {inlineMediaState === "uploading" ? (
          <div className="space-y-1.5" role="status">
            <div className="flex items-center justify-between text-ui-sm text-text-secondary">
              <span>Enviando imagem…</span>
              <span className="font-mono">{inlineMediaProgress}%</span>
            </div>
            <progress
              aria-label="Progresso do upload da imagem"
              max={100}
              value={inlineMediaProgress}
              className="h-1.5 w-full"
            />
          </div>
        ) : null}

        {inlineMediaState === "processing" ? (
          <p role="status" className="text-ui-sm text-text-secondary">
            Validando e preparando a imagem para publicação…
          </p>
        ) : null}

        {inlineMediaState === "error" ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-danger-border bg-danger-bg px-3 py-2.5">
            <p role="alert" className="text-ui-sm text-danger">
              {inlineMediaMessage ?? "Não foi possível processar a imagem."}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={onRetry}
              >
                Tentar novamente
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onCancel}
              >
                Remover
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
