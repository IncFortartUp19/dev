import { getToken } from "next-auth/jwt";
import { type NextRequest } from "next/server";
import { loginConfig } from "../../../../lib/auth-config";
import {
  permittedPath,
  permittedQuery,
  sameOriginMutation,
} from "../../../../lib/proxy-policy";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (detail: string, status: number) =>
  Response.json(
    { detail },
    { status, headers: { "Cache-Control": "no-store" } },
  );
async function boundedBody(request: Request): Promise<string> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 65536) {
      await reader.cancel();
      throw new Error("Body too large");
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}
async function relay(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const config = loginConfig();
  if (!config) return json("L’accés al Campus encara no està configurat.", 503);
  const { path } = await context.params;
  if (
    !permittedPath(request.method, path) ||
    !permittedQuery(request.nextUrl.searchParams)
  )
    return json("Ruta no disponible.", 404);
  if (
    !sameOriginMutation(
      request.method,
      request.headers.get("origin"),
      config.origin,
    )
  )
    return json("Origen no permès.", 403);
  // Read only the HttpOnly session cookie. Do not accept client-supplied bearer tokens.
  const cookieRequest = new Request(request.url, {
    headers: { cookie: request.headers.get("cookie") ?? "" },
  });
  const token = await getToken({
    req: cookieRequest,
    secret: config.secret,
    secureCookie: config.secureCookies,
  });
  if (
    !token ||
    typeof token.accessToken !== "string" ||
    typeof token.accessExpires !== "number" ||
    token.accessExpires <= Date.now()
  )
    return json("La sessió ha caducat. Torna a iniciar sessió.", 401);
  let body: string | undefined;
  if (request.method === "POST") {
    if (
      request.headers.get("content-type")?.split(";")[0] !== "application/json"
    )
      return json("Cal enviar JSON.", 415);
    try {
      body = await boundedBody(request);
    } catch {
      return json("La petició és massa gran.", 413);
    }
  }
  const url = new URL(`/v1/${path.join("/")}`, config.apiOrigin);
  url.search = request.nextUrl.search;
  try {
    const response = await fetch(url, {
      method: request.method,
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body,
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (response.status === 204)
      return new Response(null, {
        status: 204,
        headers: { "Cache-Control": "no-store" },
      });
    if (response.status >= 500)
      return json("El servei no està disponible. Torna-ho a provar.", 502);
    const payload: unknown = await response.json();
    return Response.json(payload, {
      status: response.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return json("No podem contactar amb el servei de Campus.", 502);
  }
}
export { relay as GET, relay as POST, relay as DELETE };
