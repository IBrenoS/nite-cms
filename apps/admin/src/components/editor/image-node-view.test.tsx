import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ImageNodeView } from "./image-node-view";

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

describe("ImageNodeView", () => {
  afterEach(cleanup);

  function renderImage(attrs: Record<string, unknown> = {}, selected = false) {
    const updateAttributes = vi.fn();
    const deleteNode = vi.fn();
    const defaultAttrs = {
      mediaId: "30000000-0000-4000-8000-000000000101",
      alt: "Pessoas no laboratório de inovação",
      caption: "Equipe reunida durante o workshop",
      credit: "Foto: NITE",
      layout: "normal",
      ...attrs,
    };

    render(
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
      />,
    );

    return { updateAttributes, deleteNode };
  }

  it("renderiza representação visual com dados informativos e ações", () => {
    const { deleteNode } = renderImage();

    expect(screen.getByText("Imagem inserida")).toBeInTheDocument();
    expect(screen.getByText("Largura normal")).toBeInTheDocument();
    expect(screen.getByText("Texto alternativo presente")).toBeInTheDocument();
    expect(
      screen.getByText(/Pessoas no laboratório de inovação/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Equipe reunida durante o workshop/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Foto: NITE/)).toBeInTheDocument();

    const removeBtn = screen.getByRole("button", {
      name: "Remover imagem do conteúdo",
    });
    fireEvent.click(removeBtn);
    expect(deleteNode).toHaveBeenCalledOnce();
  });

  it("abre edição contextual in-place com rótulos visíveis e atualiza atributos", () => {
    const { updateAttributes } = renderImage();

    fireEvent.click(screen.getByRole("button", { name: "Editar" }));

    expect(
      screen.getByRole("heading", { name: "Editar imagem interna" }),
    ).toBeInTheDocument();

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

  it("informa ausência de texto alternativo quando vazio", () => {
    renderImage({ alt: "" });

    expect(screen.getByText("Alt ausente")).toBeInTheDocument();
    expect(screen.getByText(/Sem texto alternativo/i)).toBeInTheDocument();
  });
});
