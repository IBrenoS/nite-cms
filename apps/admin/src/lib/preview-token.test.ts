import { describe, expect, it } from "vitest";

import {
  PreviewTokenError,
  issuePreviewToken,
  verifyPreviewToken,
} from "./preview-token";

const secret = "preview-secret-for-deterministic-tests-only";
const claims = {
  articleId: "10000000-0000-4000-8000-000000000001",
  revisionId: "20000000-0000-4000-8000-000000000001",
};

describe("token privado de preview", () => {
  it("emite e valida uma revisão exata por até dez minutos", () => {
    const now = new Date("2026-08-29T12:00:00.000Z");
    const token = issuePreviewToken(claims, secret, now);

    expect(verifyPreviewToken(token, secret, now)).toMatchObject({
      version: 1,
      ...claims,
      expiresAt: now.getTime() + 10 * 60 * 1000,
    });
  });

  it("recusa token adulterado ou expirado", () => {
    const now = new Date("2026-08-29T12:00:00.000Z");
    const token = issuePreviewToken(claims, secret, now);

    expect(() => verifyPreviewToken(`${token}x`, secret, now)).toThrow(
      PreviewTokenError,
    );
    expect(() =>
      verifyPreviewToken(
        token,
        secret,
        new Date(now.getTime() + 10 * 60 * 1000),
      ),
    ).toThrow(PreviewTokenError);
  });
});
