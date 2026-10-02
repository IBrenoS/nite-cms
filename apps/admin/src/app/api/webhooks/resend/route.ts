import { getDatabase } from "@nite/cms-db/database";
import { recordEmailDeliveryEvent } from "@nite/editorial";
import { readAdminConfiguration } from "@/lib/auth-config";
import { readEmailConfiguration } from "@/lib/email-config";
import {
  ResendWebhookValidationError,
  verifyAndParseResendWebhook,
} from "@/lib/resend-webhook";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const adminConfiguration = readAdminConfiguration(process.env);
  const emailConfiguration = readEmailConfiguration(process.env);
  if (!adminConfiguration.configured || !emailConfiguration.configured) {
    return new Response(null, { status: 503 });
  }

  let parsed: ReturnType<typeof verifyAndParseResendWebhook>;
  try {
    parsed = verifyAndParseResendWebhook({
      rawBody,
      headers: {
        id: request.headers.get("svix-id") ?? "",
        timestamp: request.headers.get("svix-timestamp") ?? "",
        signature: request.headers.get("svix-signature") ?? "",
      },
      apiKey: emailConfiguration.configuration.apiKey,
      webhookSecret: emailConfiguration.configuration.webhookSecret,
    });
  } catch (error) {
    if (error instanceof ResendWebhookValidationError) {
      return new Response(null, { status: 400 });
    }
    return new Response(null, { status: 503 });
  }
  if (parsed.kind === "ignored") return new Response(null, { status: 204 });

  try {
    await recordEmailDeliveryEvent(
      getDatabase(adminConfiguration.configuration),
      parsed.event,
    );
    return new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: 503 });
  }
}
