import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EditorInlineVideoPanel } from "./editor-inline-video-panel";

afterEach(cleanup);

function renderPanel(
  overrides: Partial<Parameters<typeof EditorInlineVideoPanel>[0]> = {},
) {
  const callbacks = {
    onVideoFileSelect: vi.fn(),
    onCaptionsFileSelect: vi.fn(),
    onCancelVideo: vi.fn(),
    onCancelCaptions: vi.fn(),
    onRetryVideo: vi.fn(),
    onRetryCaptions: vi.fn(),
    onPlaybackModeChange: vi.fn(),
    onDescriptionChange: vi.fn(),
    onCaptionChange: vi.fn(),
    onCreditChange: vi.fn(),
    onLayoutChange: vi.fn(),
    onInsert: vi.fn(),
  };
  render(
    <EditorInlineVideoPanel
      videoState="idle"
      videoProgress={0}
      captionsState="idle"
      captionsProgress={0}
      playbackMode="manual"
      description=""
      caption=""
      credit=""
      layout="normal"
      {...callbacks}
      {...overrides}
    />,
  );
  return callbacks;
}

describe("EditorInlineVideoPanel", () => {
  it("informa o limite de 806 px para a largura normal", () => {
    renderPanel();

    expect(
      screen.getByRole("option", { name: "Normal · até 806 px" }),
    ).toBeVisible();
  });

  it("mostra progresso e permite cancelar upload", () => {
    const callbacks = renderPanel({
      videoState: "uploading",
      videoProgress: 42,
    });
    expect(screen.getByLabelText("Progresso do upload do vídeo")).toHaveValue(
      42,
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(callbacks.onCancelVideo).toHaveBeenCalledOnce();
  });

  it("oferece retry após falha", () => {
    const callbacks = renderPanel({
      videoState: "error",
      videoMessage: "Falhou.",
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Tentar vídeo novamente" }),
    );
    expect(callbacks.onRetryVideo).toHaveBeenCalledOnce();
  });

  it("orienta WebVTT para manual com áudio sem bloquear o rascunho", () => {
    renderPanel({
      videoState: "ready",
      hasAudio: true,
      playbackMode: "manual",
    });
    expect(screen.getByText(/Este vídeo contém áudio/u)).toBeVisible();
    expect(screen.getByRole("button", { name: "Inserir vídeo" })).toBeEnabled();
  });

  it("avisa quando autoplay excede 60 segundos", () => {
    renderPanel({
      videoState: "ready",
      playbackMode: "autoplay",
      durationMs: 60_001,
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Autoplay aceita vídeos de até 60 segundos.",
    );
    expect(screen.queryByLabelText("Legenda WebVTT pt-BR")).toBeNull();
  });
});
