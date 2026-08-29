import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { z } from "zod";

// Tokens devem expirar em até dez minutos a partir do relógio que os valida.
const PREVIEW_DURATION_MILLISECONDS = 10 * 60 * 1000;

const previewClaimsSchema = z
  .object({
    version: z.literal(1),
    articleId: z.uuid(),
    revisionId: z.uuid(),
    expiresAt: z.number().int().positive(),
    nonce: z.string().regex(/^[A-Za-z0-9_-]{22}$/),
  })
  .strict();

type PreviewClaims = z.infer<typeof previewClaimsSchema>;

export class PreviewTokenError extends Error {
  constructor() {
    super("Token de preview inválido ou expirado.");
    this.name = "PreviewTokenError";
  }
}

function signature(input: string, secret: string) {
  return createHmac("sha256", secret).update(input).digest("base64url");
}

export function issuePreviewToken(
  input: Pick<PreviewClaims, "articleId" | "revisionId">,
  secret: string,
  now = new Date(),
) {
  const claims = previewClaimsSchema.parse({
    version: 1,
    ...input,
    expiresAt: now.getTime() + PREVIEW_DURATION_MILLISECONDS,
    nonce: randomBytes(16).toString("base64url"),
  });
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const inputToSign = `v1.${payload}`;
  return `${inputToSign}.${signature(inputToSign, secret)}`;
}

export function verifyPreviewToken(
  token: string,
  secret: string,
  now = new Date(),
) {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") throw new PreviewTokenError();

  const [version, payload, suppliedSignature] = parts;
  const expectedSignature = signature(`${version}.${payload}`, secret);
  const supplied = Buffer.from(suppliedSignature, "utf8");
  const expected = Buffer.from(expectedSignature, "utf8");
  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  ) {
    throw new PreviewTokenError();
  }

  try {
    const claims = previewClaimsSchema.parse(
      JSON.parse(Buffer.from(payload, "base64url").toString("utf8")),
    );
    if (
      claims.expiresAt <= now.getTime() ||
      claims.expiresAt > now.getTime() + PREVIEW_DURATION_MILLISECONDS
    ) {
      throw new PreviewTokenError();
    }
    return claims;
  } catch (error) {
    if (error instanceof PreviewTokenError) throw error;
    throw new PreviewTokenError();
  }
}
