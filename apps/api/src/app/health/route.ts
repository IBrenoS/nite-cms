import { checkPublicNewsDatabase } from "@/lib/public-news";

export async function GET() {
  try {
    await checkPublicNewsDatabase();
    return Response.json({ status: "ok" });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}
