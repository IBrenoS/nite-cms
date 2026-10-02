import { Resend } from "resend";

import type {
  EmailDeliveryProviderEvent,
  EmailDeliveryProviderEventType,
} from "@nite/editorial";

export class ResendWebhookValidationError extends Error {
  constructor() {
    super("Webhook Resend inválido.");
    this.name = "ResendWebhookValidationError";
  }
}

type ResendWebhookHeaders = {
  id: string;
  timestamp: string;
  signature: string;
};

type ParsedResendWebhook =
  | { kind: "ignored" }
  | { kind: "delivery"; event: EmailDeliveryProviderEvent };

const supportedTypes = new Set<EmailDeliveryProviderEventType>([
  "email.sent",
  "email.delivered",
  "email.bounced",
  "email.complained",
  "email.failed",
  "email.suppressed",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function failureReason(type: string, data: Record<string, unknown>) {
  if (type === "email.bounced" && isRecord(data.bounce)) {
    return optionalString(data.bounce.message);
  }
  if (type === "email.failed" && isRecord(data.failed)) {
    return optionalString(data.failed.reason);
  }
  if (type === "email.suppressed" && isRecord(data.suppressed)) {
    return optionalString(data.suppressed.message);
  }
  return undefined;
}

export function verifyAndParseResendWebhook(input: {
  rawBody: string;
  headers: ResendWebhookHeaders;
  apiKey: string;
  webhookSecret: string;
}): ParsedResendWebhook {
  if (
    !input.rawBody ||
    !input.headers.id ||
    !input.headers.timestamp ||
    !input.headers.signature
  ) {
    throw new ResendWebhookValidationError();
  }

  let payload: unknown;
  try {
    payload = new Resend(input.apiKey).webhooks.verify({
      payload: input.rawBody,
      headers: input.headers,
      webhookSecret: input.webhookSecret,
    });
  } catch {
    throw new ResendWebhookValidationError();
  }
  if (!isRecord(payload) || typeof payload.type !== "string") {
    throw new ResendWebhookValidationError();
  }
  if (!supportedTypes.has(payload.type as EmailDeliveryProviderEventType)) {
    return { kind: "ignored" };
  }
  if (
    typeof payload.created_at !== "string" ||
    !isRecord(payload.data) ||
    typeof payload.data.email_id !== "string"
  ) {
    throw new ResendWebhookValidationError();
  }
  const providerCreatedAt = new Date(payload.created_at);
  if (Number.isNaN(providerCreatedAt.getTime())) {
    throw new ResendWebhookValidationError();
  }

  const tags = isRecord(payload.data.tags) ? payload.data.tags : undefined;
  const reason = failureReason(payload.type, payload.data);
  return {
    kind: "delivery",
    event: {
      providerEventId: input.headers.id,
      providerEventType: payload.type as EmailDeliveryProviderEventType,
      providerCreatedAt,
      deliveryId: optionalString(tags?.delivery_id),
      providerMessageId: payload.data.email_id,
      ...(reason ? { failureReason: reason } : {}),
    },
  };
}
