import { createHash, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import type { OutboxDispatcher } from "@nite/editorial";
import {
  createRevalidationSignature,
  newsRevalidationPayloadSchema,
} from "@nite/editorial/revalidation";

type EnvironmentSource = Readonly<Record<string, string | undefined>>;

const revalidationUrlSchema = z.url().refine((value) => {
  const url = new URL(value);
  return (
    url.protocol === "https:" ||
    (url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1"))
  );
}, "Use HTTPS fora do ambiente local.");

const requiredOutboxConfiguration = {
  DATABASE_ADMIN_URL: z.url(),
  WEB_REVALIDATION_URL: revalidationUrlSchema,
  REVALIDATION_SECRET: z.string().min(32),
} as const;

type OutboxConfiguration = {
  databaseUrl: string;
  revalidationUrl: string;
  revalidationSecret: string;
};

type OutboxConfigurationResult =
  | { configured: false; missing: string[] }
  | { configured: true; configuration: OutboxConfiguration };

export function readOutboxConfiguration(
  environment: EnvironmentSource,
): OutboxConfigurationResult {
  const missing = Object.entries(requiredOutboxConfiguration)
    .filter(([name, schema]) => !schema.safeParse(environment[name]).success)
    .map(([name]) => name);
  if (missing.length > 0) return { configured: false, missing };

  return {
    configured: true,
    configuration: {
      databaseUrl: environment.DATABASE_ADMIN_URL!,
      revalidationUrl: environment.WEB_REVALIDATION_URL!,
      revalidationSecret: environment.REVALIDATION_SECRET!,
    },
  };
}

export function createWebRevalidationDispatcher(input: {
  endpointUrl: string;
  secret: string;
  fetcher?: typeof fetch;
  now?: () => Date;
}): OutboxDispatcher {
  const endpointUrl = revalidationUrlSchema.parse(input.endpointUrl);
  const secret = z.string().min(32).parse(input.secret);
  const fetcher = input.fetcher ?? fetch;

  return {
    async dispatch(message) {
      const payload = newsRevalidationPayloadSchema.parse({
        eventId: message.id,
        topic: message.topic,
        ...message.payload,
      });
      const body = JSON.stringify(payload);
      const timestamp = Math.floor(
        (input.now?.() ?? new Date()).getTime() / 1000,
      ).toString();
      const signature = createRevalidationSignature({
        body,
        timestamp,
        secret,
      });
      const response = await fetcher(endpointUrl, {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(8_000),
        headers: {
          "Content-Type": "application/json",
          "X-NITE-Timestamp": timestamp,
          "X-NITE-Signature": signature,
        },
        body,
      });

      if (!response.ok) {
        throw new Error(`Portal recusou a revalidação (${response.status}).`);
      }
    },
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
