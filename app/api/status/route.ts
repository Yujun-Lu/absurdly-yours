import { serverConfig } from "@/lib/server/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  let configured = false;
  try { configured = serverConfig().configured; } catch { /* Invalid config is unavailable, never exposed. */ }
  return Response.json({ generation: configured, transcription: configured }, { headers: { "Cache-Control": "no-store" } });
}
