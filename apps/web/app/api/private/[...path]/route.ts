import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { loginConfig } from "../../../../lib/auth-config";
import {
  permittedQuery,
  sameOriginMutation,
} from "../../../../lib/proxy-policy";
import {
  boundedBytes,
  MAX_DOCUMENT_BYTES,
  privateRoute,
} from "../../../../lib/private-policy";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = {
  "Cache-Control": "no-store, private",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};
const error = (status: number, code = "request_failed") =>
  Response.json({ code }, { status, headers });
async function relay(
  request: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const config = loginConfig();
  if (!config) return error(503, "not_configured");
  const { path } = await ctx.params;
  const kind = privateRoute(request.method, path);
  if (!kind || !permittedQuery(request.nextUrl.searchParams)) return error(404);
  if (
    !sameOriginMutation(
      request.method,
      request.headers.get("origin"),
      config.origin,
    )
  )
    return error(403);
  const token = await getToken({
    req: new Request(request.url, {
      headers: { cookie: request.headers.get("cookie") ?? "" },
    }),
    secret: config.secret,
    secureCookie: config.secureCookies,
  });
  if (
    typeof token?.accessToken !== "string" ||
    typeof token.accessExpires !== "number" ||
    token.accessExpires <= Date.now()
  )
    return error(401, "session_expired");
  const outgoing: Record<string, string> = {
    Authorization: `Bearer ${token.accessToken}`,
    Accept: "application/json",
  };
  let body: Uint8Array<ArrayBuffer> | undefined;
  if (request.method === "POST") {
    const media = request.headers
      .get("content-type")
      ?.split(";")[0]
      .trim()
      .toLowerCase();
    if (kind === "upload") {
      if (!media || !["application/pdf", "text/plain"].includes(media))
        return error(415);
      const filename = request.headers.get("x-file-name");
      if (!filename || filename.length > 2200 || /[\r\n]/.test(filename))
        return error(422);
      outgoing["X-File-Name"] = filename;
    } else if (media !== "application/json") return error(415);
    outgoing["Content-Type"] = media!;
    try {
      body = await boundedBytes(
        request,
        kind === "upload" ? MAX_DOCUMENT_BYTES : 65536,
      );
    } catch {
      return error(413);
    }
  }
  const url = new URL(`/v1/${path.join("/")}`, config.apiOrigin);
  url.search = request.nextUrl.search;
  try {
    const response = await fetch(url, {
      method: request.method,
      headers: outgoing,
      body,
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(90000),
    });
    if (!response.ok) {
      let code = "request_failed";
      const payload = await response.json().catch(() => null);
      if (
        response.status === 401 &&
        payload?.detail?.code === "step_up_required"
      )
        code = "step_up_required";
      if (response.status >= 500) return error(503, "service_unavailable");
      return error(response.status, code);
    }
    if (kind === "download") {
      const bytes = await boundedBytes(response, MAX_DOCUMENT_BYTES);
      return new Response(bytes, {
        headers: {
          ...headers,
          "Content-Type": "application/octet-stream",
          "Content-Disposition": 'attachment; filename="document"',
        },
      });
    }
    return Response.json(await response.json(), {
      status: response.status,
      headers,
    });
  } catch {
    return error(502, "service_unavailable");
  }
}
export { relay as GET, relay as POST };
