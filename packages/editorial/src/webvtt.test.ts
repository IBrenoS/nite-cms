import { describe, expect, it } from "vitest";

import { parseAndNormalizeWebVtt } from "@nite/editorial";

const encode = (value: string) => new TextEncoder().encode(value);

describe("WebVTT editorial", () => {
  it("aceita BOM, normaliza quebras para LF e calcula o hash normalizado", () => {
    const input = encode(
      "\uFEFFWEBVTT\r\n\r\n00:00.000 --> 00:01.000\r\nOlá\r\n",
    );

    const result = parseAndNormalizeWebVtt(input);

    expect(new TextDecoder().decode(result.body)).toBe(
      "WEBVTT\n\n00:00.000 --> 00:01.000\nOlá\n",
    );
    expect(result.checksumSha256).toBe(
      "205ee04138d423901b81ac73b6cc416c0b75bad9a8bb6b2ff1c8086a90a7852d",
    );
  });

  it("aceita identificador, horas e cues adjacentes em ordem", () => {
    expect(() =>
      parseAndNormalizeWebVtt(
        encode(
          [
            "WEBVTT",
            "",
            "primeiro",
            "00:00.000 --> 00:01.500 align:start",
            "Primeira legenda",
            "",
            "01:02:03.004 --> 01:02:04.005",
            "Segunda legenda",
          ].join("\n"),
        ),
      ),
    ).not.toThrow();
  });

  it.each([
    ["sem cabeçalho", "00:00.000 --> 00:01.000\nTexto"],
    ["sem cue", "WEBVTT\n\nNOTE apenas comentário"],
    ["timestamp incompleto", "WEBVTT\n\n0:00.000 --> 00:01.000\nTexto"],
    ["minuto inválido", "WEBVTT\n\n60:00.000 --> 60:01.000\nTexto"],
    ["fim igual ao início", "WEBVTT\n\n00:01.000 --> 00:01.000\nTexto"],
    [
      "sobreposição",
      "WEBVTT\n\n00:00.000 --> 00:02.000\nUm\n\n00:01.999 --> 00:03.000\nDois",
    ],
    ["texto vazio", "WEBVTT\n\n00:00.000 --> 00:01.000\n   "],
  ])("rejeita %s", (_case, value) => {
    expect(() => parseAndNormalizeWebVtt(encode(value))).toThrow(/WebVTT/i);
  });

  it("rejeita bytes que não formam UTF-8 válido", () => {
    expect(() =>
      parseAndNormalizeWebVtt(new Uint8Array([0x57, 0x45, 0x42, 0x80])),
    ).toThrow(/WebVTT/i);
  });
});
