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
    selected = true,
    contextValues = {},
  ) {
    const updateAttributes = vi.fn();
    const deleteNode = vi.fn();
    const videoId = "30000000-0000-4000-8000-000000000201";
    const captionsId = "30000000-0000-4000-8000-000000000202";
    const defaultAttrs = {
      mediaId: videoId,
      captionsMediaId: captionsId,
      playbackMode: "manual",
      layout: "normal",
      description: "Vídeo explicativo sobre inovação",
      caption: "Cena do laboratório",
      credit: "Vídeo: NITE",
      ...attrs,
    };

    render(
      <NodeViewContextProvider
        value={{
          mediaById: {
            [videoId]: {
              mediaKind: "video",
              src: "https://media.nite.test/video.mp4",
            },
            [captionsId]: {
              mediaKind: "captions",
              src: "https://media.nite.test/pt-BR.vtt",
            },
          },
          onReplaceVideo: vi.fn(),
          onReplaceCaptions: vi.fn(),
          ...contextValues,
        }}
      >
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

  it("renderiza o vídeo como conteúdo editorial sem expor metadados técnicos", () => {
    const { deleteNode } = renderVideo();

    expect(
      screen.getByLabelText("Vídeo explicativo sobre inovação"),
    ).toHaveAttribute("src", "https://media.nite.test/video.mp4");
    expect(screen.getByText("Cena do laboratório")).toBeInTheDocument();
    expect(screen.getByText("Vídeo: NITE")).toBeInTheDocument();
    expect(screen.queryByText(/ID:/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Remover" }));
    expect(deleteNode).toHaveBeenCalledOnce();
  });

  it("abre opções contextuais e atualiza reprodução e largura", () => {
    const { updateAttributes } = renderVideo();

    fireEvent.click(screen.getByRole("button", { name: "Opções" }));

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

    fireEvent.change(screen.getByLabelText("Reprodução do vídeo selecionado"), {
      target: { value: "autoplay" },
    });
    expect(updateAttributes).toHaveBeenCalledWith({ playbackMode: "autoplay" });

    fireEvent.change(screen.getByLabelText("Largura do vídeo selecionado"), {
      target: { value: "wide" },
    });
    expect(updateAttributes).toHaveBeenCalledWith({ layout: "wide" });
  });

  it("oferece WebVTT como configuração contextual quando ausente", () => {
    renderVideo({ captionsMediaId: null, description: "" });
    fireEvent.click(screen.getByRole("button", { name: "Opções" }));

    expect(
      screen.getByRole("button", { name: "Adicionar WebVTT" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Recomendado para vídeos com áudio."),
    ).toBeInTheDocument();
  });
});
