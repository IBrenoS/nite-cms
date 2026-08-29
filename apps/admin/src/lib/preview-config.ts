import { z } from "zod";

type EnvironmentSource = Readonly<Record<string, string | undefined>>;

const configurationSchema = z.object({
  PREVIEW_HMAC_SECRET: z.string().min(32),
  PORTAL_PREVIEW_URL: z
    .url()
    .refine((value) => new URL(value).protocol === "https:"),
});
const configurationNames = [
  "PREVIEW_HMAC_SECRET",
  "PORTAL_PREVIEW_URL",
] as const;

type PreviewConfiguration = {
  hmacSecret: string;
  portalPreviewUrl: string;
};

export type PreviewConfigurationResult =
  | { configured: false; missing: string[] }
  | { configured: true; configuration: PreviewConfiguration };

export function readPreviewConfiguration(
  environment: EnvironmentSource,
): PreviewConfigurationResult {
  const parsed = configurationSchema.safeParse(environment);
  if (!parsed.success) {
    return {
      configured: false,
      missing: configurationNames.filter(
        (name) =>
          !configurationSchema.shape[name].safeParse(environment[name]).success,
      ),
    };
  }
  return {
    configured: true,
    configuration: {
      hmacSecret: parsed.data.PREVIEW_HMAC_SECRET,
      portalPreviewUrl: parsed.data.PORTAL_PREVIEW_URL,
    },
  };
}
