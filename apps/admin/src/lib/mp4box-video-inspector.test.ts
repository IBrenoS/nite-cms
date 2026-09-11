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

function concatenate(
  ...parts: Uint8Array<ArrayBufferLike>[]
): Uint8Array<ArrayBuffer> {
  const output = new Uint8Array(
    parts.reduce((byteLength, part) => byteLength + part.byteLength, 0),
  );
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}

function uint32(value: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value);
  return bytes;
}

function uint64(value: bigint): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setBigUint64(0, value);
  return bytes;
}

function box(
  type: string,
  payload: Uint8Array<ArrayBufferLike> = new Uint8Array(),
): Uint8Array<ArrayBuffer> {
  return concatenate(
    uint32(8 + payload.byteLength),
    new TextEncoder().encode(type),
    payload,
  );
}

function fullBox(
  type: string,
  payload: Uint8Array<ArrayBufferLike>,
): Uint8Array<ArrayBuffer> {
  return box(type, concatenate(uint32(0), payload));
}

const safeInspectionBytes = concatenate(
  box("ftyp", concatenate(new TextEncoder().encode("isom"), uint32(0))),
  box(
    "moov",
    box(
      "trak",
      box(
        "mdia",
        box(
          "minf",
          box("stbl", fullBox("stsz", concatenate(uint32(1), uint32(64_800)))),
        ),
      ),
    ),
  ),
);

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
      inspectorFor(validInfo).inspect(safeInspectionBytes),
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
      }).inspect(safeInspectionBytes),
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
      }).inspect(safeInspectionBytes),
    ).resolves.toMatchObject({
      codec: "avc3.640028",
      hasAudio: false,
      width: 1280,
      height: 720,
    });
  });

  it("aceita box UUID com tamanho estendido estruturalmente válido", async () => {
    const uuidBox = concatenate(
      uint32(1),
      new TextEncoder().encode("uuid"),
      new Uint8Array(16),
      uint64(32n),
    );

    await expect(
      inspectorFor(validInfo).inspect(uuidBox),
    ).resolves.toMatchObject({ codec: "avc1.640028" });
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
      "mp4a sem object type",
      { ...validInfo, audioTracks: [{ codec: "mp4a" }] },
    ],
    [
      "mp4a com object type não AAC",
      { ...validInfo, audioTracks: [{ codec: "mp4a.69" }] },
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
      inspectorFor(info).inspect(safeInspectionBytes),
    ).rejects.toThrow(/MP4/i);
  });

  it.each([
    ["stsz", fullBox("stsz", concatenate(uint32(1), uint32(1_000_000)))],
    [
      "stsz aninhado em avc1",
      fullBox(
        "stsd",
        concatenate(
          uint32(1),
          box(
            "avc1",
            concatenate(
              new Uint8Array(78),
              fullBox("stsz", concatenate(uint32(1), uint32(1_000_000))),
            ),
          ),
        ),
      ),
    ],
    [
      "stz2",
      fullBox(
        "stz2",
        concatenate(new Uint8Array([0, 0, 0, 8]), uint32(1_000_000)),
      ),
    ],
    ["stco", fullBox("stco", uint32(1_000_000))],
    ["co64", fullBox("co64", uint32(1_000_000))],
    ["trun", fullBox("trun", uint32(1_000_000))],
  ])(
    "rejeita cardinalidade perigosa em %s antes de criar o parser",
    async (_type, maliciousBox) => {
      const createMp4File = vi.fn(() => {
        throw new Error("mp4box não deve receber estrutura perigosa");
      });

      await expect(
        createMp4BoxVideoInspector(createMp4File).inspect(maliciousBox),
      ).rejects.toThrow(/MP4/i);
      expect(createMp4File).not.toHaveBeenCalled();
    },
  );

  it.each([
    [
      "profundidade excessiva",
      Array.from({ length: 17 }).reduce<Uint8Array>(
        (child) => box("moov", child),
        box("free"),
      ),
    ],
    [
      "quantidade excessiva de boxes",
      concatenate(...Array.from({ length: 4_097 }, () => box("free"))),
    ],
    [
      "box filho maior que o pai",
      box("moov", concatenate(uint32(100), new TextEncoder().encode("free"))),
    ],
  ])("rejeita %s antes de criar o parser", async (_case, input) => {
    const createMp4File = vi.fn(() => {
      throw new Error("mp4box não deve receber estrutura perigosa");
    });

    await expect(
      createMp4BoxVideoInspector(createMp4File).inspect(input),
    ).rejects.toThrow(/MP4/i);
    expect(createMp4File).not.toHaveBeenCalled();
  });
});
