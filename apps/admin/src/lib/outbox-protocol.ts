import { createHash, timingSafeEqual } from "node:crypto";

import { z } from "zod";

type EnvironmentSource = Readonly<Record<string, string | undefined>>;

export function readOutboxConfiguration(environment: EnvironmentSource) {
  const databaseUrl = z.url().safeParse(environment.DATABASE_ADMIN_URL);
  if (!databaseUrl.success) {
    return { configured: false as const, missing: ["DATABASE_ADMIN_URL"] };
  }
  return {
    configured: true as const,
    configuration: { databaseUrl: databaseUrl.data },
  };
}

export function verifyCronAuthorization(
  authorization: string | null,
  secret: string | undefined,
) {
  if (!authorization || !secret || secret.length < 32) return false;

  const providedDigest = createHash("sha256").update(authorization).digest();
  const expectedDigest = createHash("sha256")
    .update(`Bearer ${secret}`)
    .digest();
  return timingSafeEqual(providedDigest, expectedDigest);
}
