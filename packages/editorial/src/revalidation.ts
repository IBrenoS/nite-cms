import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const newsRevalidationPayloadSchema = z.object({
  eventId: z.uuid(),
  topic: z.literal("news.article.published"),
  articleId: z.uuid(),
  revisionId: z.uuid(),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

export type NewsRevalidationPayload = z.infer<
  typeof newsRevalidationPayloadSchema
>;

export function createRevalidationSignature(input: {
  body: string;
  timestamp: string;
  secret: string;
}) {
  const timestamp = z
    .string()
    .regex(/^\d{10}$/)
    .parse(input.timestamp);
  const secret = z.string().min(32).parse(input.secret);
  return createHmac("sha256", secret)
    .update(`${timestamp}.${input.body}`)
    .digest("hex");
}

export function verifyRevalidationSignature(input: {
  body: string;
  timestamp: string;
  signature: string;
  secret: string;
  now?: Date;
  toleranceSeconds?: number;
}) {
  const parsed = z
    .object({
      timestamp: z.string().regex(/^\d{10}$/),
      signature: z.string().regex(/^[a-f0-9]{64}$/),
      secret: z.string().min(32),
      toleranceSeconds: z.number().int().min(1).max(900),
    })
    .safeParse({
      timestamp: input.timestamp,
      signature: input.signature,
      secret: input.secret,
      toleranceSeconds: input.toleranceSeconds ?? 300,
    });
  if (!parsed.success) return false;

  const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1000);
  if (
    Math.abs(nowSeconds - Number(parsed.data.timestamp)) >
    parsed.data.toleranceSeconds
  ) {
    return false;
  }

  const expected = createRevalidationSignature({
    body: input.body,
    timestamp: parsed.data.timestamp,
    secret: parsed.data.secret,
  });
  return timingSafeEqual(
    Buffer.from(parsed.data.signature, "hex"),
    Buffer.from(expected, "hex"),
  );
}
