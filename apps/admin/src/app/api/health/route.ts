import { checkAdminDatabase } from "@/lib/health";

const privateHeaders = { "Cache-Control": "private, no-store" };

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await checkAdminDatabase();
    return Response.json({ status: "ok" }, { headers: privateHeaders });
  } catch {
    return Response.json(
      { status: "unavailable" },
      { status: 503, headers: privateHeaders },
    );
  }
}
