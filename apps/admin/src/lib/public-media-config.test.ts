import { matchRemotePattern } from "next/dist/shared/lib/match-remote-pattern";
import { describe, expect, it } from "vitest";

import { readPublicMediaConfiguration } from "./public-media-config";

describe("configuração de mídia pública do Admin", () => {
  it.each([undefined, "", "   "])(
    "mantém mídia desconfigurada quando a variável está ausente ou vazia",
    (value) => {
      expect(
        readPublicMediaConfiguration({ R2_PUBLIC_BASE_URL: value }),
      ).toEqual({ configured: false });
    },
  );

  it("permite qualquer objeto abaixo da raiz configurada", () => {
    const result = readPublicMediaConfiguration({
      R2_PUBLIC_BASE_URL: "https://media.nite.test/",
    });

    expect(result).toEqual({
      configured: true,
      baseUrl: "https://media.nite.test/",
      remotePattern: {
        protocol: "https",
        hostname: "media.nite.test",
        port: "",
        pathname: "/**",
        search: "",
      },
    });
    if (!result.configured) throw new Error("Configuração não reconhecida.");
    expect(
      matchRemotePattern(
        result.remotePattern,
        new URL("https://media.nite.test/news/article/cover.webp"),
      ),
    ).toBe(true);
  });

  it.each(["https://media.nite.test/media", "https://media.nite.test/media/"])(
    "preserva e normaliza o prefixo da URL-base: %s",
    (baseUrl) => {
      const result = readPublicMediaConfiguration({
        R2_PUBLIC_BASE_URL: baseUrl,
      });

      expect(result).toMatchObject({
        configured: true,
        baseUrl: "https://media.nite.test/media/",
        remotePattern: { pathname: "/media/**" },
      });
      if (!result.configured) throw new Error("Configuração não reconhecida.");
      expect(
        matchRemotePattern(
          result.remotePattern,
          new URL("https://media.nite.test/media/news/cover.webp"),
        ),
      ).toBe(true);
      expect(
        matchRemotePattern(
          result.remotePattern,
          new URL("https://media.nite.test/private/cover.webp"),
        ),
      ).toBe(false);
    },
  );

  it.each([
    "not-a-url",
    "ftp://media.nite.test/",
    "https://user:private@media.nite.test/",
    "https://media.nite.test/?token=private",
    "https://media.nite.test/#private",
  ])("rejeita uma URL-base inválida sem expor seu valor: %s", (baseUrl) => {
    let failure: unknown;
    try {
      readPublicMediaConfiguration({ R2_PUBLIC_BASE_URL: baseUrl });
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toBe(
      "Configuração inválida: R2_PUBLIC_BASE_URL.",
    );
    expect((failure as Error).message).not.toContain(baseUrl);
    expect((failure as Error).message).not.toContain("private");
  });
});
