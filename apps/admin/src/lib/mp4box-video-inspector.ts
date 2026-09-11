import "server-only";

import { createFile, MP4BoxBuffer, type Movie } from "mp4box";

import type { VideoInspector } from "@nite/editorial";

type Mp4BoxFile = {
  onReady?: (info: Movie) => void;
  onError?: (module: string, message: string) => void;
  appendBuffer(buffer: ArrayBuffer & { fileStart: number }): unknown;
  flush(): void;
};

type Mp4BoxFileFactory = () => Mp4BoxFile;

function invalidMp4(): Error {
  return new Error("Metadados MP4 inválidos ou incompatíveis.");
}

function readVideoMetadata(info: Movie) {
  if (!info.isProgressive || info.videoTracks.length !== 1) {
    throw invalidMp4();
  }
  if (info.audioTracks.length > 1) throw invalidMp4();

  const video = info.videoTracks[0];
  const audio = info.audioTracks[0];
  const width = video?.video?.width;
  const height = video?.video?.height;
  const durationMs = (info.duration * 1000) / info.timescale;
  if (
    !video ||
    (!video.codec.startsWith("avc1") && !video.codec.startsWith("avc3")) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    !width ||
    width < 1 ||
    !height ||
    height < 1 ||
    !Number.isFinite(durationMs) ||
    durationMs <= 0 ||
    !Number.isFinite(info.timescale) ||
    info.timescale <= 0 ||
    (audio !== undefined && !audio.codec.startsWith("mp4a"))
  ) {
    throw invalidMp4();
  }

  return {
    durationMs: Math.round(durationMs),
    width: Math.round(width),
    height: Math.round(height),
    codec: video.codec,
    hasAudio: audio !== undefined,
  };
}

export function createMp4BoxVideoInspector(
  createMp4File: Mp4BoxFileFactory = createFile,
): VideoInspector {
  return {
    async inspect(input) {
      return new Promise((resolve, reject) => {
        const file = createMp4File();
        let settled = false;
        file.onReady = (info) => {
          settled = true;
          try {
            resolve(readVideoMetadata(info));
          } catch (error) {
            reject(error);
          }
        };
        file.onError = (_module, message) => {
          settled = true;
          reject(new Error(`Falha ao analisar MP4: ${message}`));
        };

        const buffer = MP4BoxBuffer.fromArrayBuffer(
          input.buffer.slice(
            input.byteOffset,
            input.byteOffset + input.byteLength,
          ),
          0,
        );
        try {
          file.appendBuffer(buffer);
          file.flush();
          if (!settled) reject(invalidMp4());
        } catch (error) {
          reject(error instanceof Error ? error : invalidMp4());
        }
      });
    },
  };
}

export const mp4BoxVideoInspector = createMp4BoxVideoInspector();
