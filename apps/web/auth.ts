import "server-only";
import NextAuth from "next-auth";
import { loginConfig } from "./lib/auth-config";

export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const config = loginConfig();
  return {
    secret: process.env.AUTH_SECRET,
    trustHost: true,
    useSecureCookies: config?.secureCookies,
    session: { strategy: "jwt", maxAge: 3600 },
    pages: { signIn: "/login", error: "/login" },
    providers: config
      ? [
          {
            id: "campus-oidc",
            name: "Compte Campus",
            type: "oidc",
            issuer: config.issuer,
            clientId: config.clientId,
            clientSecret: config.clientSecret,
            checks: ["pkce", "state", "nonce"],
            authorization: {
              params: {
                scope: config.scope,
                ...(config.prompt ? { prompt: config.prompt } : {}),
              },
            },
            client: { token_endpoint_auth_method: "client_secret_post" },
          },
        ]
      : [],
    callbacks: {
      async jwt({ token, account }) {
        if (account) {
          token.accessToken = account.access_token;
          token.accessExpires =
            (account.expires_at ?? Math.floor(Date.now() / 1000) + 300) * 1000;
        }
        if (
          typeof token.accessExpires !== "number" ||
          token.accessExpires <= Date.now()
        ) {
          delete token.accessToken;
        }
        return token;
      },
      async session({ session, token }) {
        // Explicit allowlist: never expose access/refresh/ID tokens to browser session JSON.
        return {
          expires: session.expires,
          user: {
            name: typeof token.name === "string" ? token.name : "Compte Campus",
          },
          error:
            typeof token.accessToken === "string"
              ? undefined
              : "SessionExpired",
        };
      },
      async redirect({ url }) {
        const origin = config?.origin ?? "http://localhost:3000";
        try {
          const target = new URL(url, origin);
          if (
            target.origin === origin &&
            ["/campus", "/campus/join", "/login"].includes(target.pathname)
          )
            return target.href;
        } catch {
          /* Use the fixed application origin below. */
        }
        return `${origin}/campus`;
      },
    },
  };
});
