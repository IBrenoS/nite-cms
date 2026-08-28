import { processCmsOutbox } from "@/lib/outbox";
import { verifyCronAuthorization } from "@/lib/outbox-protocol";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function json(body: unknown, status: number) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function GET(request: Request) {
  if (
    !verifyCronAuthorization(
      request.headers.get("authorization"),
      process.env.CRON_SECRET,
    )
  ) {
    return json({ error: "Não autorizado." }, 401);
  }

  try {
    return json(await processCmsOutbox(), 200);
  } catch {
    return json({ error: "Processamento temporariamente indisponível." }, 503);
  }
}
