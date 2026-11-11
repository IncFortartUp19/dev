import { handlers } from "../../../../auth";
import { loginConfig } from "../../../../lib/auth-config";
import type { NextRequest } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!loginConfig())
    return Response.json({ error: "Login is not configured" }, { status: 503 });
  return handlers.GET(request);
}
export async function POST(request: NextRequest) {
  if (!loginConfig())
    return Response.json({ error: "Login is not configured" }, { status: 503 });
  return handlers.POST(request);
}
