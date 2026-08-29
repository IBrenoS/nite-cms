import { describe, expect, it } from "vitest";

import { readPreviewConfiguration } from "./preview-config";

describe("configuração do preview privado", () => {
  it("exige secret do Admin e URL HTTPS do Portal", () => {
    expect(readPreviewConfiguration({})).toEqual({
      configured: false,
      missing: ["PREVIEW_HMAC_SECRET", "PORTAL_PREVIEW_URL"],
    });
    expect(
      readPreviewConfiguration({
        PREVIEW_HMAC_SECRET: "short",
        PORTAL_PREVIEW_URL: "http://portal.nite.test",
      }),
    ).toEqual({
      configured: false,
      missing: ["PREVIEW_HMAC_SECRET", "PORTAL_PREVIEW_URL"],
    });
  });

  it("aceita apenas uma configuração completa", () => {
    expect(
      readPreviewConfiguration({
        PREVIEW_HMAC_SECRET: "x".repeat(32),
        PORTAL_PREVIEW_URL: "https://portal.nite.test/preview",
      }),
    ).toEqual({
      configured: true,
      configuration: {
        hmacSecret: "x".repeat(32),
        portalPreviewUrl: "https://portal.nite.test/preview",
      },
    });
  });
});
