import { createHash } from "node:crypto";

const timestampPattern = /^(?:(\d{2,}):)?([0-5]\d):([0-5]\d)\.(\d{3})$/;
const timingPattern = /^(\S+)\s+-->\s+(\S+)(?:[ \t]+.*)?$/;

function invalidWebVtt(): Error {
  return new Error("Arquivo WebVTT inválido.");
}

function parseTimestamp(value: string): number {
  const match = timestampPattern.exec(value);
  if (!match) throw invalidWebVtt();
  const [, hours = "0", minutes, seconds, milliseconds] = match;
  return (
    Number(hours) * 3_600_000 +
    Number(minutes) * 60_000 +
    Number(seconds) * 1_000 +
    Number(milliseconds)
  );
}

export function parseAndNormalizeWebVtt(input: Uint8Array): {
  body: Uint8Array;
  checksumSha256: string;
} {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(input);
  } catch {
    throw invalidWebVtt();
  }
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const blocks = normalized.split(/\n{2,}/);
  if (!/^WEBVTT(?:[ \t].*)?(?:\n|$)/.test(blocks[0] ?? "")) {
    throw invalidWebVtt();
  }

  let cueCount = 0;
  let previousEnd = 0;
  for (const block of blocks.slice(1)) {
    const lines = block.split("\n");
    const firstLine = lines[0]?.trim() ?? "";
    if (
      firstLine === "" ||
      /^(?:NOTE|STYLE|REGION)(?:[ \t]|$)/.test(firstLine)
    ) {
      continue;
    }
    const timingLineIndex = firstLine.includes("-->") ? 0 : 1;
    const timingLine = lines[timingLineIndex]?.trim();
    const match = timingLine ? timingPattern.exec(timingLine) : null;
    if (!match) throw invalidWebVtt();
    const start = parseTimestamp(match[1]);
    const end = parseTimestamp(match[2]);
    if (start >= end || start < previousEnd) throw invalidWebVtt();
    const cueText = lines
      .slice(timingLineIndex + 1)
      .join("\n")
      .trim();
    if (!cueText) throw invalidWebVtt();
    previousEnd = end;
    cueCount += 1;
  }
  if (cueCount === 0) throw invalidWebVtt();

  const body = new TextEncoder().encode(normalized);
  return {
    body,
    checksumSha256: createHash("sha256").update(body).digest("hex"),
  };
}
