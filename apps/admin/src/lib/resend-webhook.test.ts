import { beforeEach, describe, expect, it, vi } from "vitest";

const resendMocks = vi.hoisted(() => ({ verify: vi.fn() }));
vi.mock("resend", () => ({
  Resend: class {
    webhooks = { verify: resendMocks.verify };
  },
}));

import {
  ResendWebhookValidationError,
  verifyAndParseResendWebhook,
} from "./resend-webhook";

const headers = {
  id: "evt_1",
  timestamp: "1790932800",
  signature: "v1,assinatura",
};
const baseData = {
  created_at: "2026-10-02T12:00:00.000Z",
  email_id: "provider-message-id",
  message_id: "smtp-message-id",
  from: "CMS NITE <acesso@notify.unijorge.com.br>",
  to: ["pessoa@unijorge.com.br"],
  subject: "Convite para integrar a equipe do CMS NITE",
  tags: { delivery_id: "10000000-0000-4000-8000-000000000001" },
};

describe("webhook Resend assinado", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ["email.sent", "sent", undefined],
    ["email.delivered", "delivered", undefined],
    ["email.bounced", "bounced", "Mailbox unavailable"],
    ["email.complained", "complained", undefined],
    ["email.failed", "failed", "Provider rejected"],
    ["email.suppressed", "failed", "Suppression list"],
  ] as const)("mapeia %s para %s", (type, _status, failureReason) => {
    resendMocks.verify.mockReturnValue({
      type,
      created_at: "2026-10-02T12:00:01.000Z",
      data: {
        ...baseData,
        ...(type === "email.bounced"
          ? {
              bounce: {
                message: failureReason,
                subType: "general",
                type: "Permanent",
              },
            }
          : {}),
        ...(type === "email.failed"
          ? { failed: { reason: failureReason } }
          : {}),
        ...(type === "email.suppressed"
          ? { suppressed: { message: failureReason, type: "Manual" } }
          : {}),
      },
    });

    const result = verifyAndParseResendWebhook({
      rawBody: '{"raw":"body"}',
      headers,
      apiKey: "re_test_key",
      webhookSecret: "whsec_test_secret",
    });

    expect(resendMocks.verify).toHaveBeenCalledWith({
      payload: '{"raw":"body"}',
      headers,
      webhookSecret: "whsec_test_secret",
    });
    expect(result).toEqual({
      kind: "delivery",
      event: {
        providerEventId: headers.id,
        providerEventType: type,
        providerCreatedAt: new Date("2026-10-02T12:00:01.000Z"),
        deliveryId: baseData.tags.delivery_id,
        providerMessageId: baseData.email_id,
        ...(failureReason ? { failureReason } : {}),
      },
    });
  });

  it("ignora eventos assinados fora do ciclo operacional", () => {
    resendMocks.verify.mockReturnValue({
      type: "email.opened",
      created_at: "2026-10-02T12:00:01.000Z",
      data: baseData,
    });

    expect(
      verifyAndParseResendWebhook({
        rawBody: "{}",
        headers,
        apiKey: "re_test_key",
        webhookSecret: "whsec_test_secret",
      }),
    ).toEqual({ kind: "ignored" });
  });

  it("rejeita assinatura, headers ou payload inválidos", () => {
    resendMocks.verify.mockImplementation(() => {
      throw new Error("invalid signature with secret detail");
    });
    expect(() =>
      verifyAndParseResendWebhook({
        rawBody: "{}",
        headers,
        apiKey: "re_test_key",
        webhookSecret: "whsec_test_secret",
      }),
    ).toThrow(ResendWebhookValidationError);

    resendMocks.verify.mockReturnValue({
      type: "email.delivered",
      created_at: "invalid-date",
      data: baseData,
    });
    expect(() =>
      verifyAndParseResendWebhook({
        rawBody: "{}",
        headers,
        apiKey: "re_test_key",
        webhookSecret: "whsec_test_secret",
      }),
    ).toThrow(ResendWebhookValidationError);
  });
});
