import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDatabase: vi.fn(),
  readAdminConfiguration: vi.fn(),
  readEmailConfiguration: vi.fn(),
  recordEmailDeliveryEvent: vi.fn(),
  verifyAndParseResendWebhook: vi.fn(),
}));

vi.mock("@nite/cms-db/database", () => ({ getDatabase: mocks.getDatabase }));
vi.mock("@/lib/auth-config", () => ({
  readAdminConfiguration: mocks.readAdminConfiguration,
}));
vi.mock("@/lib/email-config", () => ({
  readEmailConfiguration: mocks.readEmailConfiguration,
}));
vi.mock("@nite/editorial", () => ({
  recordEmailDeliveryEvent: mocks.recordEmailDeliveryEvent,
}));
vi.mock("@/lib/resend-webhook", () => {
  class ResendWebhookValidationError extends Error {}
  return {
    ResendWebhookValidationError,
    verifyAndParseResendWebhook: mocks.verifyAndParseResendWebhook,
  };
});

import { ResendWebhookValidationError } from "@/lib/resend-webhook";
import { POST } from "./route";

function request() {
  return new Request("https://cms.nite.test/api/webhooks/resend", {
    method: "POST",
    body: '{"type":"email.delivered"}',
    headers: {
      "svix-id": "evt_1",
      "svix-timestamp": "1790932800",
      "svix-signature": "v1,assinatura",
    },
  });
}

describe("POST /api/webhooks/resend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readAdminConfiguration.mockReturnValue({
      configured: true,
      configuration: { databaseUrl: "postgresql://database.test/nite" },
    });
    mocks.readEmailConfiguration.mockReturnValue({
      configured: true,
      configuration: {
        apiKey: "re_test_key",
        webhookSecret: "whsec_test_secret",
      },
    });
    mocks.getDatabase.mockReturnValue({ database: true });
    mocks.verifyAndParseResendWebhook.mockReturnValue({
      kind: "delivery",
      event: { providerEventId: "evt_1" },
    });
    mocks.recordEmailDeliveryEvent.mockResolvedValue("recorded");
  });

  it("verifica o corpo raw antes de persistir e responde rapidamente", async () => {
    const input = request();
    const text = vi.spyOn(input, "text");

    const response = await POST(input);

    expect(text).toHaveBeenCalledOnce();
    expect(mocks.verifyAndParseResendWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        rawBody: '{"type":"email.delivered"}',
        headers: {
          id: "evt_1",
          timestamp: "1790932800",
          signature: "v1,assinatura",
        },
      }),
    );
    expect(mocks.recordEmailDeliveryEvent).toHaveBeenCalledOnce();
    expect(response.status).toBe(204);
  });

  it("responde 400 sem persistir quando assinatura ou payload é inválido", async () => {
    mocks.verifyAndParseResendWebhook.mockImplementation(() => {
      throw new ResendWebhookValidationError();
    });

    const response = await POST(request());

    expect(response.status).toBe(400);
    expect(mocks.recordEmailDeliveryEvent).not.toHaveBeenCalled();
  });

  it("responde 204 para evento irrelevante ou já processado", async () => {
    mocks.verifyAndParseResendWebhook.mockReturnValue({ kind: "ignored" });
    await expect(POST(request())).resolves.toMatchObject({ status: 204 });
    expect(mocks.recordEmailDeliveryEvent).not.toHaveBeenCalled();

    mocks.verifyAndParseResendWebhook.mockReturnValue({
      kind: "delivery",
      event: { providerEventId: "evt_1" },
    });
    mocks.recordEmailDeliveryEvent.mockResolvedValue("duplicate");
    await expect(POST(request())).resolves.toMatchObject({ status: 204 });
  });

  it("responde 503 para permitir retry quando a persistência falha", async () => {
    mocks.recordEmailDeliveryEvent.mockRejectedValue(
      new Error("database unavailable"),
    );

    const response = await POST(request());

    expect(response.status).toBe(503);
  });
});
