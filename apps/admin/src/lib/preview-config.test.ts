import { describe, expect, it } from "vitest";

import { readPreviewConfiguration } from "./preview-config";

describe("configuração do preview privado", () => {
  it("classifica variáveis ausentes como pendências obrigatórias", () => {
    expect(readPreviewConfiguration({})).toEqual({
      configured: false,
      issues: [
        { field: "PREVIEW_HMAC_SECRET", reason: "missing" },
        { field: "PORTAL_PREVIEW_URL", reason: "missing" },
      ],
    });
  });

  it.each(["", "   "])(
    "trata URL vazia como configuração ausente sem lançar: %j",
    (portalPreviewUrl) => {
      expect(
        readPreviewConfiguration({
          PREVIEW_HMAC_SECRET: "x".repeat(32),
          PORTAL_PREVIEW_URL: portalPreviewUrl,
        }),
      ).toEqual({
        configured: false,
        issues: [{ field: "PORTAL_PREVIEW_URL", reason: "missing" }],
      });
    },
  );

  it.each(["not-a-url", "http://portal.nite.test/api/preview"])(
    "classifica URL não HTTPS como configuração inválida: %s",
    (portalPreviewUrl) => {
      expect(
        readPreviewConfiguration({
          PREVIEW_HMAC_SECRET: "x".repeat(32),
          PORTAL_PREVIEW_URL: portalPreviewUrl,
        }),
      ).toEqual({
        configured: false,
        issues: [{ field: "PORTAL_PREVIEW_URL", reason: "invalid" }],
      });
    },
  );

  it("classifica secret curto como configuração inválida sem expor valores", () => {
    const secret = "private-short-secret";
    expect(
      readPreviewConfiguration({
        PREVIEW_HMAC_SECRET: secret,
        PORTAL_PREVIEW_URL: "https://portal.nite.test/api/preview",
      }),
    ).toEqual({
      configured: false,
      issues: [{ field: "PREVIEW_HMAC_SECRET", reason: "invalid" }],
    });
    expect(
      JSON.stringify(
        readPreviewConfiguration({
          PREVIEW_HMAC_SECRET: secret,
          PORTAL_PREVIEW_URL: "https://portal.nite.test/api/preview",
        }),
      ),
    ).not.toContain(secret);
  });

  it("aceita apenas uma configuração completa", () => {
    expect(
      readPreviewConfiguration({
        PREVIEW_HMAC_SECRET: "x".repeat(32),
        PORTAL_PREVIEW_URL: "  https://portal.nite.test/api/preview  ",
      }),
    ).toEqual({
      configured: true,
      configuration: {
        hmacSecret: "x".repeat(32),
        portalPreviewUrl: "https://portal.nite.test/api/preview",
      },
    });
  });
});
