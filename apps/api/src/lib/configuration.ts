import { z } from "zod";

const configurationSchema = z.object({
  DATABASE_PUBLIC_URL: z
    .url()
    .refine((value) =>
      ["postgres:", "postgresql:"].includes(new URL(value).protocol),
    ),
  R2_PUBLIC_BASE_URL: z
    .url()
    .refine((value) => ["http:", "https:"].includes(new URL(value).protocol)),
});

export function readApiConfiguration(
  environment: Readonly<Record<string, string | undefined>>,
) {
  const configuration = configurationSchema.parse(environment);
  return {
    databaseUrl: configuration.DATABASE_PUBLIC_URL,
    mediaBaseUrl: configuration.R2_PUBLIC_BASE_URL,
  };
}
