import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ImageNodeView } from "./image-node-view";
import { NodeViewContextProvider } from "./node-view-context";

vi.mock("@tiptap/react", () => ({
  NodeViewWrapper: ({
    children,
    className,
    as: Component = "div",
    ...rest
  }: {
    children?: React.ReactNode;
    className?: string;
    as?: React.ElementType;
    [key: string]: unknown;
  }) => (
    <Component className={className} {...rest}>
      {children}
    </Component>
  ),
}));

vi.mock("next/image", () => ({
  default: ({ alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} {...props} />
  ),
}));

describe("ImageNodeView", () => {
  afterEach(cleanup);

  function renderImage(attrs: Record<string, unknown> = {}, selected = true) {
    const updateAttributes = vi.fn();
    const deleteNode = vi.fn();
    const mediaId = "30000000-0000-4000-8000-000000000101";
    const defaultAttrs = {
      mediaId,
      alt: "Pessoas no laboratório de inovação",
      caption: "Equipe reunida durante o workshop",
      credit: "Foto: NITE",
      layout: "normal",
      ...attrs,
    };

    render(
      <NodeViewContextProvider
        value={{
          mediaById: {
            [mediaId]: {
              mediaKind: "image",
              src: "https://media.nite.test/noticia.webp",
              width: 1280,
              height: 720,
            },
          },
          onReplaceImage: vi.fn(),
        }}
      >
        <ImageNodeView
          editor={null as never}
          node={{ attrs: defaultAttrs } as never}
          selected={selected}
          updateAttributes={updateAttributes}
          deleteNode={deleteNode}
          decorations={[]}
          extension={null as never}
          getPos={() => 0}
          view={null as never}
          innerDecorations={null as never}
          HTMLAttributes={null as never}
        />
      </NodeViewContextProvider>,
    );

    return { updateAttributes, deleteNode };
  }

  it("renderiza a mídia como conteúdo editorial e oferece ações contextuais", () => {
    const { deleteNode } = renderImage();

    expect(
      screen.getByRole("img", { name: "Pessoas no laboratório de inovação" }),
    ).toHaveAttribute("src", "https://media.nite.test/noticia.webp");
    expect(
      screen.getByText("Equipe reunida durante o workshop"),
    ).toBeInTheDocument();
    expect(screen.getByText("Foto: NITE")).toBeInTheDocument();
    expect(screen.queryByText(/ID:/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Remover" }));
    expect(deleteNode).toHaveBeenCalledOnce();
  });

  it("abre detalhes contextuais e atualiza atributos", () => {
    const { updateAttributes } = renderImage();

    fireEvent.click(screen.getByRole("button", { name: "Detalhes" }));

    expect(screen.getByLabelText("Alt da imagem selecionada")).toHaveValue(
      "Pessoas no laboratório de inovação",
    );
    expect(screen.getByLabelText("Legenda da imagem selecionada")).toHaveValue(
      "Equipe reunida durante o workshop",
    );
    expect(screen.getByLabelText("Crédito da imagem selecionada")).toHaveValue(
      "Foto: NITE",
    );
    expect(screen.getByLabelText("Largura da imagem selecionada")).toHaveValue(
      "normal",
    );

    fireEvent.change(screen.getByLabelText("Largura da imagem selecionada"), {
      target: { value: "wide" },
    });
    expect(updateAttributes).toHaveBeenCalledWith({ layout: "wide" });
  });

  it("mantém o texto alternativo editável quando ainda está vazio", () => {
    renderImage({ alt: "" });
    fireEvent.click(screen.getByRole("button", { name: "Detalhes" }));

    expect(screen.getByLabelText("Alt da imagem selecionada")).toHaveValue("");
    expect(
      screen.getByText("Necessário para leitores de tela e acessibilidade."),
    ).toBeInTheDocument();
  });
});
