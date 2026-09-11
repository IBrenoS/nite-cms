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

const MAX_MP4_BOX_COUNT = 4_096;
const MAX_MP4_BOX_DEPTH = 16;
// 250k cobre cerca de 69 min a 60 fps ou 89 min de AAC 48 kHz/1024.
const MAX_MP4_SAMPLE_COUNT = 250_000;
const containerBoxTypes = new Set([
  "dinf",
  "edts",
  "grpl",
  "hinf",
  "hnti",
  "ipco",
  "ipro",
  "iprp",
  "j2kH",
  "meco",
  "mdia",
  "mfra",
  "minf",
  "moof",
  "moov",
  "mvex",
  "povd",
  "rinf",
  "schi",
  "sinf",
  "stbl",
  "strd",
  "stri",
  "strk",
  "tapt",
  "traf",
  "trak",
  "tref",
  "trgr",
  "udta",
  "vttc",
  "wave",
  "etyp",
]);

function invalidMp4(): Error {
  return new Error("Metadados MP4 inválidos ou incompatíveis.");
}

function readUint32(view: DataView, offset: number, end: number): number {
  if (offset < 0 || offset + 4 > end) throw invalidMp4();
  return view.getUint32(offset);
}

function readUint16(view: DataView, offset: number, end: number): number {
  if (offset < 0 || offset + 2 > end) throw invalidMp4();
  return view.getUint16(offset);
}

function requireCountFits(
  count: number,
  entryByteSize: number,
  entriesOffset: number,
  boxEnd: number,
) {
  if (
    count > MAX_MP4_SAMPLE_COUNT ||
    entryByteSize < 0 ||
    count > Math.floor((boxEnd - entriesOffset) / entryByteSize)
  ) {
    throw invalidMp4();
  }
}

function validateCardinalityBox(
  type: string,
  view: DataView,
  payloadOffset: number,
  boxEnd: number,
) {
  if (payloadOffset >= boxEnd) throw invalidMp4();
  const version = view.getUint8(payloadOffset);
  if (version !== 0 && type !== "trun") return;

  if (type === "stsz") {
    const sampleSize = readUint32(view, payloadOffset + 4, boxEnd);
    const sampleCount = readUint32(view, payloadOffset + 8, boxEnd);
    if (sampleCount > MAX_MP4_SAMPLE_COUNT) throw invalidMp4();
    if (sampleSize === 0) {
      requireCountFits(sampleCount, 4, payloadOffset + 12, boxEnd);
    }
    return;
  }

  if (type === "stz2") {
    if (payloadOffset + 12 > boxEnd) throw invalidMp4();
    const fieldSize = view.getUint8(payloadOffset + 7);
    if (fieldSize !== 4 && fieldSize !== 8 && fieldSize !== 16) {
      throw invalidMp4();
    }
    const sampleCount = readUint32(view, payloadOffset + 8, boxEnd);
    if (sampleCount > MAX_MP4_SAMPLE_COUNT) throw invalidMp4();
    const requiredBytes = Math.ceil((sampleCount * fieldSize) / 8);
    if (requiredBytes > boxEnd - (payloadOffset + 12)) throw invalidMp4();
    return;
  }

  if (type === "stco" || type === "co64") {
    const entryCount = readUint32(view, payloadOffset + 4, boxEnd);
    requireCountFits(
      entryCount,
      type === "stco" ? 4 : 8,
      payloadOffset + 8,
      boxEnd,
    );
    return;
  }

  if (type === "trun") {
    if (payloadOffset + 8 > boxEnd) throw invalidMp4();
    const flags =
      (view.getUint8(payloadOffset + 1) << 16) |
      (view.getUint8(payloadOffset + 2) << 8) |
      view.getUint8(payloadOffset + 3);
    const sampleCount = readUint32(view, payloadOffset + 4, boxEnd);
    if (sampleCount > MAX_MP4_SAMPLE_COUNT) throw invalidMp4();
    const optionalBytes = (flags & 0x1 ? 4 : 0) + (flags & 0x4 ? 4 : 0);
    const perSampleBytes =
      (flags & 0x100 ? 4 : 0) +
      (flags & 0x200 ? 4 : 0) +
      (flags & 0x400 ? 4 : 0) +
      (flags & 0x800 ? 4 : 0);
    const entriesOffset = payloadOffset + 8 + optionalBytes;
    if (entriesOffset > boxEnd) throw invalidMp4();
    if (
      perSampleBytes > 0 &&
      sampleCount > Math.floor((boxEnd - entriesOffset) / perSampleBytes)
    ) {
      throw invalidMp4();
    }
  }
}

function preflightMp4Structure(input: Uint8Array) {
  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  const pending = [{ start: 0, end: input.byteLength, depth: 0 }];
  let boxCount = 0;

  while (pending.length > 0) {
    const range = pending.pop();
    if (!range) break;
    let offset = range.start;
    while (offset < range.end) {
      if (range.end - offset < 8) throw invalidMp4();
      const size32 = readUint32(view, offset, range.end);
      const type = String.fromCharCode(
        view.getUint8(offset + 4),
        view.getUint8(offset + 5),
        view.getUint8(offset + 6),
        view.getUint8(offset + 7),
      );
      if (!/^[\x20-\x7e]{4}$/.test(type)) throw invalidMp4();

      let headerSize = 8;
      let boxSize = size32;
      let headerCursor = offset + 8;
      if (type === "uuid") {
        if (headerCursor + 16 > range.end) throw invalidMp4();
        headerCursor += 16;
        headerSize += 16;
      }
      if (size32 === 1) {
        if (headerCursor + 8 > range.end) throw invalidMp4();
        const extendedSize = view.getBigUint64(headerCursor);
        if (extendedSize > BigInt(Number.MAX_SAFE_INTEGER)) {
          throw invalidMp4();
        }
        headerSize += 8;
        boxSize = Number(extendedSize);
      } else if (size32 === 0) {
        boxSize = range.end - offset;
      }
      if (boxSize < headerSize) throw invalidMp4();
      const boxEnd = offset + boxSize;
      if (!Number.isSafeInteger(boxEnd) || boxEnd > range.end) {
        if (range.depth === 0 && type === "mdat") return;
        throw invalidMp4();
      }

      boxCount += 1;
      if (boxCount > MAX_MP4_BOX_COUNT) throw invalidMp4();
      const payloadOffset = offset + headerSize;
      if (
        type === "stsz" ||
        type === "stz2" ||
        type === "stco" ||
        type === "co64" ||
        type === "trun"
      ) {
        validateCardinalityBox(type, view, payloadOffset, boxEnd);
      }

      if (containerBoxTypes.has(type)) {
        const depth = range.depth + 1;
        if (depth > MAX_MP4_BOX_DEPTH) throw invalidMp4();
        pending.push({ start: payloadOffset, end: boxEnd, depth });
      } else if (type === "stsd") {
        const depth = range.depth + 1;
        if (depth > MAX_MP4_BOX_DEPTH || payloadOffset + 8 > boxEnd) {
          throw invalidMp4();
        }
        pending.push({ start: payloadOffset + 8, end: boxEnd, depth });
      } else if (type === "avc1" || type === "avc3") {
        const depth = range.depth + 1;
        const childOffset = payloadOffset + 78;
        if (depth > MAX_MP4_BOX_DEPTH || childOffset > boxEnd) {
          throw invalidMp4();
        }
        pending.push({ start: childOffset, end: boxEnd, depth });
      } else if (type === "mp4a") {
        const depth = range.depth + 1;
        const version = readUint16(view, payloadOffset + 8, boxEnd);
        const childOffset =
          payloadOffset + 28 + (version === 1 ? 16 : version === 2 ? 36 : 0);
        if (depth > MAX_MP4_BOX_DEPTH || childOffset > boxEnd) {
          throw invalidMp4();
        }
        pending.push({ start: childOffset, end: boxEnd, depth });
      } else if (type === "meta") {
        const depth = range.depth + 1;
        if (depth > MAX_MP4_BOX_DEPTH || payloadOffset + 4 > boxEnd) {
          throw invalidMp4();
        }
        pending.push({ start: payloadOffset + 4, end: boxEnd, depth });
      }
      offset = boxEnd;
    }
  }
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
    (audio !== undefined && !/^mp4a\.40\.[1-9]\d*$/.test(audio.codec))
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
      preflightMp4Structure(input);
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
