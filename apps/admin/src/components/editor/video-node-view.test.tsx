import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VideoNodeView } from "./video-node-view";
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

describe("VideoNodeView", () => {
  afterEach(cleanup);

  function renderVideo(
    attrs: Record<string, unknown> = {},
    selected = false,
    contextValues = {},
  ) {
    const updateAttributes = vi.fn();
    const deleteNode = vi.fn();
    const defaultAttrs = {
      mediaId: "30000000-0000-4000-8000-000000000201",
      captionsMediaId: "30000000-0000-4000-8000-000000000202",
      playbackMode: "manual",
      layout: "normal",
      description: "Vídeo explicativo sobre inovação",
      caption: "Cena do laboratório",
      credit: "Vídeo: NITE",
      ...attrs,
    };

    render(
      <NodeViewContextProvider value={contextValues}>
        <VideoNodeView
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

  it("renderiza representação visual rica com metadados, badges e ações", () => {
    const { deleteNode } = renderVideo();

    expect(screen.getByText("Vídeo inserido")).toBeInTheDocument();
    expect(screen.getByText("Reprodução manual")).toBeInTheDocument();
    expect(screen.getByText("Largura normal")).toBeInTheDocument();
    expect(screen.getByText("WebVTT pt-BR presente")).toBeInTheDocument();
    expect(
      screen.getByText(/Vídeo explicativo sobre inovação/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Cena do laboratório/)).toBeInTheDocument();
    expect(screen.getByText(/Vídeo: NITE/)).toBeInTheDocument();

    const editBtn = screen.getByRole("button", { name: "Editar" });
    expect(editBtn).toBeInTheDocument();

    const removeBtn = screen.getByRole("button", {
      name: "Remover vídeo do conteúdo",
    });
    fireEvent.click(removeBtn);
    expect(deleteNode).toHaveBeenCalledOnce();
  });

  it("abre edição contextual in-place com rótulos visíveis e atualiza atributos", () => {
    const { updateAttributes } = renderVideo();

    fireEvent.click(screen.getByRole("button", { name: "Editar" }));

    expect(
      screen.getByRole("heading", { name: "Editar vídeo interno" }),
    ).toBeInTheDocument();

    // Rótulos visíveis
    expect(
      screen.getByLabelText("Reprodução do vídeo selecionado"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Largura do vídeo selecionado"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Descrição do vídeo selecionado")).toHaveValue(
      "Vídeo explicativo sobre inovação",
    );
    expect(screen.getByLabelText("Legenda do vídeo selecionado")).toHaveValue(
      "Cena do laboratório",
    );
    expect(screen.getByLabelText("Crédito do vídeo selecionado")).toHaveValue(
      "Vídeo: NITE",
    );
    expect(
      screen.getByLabelText("Substituir vídeo selecionado"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Substituir legenda do vídeo selecionado"),
    ).toBeInTheDocument();

    // Atualização de atributos
    fireEvent.change(screen.getByLabelText("Reprodução do vídeo selecionado"), {
      target: { value: "autoplay" },
    });
    expect(updateAttributes).toHaveBeenCalledWith({ playbackMode: "autoplay" });

    fireEvent.change(screen.getByLabelText("Largura do vídeo selecionado"), {
      target: { value: "wide" },
    });
    expect(updateAttributes).toHaveBeenCalledWith({ layout: "wide" });
  });

  it("informa ausência de WebVTT e descrição quando não preenchidos", () => {
    renderVideo({
      captionsMediaId: null,
      description: "",
      caption: "",
      credit: "",
    });

    expect(screen.getByText("Sem legenda WebVTT")).toBeInTheDocument();
    expect(
      screen.getByText(/Sem descrição acessível informada/i),
    ).toBeInTheDocument();
  });
});
