type EnvironmentSource = Readonly<Record<string, string | undefined>>;

const APPROVED_FROM_EMAIL = "CMS NITE <acesso@notify.unijorge.com.br>";

type EmailConfigurationField =
  | "RESEND_API_KEY"
  | "RESEND_WEBHOOK_SECRET"
  | "RESEND_FROM_EMAIL"
  | "CMS_PUBLIC_URL"
  | "INVITATION_LINK_SECRET";

type EmailConfigurationIssue = {
  field: EmailConfigurationField;
  reason: "missing" | "invalid";
};

export type EmailConfiguration = {
  apiKey: string;
  webhookSecret: string;
  fromEmail: string;
  publicUrl: string;
  invitationLinkSecret: string;
};

export type EmailConfigurationResult =
  | { configured: false; issues: EmailConfigurationIssue[] }
  | { configured: true; configuration: EmailConfiguration };

function issueReason(value: string | undefined): "missing" | "invalid" {
  return value?.trim() ? "invalid" : "missing";
}

function normalizePublicUrl(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  try {
    const url = new URL(value.trim());
    const localDevelopment = url.hostname === "localhost";
    if (
      (url.protocol !== "https:" && !(localDevelopment && url.protocol === "http:")) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      return undefined;
    }
    return url.origin;
  } catch {
    return undefined;
  }
}

function hasMinimumSecretBytes(value: string | undefined): value is string {
  return Boolean(value?.trim()) && Buffer.byteLength(value!, "utf8") >= 32;
}

export function readEmailConfiguration(
  environment: EnvironmentSource,
): EmailConfigurationResult {
  const issues: EmailConfigurationIssue[] = [];
  const apiKey = environment.RESEND_API_KEY;
  const webhookSecret = environment.RESEND_WEBHOOK_SECRET;
  const fromEmail = environment.RESEND_FROM_EMAIL;
  const publicUrl = normalizePublicUrl(environment.CMS_PUBLIC_URL);
  const invitationLinkSecret = environment.INVITATION_LINK_SECRET;

  if (!apiKey?.trim()) {
    issues.push({ field: "RESEND_API_KEY", reason: issueReason(apiKey) });
  }
  if (!webhookSecret?.trim()) {
    issues.push({
      field: "RESEND_WEBHOOK_SECRET",
      reason: issueReason(webhookSecret),
    });
  }
  if (fromEmail !== APPROVED_FROM_EMAIL) {
    issues.push({
      field: "RESEND_FROM_EMAIL",
      reason: issueReason(fromEmail),
    });
  }
  if (!publicUrl) {
    issues.push({
      field: "CMS_PUBLIC_URL",
      reason: issueReason(environment.CMS_PUBLIC_URL),
    });
  }
  if (!hasMinimumSecretBytes(invitationLinkSecret)) {
    issues.push({
      field: "INVITATION_LINK_SECRET",
      reason: issueReason(invitationLinkSecret),
    });
  }

  if (
    issues.length > 0 ||
    !apiKey ||
    !webhookSecret ||
    !fromEmail ||
    !publicUrl ||
    !invitationLinkSecret
  ) {
    return { configured: false, issues };
  }

  return {
    configured: true,
    configuration: {
      apiKey,
      webhookSecret,
      fromEmail,
      publicUrl,
      invitationLinkSecret,
    },
  };
}
