import { z } from "zod";

type EnvironmentSource = Readonly<Record<string, string | undefined>>;

const hmacSecretSchema = z
  .string()
  .min(32)
  .refine((value) => value.trim().length >= 32);
const portalPreviewUrlSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^https:\/\//iu)
  .pipe(z.url({ protocol: /^https$/u }));

type PreviewConfigurationField = "PREVIEW_HMAC_SECRET" | "PORTAL_PREVIEW_URL";

type PreviewConfigurationIssue = {
  field: PreviewConfigurationField;
  reason: "missing" | "invalid";
};

type PreviewConfiguration = {
  hmacSecret: string;
  portalPreviewUrl: string;
};

export type PreviewConfigurationResult =
  | { configured: false; issues: PreviewConfigurationIssue[] }
  | { configured: true; configuration: PreviewConfiguration };

export function readPreviewConfiguration(
  environment: EnvironmentSource,
): PreviewConfigurationResult {
  const hmacSecret = hmacSecretSchema.safeParse(
    environment.PREVIEW_HMAC_SECRET,
  );
  const portalPreviewUrl = portalPreviewUrlSchema.safeParse(
    environment.PORTAL_PREVIEW_URL,
  );
  const issues: PreviewConfigurationIssue[] = [];
  if (!hmacSecret.success) {
    issues.push({
      field: "PREVIEW_HMAC_SECRET",
      reason: environment.PREVIEW_HMAC_SECRET?.trim() ? "invalid" : "missing",
    });
  }
  if (!portalPreviewUrl.success) {
    issues.push({
      field: "PORTAL_PREVIEW_URL",
      reason: environment.PORTAL_PREVIEW_URL?.trim() ? "invalid" : "missing",
    });
  }
  if (!hmacSecret.success || !portalPreviewUrl.success) {
    return { configured: false, issues };
  }
  return {
    configured: true,
    configuration: {
      hmacSecret: hmacSecret.data,
      portalPreviewUrl: portalPreviewUrl.data,
    },
  };
}
