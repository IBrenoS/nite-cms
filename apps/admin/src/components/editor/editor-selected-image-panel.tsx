"use client";

import type { Editor } from "@tiptap/react";
import { Button, Input } from "@nite/cms-ui";

type SelectedImage = {
  alt: string;
  caption: string;
  credit: string;
  layout: "normal" | "wide" | "full";
};

export function EditorSelectedImagePanel({
  editor,
  image,
}: {
  editor: Editor;
  image: SelectedImage;
}) {
  function update(attrs: Partial<SelectedImage>) {
    editor.chain().focus().updateAttributes("image", attrs).run();
  }

  return (
    <section
      className="grid gap-2.5 border-b border-nite-border-subtle bg-blue-50/60 p-3.5 sm:grid-cols-2"
      aria-labelledby="selected-image-title"
    >
      <h3
        id="selected-image-title"
        className="sm:col-span-2 text-xs font-semibold text-nite-text-primary"
      >
        Editar imagem interna
      </h3>
      <Input
        aria-label="Alt da imagem selecionada"
        value={image.alt}
        onChange={(event) => update({ alt: event.target.value })}
      />
      <Input
        aria-label="Legenda da imagem selecionada"
        value={image.caption}
        maxLength={280}
        onChange={(event) => update({ caption: event.target.value })}
      />
      <Input
        aria-label="Crédito da imagem selecionada"
        value={image.credit}
        maxLength={160}
        onChange={(event) => update({ credit: event.target.value })}
      />
      <label className="text-xs font-semibold text-nite-text-primary">
        Largura da imagem selecionada
        <select
          value={image.layout}
          onChange={(event) =>
            update({ layout: event.target.value as SelectedImage["layout"] })
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
        variant="quiet"
        size="sm"
        aria-label="Remover imagem do conteúdo"
        className="sm:col-span-2 justify-self-start text-status-error"
        onClick={() => editor.chain().focus().deleteSelection().run()}
      >
        Remover imagem
      </Button>
    </section>
  );
}
