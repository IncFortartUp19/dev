export type LoginConfig = {
  origin: string;
  apiOrigin: string;
  issuer: string;
  clientId: string;
  clientSecret: string;
  scope: string;
  secret: string;
  prompt: string;
  secureCookies: boolean;
  privateContext: string;
};

function trustedUrl(raw: string, originOnly: boolean): URL {
  const url = new URL(raw);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(local && url.protocol === "http:"))
    throw new Error("HTTPS required");
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (originOnly && url.pathname !== "/")
  )
    throw new Error("Invalid service URL");
  return url;
}

export function loginConfig(
  env: Record<string, string | undefined> = process.env,
): LoginConfig | null {
  const keys = [
    "AUTH_URL",
    "AUTH_SECRET",
    "CAMPUS_API_URL",
    "CAMPUS_OIDC_ISSUER",
    "CAMPUS_OIDC_CLIENT_ID",
    "CAMPUS_OIDC_CLIENT_SECRET",
    "CAMPUS_OIDC_SCOPE",
  ] as const;
  if (keys.some((key) => !env[key])) return null;
  try {
    if (
      env.AUTH_SECRET!.length < 32 ||
      !env.CAMPUS_OIDC_SCOPE!.split(/\s+/).includes("openid")
    )
      return null;
    const origin = trustedUrl(env.AUTH_URL!, true);
    // NextRequest normalizes loopback IP hosts to localhost. Keep callback URLs exact.
    if (["127.0.0.1", "[::1]"].includes(origin.hostname)) return null;
    const api = trustedUrl(env.CAMPUS_API_URL!, true);
    trustedUrl(env.CAMPUS_OIDC_ISSUER!, false);
    const privateContext = env.CAMPUS_PRIVATE_AUTH_CONTEXT ?? "";
    if (privateContext && !/^c[1-9][0-9]?$/.test(privateContext)) return null;
    return {
      origin: origin.origin,
      apiOrigin: api.origin,
      issuer: env.CAMPUS_OIDC_ISSUER!,
      secret: env.AUTH_SECRET!,
      clientId: env.CAMPUS_OIDC_CLIENT_ID!,
      clientSecret: env.CAMPUS_OIDC_CLIENT_SECRET!,
      scope: env.CAMPUS_OIDC_SCOPE!,
      prompt: env.CAMPUS_OIDC_PROMPT ?? "select_account",
      secureCookies: origin.protocol === "https:",
      privateContext,
    };
  } catch {
    return null;
  }
}

export function loginDestination(value: unknown): string {
  return value === "/campus/join" || value === "/private" || value === "/idees" ? value : "/campus";
}
