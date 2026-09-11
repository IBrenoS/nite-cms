import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { createMp4BoxVideoInspector } from "./mp4box-video-inspector";

type ReadyInfo = Parameters<
  NonNullable<ReturnType<Mp4BoxFileFactory>["onReady"]>
>[0];

type Mp4BoxFileFactory = () => {
  onReady?: (info: {
    isProgressive: boolean;
    duration: number;
    timescale: number;
    videoTracks: Array<{
      codec: string;
      video?: { width: number; height: number };
    }>;
    audioTracks: Array<{ codec: string }>;
  }) => void;
  onError?: (module: string, message: string) => void;
  appendBuffer(buffer: ArrayBuffer & { fileStart: number }): void;
  flush(): void;
};

const validInfo: ReadyInfo = {
  isProgressive: true,
  duration: 24_500,
  timescale: 1_000,
  videoTracks: [{ codec: "avc1.640028", video: { width: 1920, height: 1080 } }],
  audioTracks: [{ codec: "mp4a.40.2" }],
};

function inspectorFor(info: ReadyInfo) {
  return createMp4BoxVideoInspector(() => {
    const file: ReturnType<Mp4BoxFileFactory> = {
      appendBuffer(buffer) {
        expect(buffer.fileStart).toBe(0);
      },
      flush() {
        file.onReady?.(info);
      },
    };
    return file;
  });
}

describe("inspector MP4", () => {
  it("extrai vídeo H.264 fast-start com uma track AAC", async () => {
    await expect(
      inspectorFor(validInfo).inspect(new Uint8Array([1, 2, 3])),
    ).resolves.toEqual({
      durationMs: 24_500,
      width: 1920,
      height: 1080,
      codec: "avc1.640028",
      hasAudio: true,
    });
  });

  it("aceita vídeo longo porque o limite de 60 s pertence ao autoplay editorial", async () => {
    await expect(
      inspectorFor({
        ...validInfo,
        duration: 18 * 60 * 1_000,
      }).inspect(new Uint8Array([1, 2, 3])),
    ).resolves.toMatchObject({ durationMs: 18 * 60 * 1_000 });
  });

  it("aceita avc3 sem áudio", async () => {
    await expect(
      inspectorFor({
        ...validInfo,
        videoTracks: [
          { codec: "avc3.640028", video: { width: 1280, height: 720 } },
        ],
        audioTracks: [],
      }).inspect(new Uint8Array([1, 2, 3])),
    ).resolves.toMatchObject({
      codec: "avc3.640028",
      hasAudio: false,
      width: 1280,
      height: 720,
    });
  });

  it.each([
    ["moov tardio", { ...validInfo, isProgressive: false }],
    ["sem vídeo", { ...validInfo, videoTracks: [] }],
    [
      "vídeos adicionais",
      {
        ...validInfo,
        videoTracks: [...validInfo.videoTracks, ...validInfo.videoTracks],
      },
    ],
    [
      "codec de vídeo incompatível",
      {
        ...validInfo,
        videoTracks: [
          { codec: "hev1.1.6.L93", video: { width: 1920, height: 1080 } },
        ],
      },
    ],
    [
      "áudios adicionais",
      {
        ...validInfo,
        audioTracks: [{ codec: "mp4a.40.2" }, { codec: "mp4a.40.2" }],
      },
    ],
    [
      "codec de áudio incompatível",
      { ...validInfo, audioTracks: [{ codec: "opus" }] },
    ],
    [
      "dimensão inválida",
      {
        ...validInfo,
        videoTracks: [
          { codec: "avc3.640028", video: { width: 0, height: 1080 } },
        ],
      },
    ],
    ["duração inválida", { ...validInfo, duration: 0 }],
    ["escala de tempo inválida", { ...validInfo, timescale: 0 }],
  ])("rejeita %s", async (_case, info) => {
    await expect(
      inspectorFor(info).inspect(new Uint8Array([1, 2, 3])),
    ).rejects.toThrow(/MP4/i);
  });
});
