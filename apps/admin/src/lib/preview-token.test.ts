import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";

import {
  PreviewTokenError,
  issuePreviewSnapshotToken,
  issuePreviewToken,
  verifyPreviewToken,
} from "./preview-token";

const secret = "preview-secret-for-deterministic-tests-only";
const claims = {
  articleId: "10000000-0000-4000-8000-000000000001",
  revisionId: "20000000-0000-4000-8000-000000000001",
};
const snapshotClaims = {
  articleId: claims.articleId,
  snapshotId: "40000000-0000-4000-8000-000000000001",
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

  it("emite e valida um snapshot transitório sem fingir que ele é uma revisão", () => {
    const now = new Date("2026-08-29T12:00:00.000Z");
    const token = issuePreviewSnapshotToken(snapshotClaims, secret, now);

    expect(verifyPreviewToken(token, secret, now)).toMatchObject({
      version: 2,
      ...snapshotClaims,
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

  it("recusa token v2 assinado por uma chave divergente", () => {
    const now = new Date("2026-08-29T12:00:00.000Z");
    const token = issuePreviewSnapshotToken(
      snapshotClaims,
      "outra-chave-de-preview-com-32-caracteres",
      now,
    );

    expect(() => verifyPreviewToken(token, secret, now)).toThrow(
      PreviewTokenError,
    );
  });

  it("recusa token corretamente assinado com expiração acima do TTL", () => {
    const now = new Date("2026-08-29T12:00:00.000Z");
    const payload = Buffer.from(
      JSON.stringify({
        version: 1,
        ...claims,
        expiresAt: now.getTime() + 10 * 60 * 1000 + 1,
        nonce: "abcdefghijklmnopqrstuv",
      }),
    ).toString("base64url");
    const signed = `v1.${payload}`;
    const token = `${signed}.${createHmac("sha256", secret).update(signed).digest("base64url")}`;

    expect(() => verifyPreviewToken(token, secret, now)).toThrow(
      PreviewTokenError,
    );
  });
});
