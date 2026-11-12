// Isolated test services only. Never import this file from application code.
import { createServer } from "node:https";
import { spawn, execFileSync } from "node:child_process";
import {
  createHash,
  generateKeyPairSync,
  randomBytes,
  randomUUID,
  sign,
} from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

if (process.env.RUN_CONNECTED_E2E !== "1")
  throw new Error("This script is only for connected E2E tests.");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const apiRoot = resolve(root, "../api");
const temp = mkdtempSync(join(tmpdir(), "campus-connected-"));
const cert = join(temp, "cert.pem");
const tlsKey = join(temp, "tls-key.pem");
execFileSync(
  "openssl",
  [
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-keyout",
    tlsKey,
    "-out",
    cert,
    "-days",
    "1",
    "-subj",
    "/CN=localhost",
    "-addext",
    "subjectAltName=DNS:localhost,IP:127.0.0.1",
    "-addext",
    "basicConstraints=critical,CA:TRUE",
  ],
  { stdio: "ignore" },
);
const issuer = "https://127.0.0.1:9443";
const origin = "http://localhost:3400";
const clientId = "campus-web-e2e";
const clientSecret = randomBytes(32).toString("base64url");
const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const jwk = {
  ...publicKey.export({ format: "jwk" }),
  kid: "campus-test-key",
  alg: "RS256",
  use: "sig",
};
const codes = new Map();
const tickets = new Map();
const accessTokens = new Map();
const users = {
  teacher: { sub: "teacher-1", name: "Marta de proves" },
  student: { sub: "student-1", name: "Laia de proves" },
};
const children = [];
let server;
let closing = false;
function shutdown() {
  if (closing) return;
  closing = true;
  children.forEach((child) => child.kill("SIGTERM"));
  server?.closeAllConnections();
  server?.close();
  setTimeout(() => {
    rmSync(temp, { recursive: true, force: true });
    process.exit(0);
  }, 1000);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
function token(claims) {
  const header = Buffer.from(
    JSON.stringify({ alg: "RS256", kid: jwk.kid, typ: "JWT" }),
  ).toString("base64url");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const data = `${header}.${payload}`;
  return `${data}.${sign("RSA-SHA256", Buffer.from(data), privateKey).toString("base64url")}`;
}
function json(response, payload, status = 200) {
  response.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}
server = createServer(
  { cert: readFileSync(cert), key: readFileSync(tlsKey) },
  async (request, response) => {
    const url = new URL(request.url, issuer);
    if (url.pathname === "/.well-known/openid-configuration")
      return json(response, {
        issuer,
        authorization_endpoint: `${issuer}/authorize`,
        token_endpoint: `${issuer}/token`,
        jwks_uri: `${issuer}/jwks`,
        userinfo_endpoint: `${issuer}/userinfo`,
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code"],
        subject_types_supported: ["public"],
        id_token_signing_alg_values_supported: ["RS256"],
        token_endpoint_auth_methods_supported: ["client_secret_post"],
        code_challenge_methods_supported: ["S256"],
      });
    if (url.pathname === "/jwks") return json(response, { keys: [jwk] });
    if (url.pathname === "/userinfo") {
      const access = request.headers.authorization?.replace(/^Bearer /, "");
      const profile = accessTokens.get(access);
      if (!profile || profile.exp <= Date.now() / 1000)
        return json(response, { error: "invalid_token" }, 401);
      return json(response, { sub: profile.sub, name: profile.name });
    }
    if (url.pathname === "/authorize") {
      const params = Object.fromEntries(url.searchParams);
      if (
        params.client_id !== clientId ||
        params.redirect_uri !== `${origin}/api/auth/callback/campus-oidc` ||
        params.response_type !== "code" ||
        params.code_challenge_method !== "S256" ||
        !params.code_challenge ||
        !params.state ||
        !params.nonce
      )
        return json(response, { error: "invalid_request" }, 400);
      const ticket = randomUUID();
      tickets.set(ticket, { ...params, expires: Date.now() + 60000 });
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      });
      return response.end(
        `<!doctype html><html lang="ca"><title>Identitat de proves</title><body><h1>Tria un compte de proves</h1><p>Aquests comptes només existeixen en aquest entorn efímer.</p><a href="/choose?ticket=${ticket}&account=teacher">Professor de proves</a><br><a href="/choose?ticket=${ticket}&account=student">Alumne de proves</a></body></html>`,
      );
    }
    if (url.pathname === "/choose") {
      const ticket = url.searchParams.get("ticket");
      const account = url.searchParams.get("account");
      const params = tickets.get(ticket);
      tickets.delete(ticket);
      if (!params || params.expires < Date.now() || !users[account])
        return json(response, { error: "invalid_request" }, 400);
      const code = randomBytes(32).toString("base64url");
      codes.set(code, { ...params, user: users[account] });
      const callback = new URL(params.redirect_uri);
      callback.searchParams.set("code", code);
      callback.searchParams.set("state", params.state);
      response.writeHead(302, { Location: callback.href });
      return response.end();
    }
    if (url.pathname === "/token" && request.method === "POST") {
      let body = "";
      for await (const chunk of request) body += chunk;
      const params = new URLSearchParams(body);
      const code = params.get("code");
      const saved = codes.get(code);
      codes.delete(code);
      const challenge = createHash("sha256")
        .update(params.get("code_verifier") ?? "")
        .digest("base64url");
      if (
        !saved ||
        saved.expires < Date.now() ||
        params.get("client_id") !== clientId ||
        params.get("client_secret") !== clientSecret ||
        params.get("redirect_uri") !== saved.redirect_uri ||
        params.get("grant_type") !== "authorization_code" ||
        challenge !== saved.code_challenge
      )
        return json(response, { error: "invalid_grant" }, 400);
      const stamp = Math.floor(Date.now() / 1000);
      const shared = {
        iss: issuer,
        sub: saved.user.sub,
        name: saved.user.name,
        iat: stamp,
        exp: stamp + 600,
      };
      const accessToken = token({
        ...shared,
        aud: "campus-api-e2e",
        scope: saved.scope,
        azp: clientId,
        acrs:
          JSON.parse(saved.claims ?? "{}").access_token?.acrs?.value === "c1"
            ? ["c1"]
            : [],
      });
      accessTokens.set(accessToken, shared);
      return json(response, {
        token_type: "Bearer",
        expires_in: 600,
        scope: saved.scope,
        access_token: accessToken,
        id_token: token({ ...shared, aud: clientId, nonce: saved.nonce }),
      });
    }
    return json(response, { error: "not_found" }, 404);
  },
);
await new Promise((resolve) => server.listen(9443, "127.0.0.1", resolve));
const common = {
  ...process.env,
  DATABASE_URL: `sqlite:///${join(temp, "campus.db")}`,
  APP_ENV: "test",
  OIDC_ISSUER: issuer,
  OIDC_AUDIENCE: "campus-api-e2e",
  OIDC_JWKS_URL: `${issuer}/jwks`,
  OIDC_REQUIRED_SCOPE: "campus.read",
  OIDC_ALLOWED_CLIENTS: clientId,
  OIDC_PRIVATE_AUTH_CONTEXT: "c1",
  CORS_ORIGINS: origin,
  SSL_CERT_FILE: cert,
};
try {
  const migrate = spawn(
    "uv",
    [
      "run",
      "--project",
      apiRoot,
      "--frozen",
      "alembic",
      "-c",
      join(apiRoot, "alembic.ini"),
      "upgrade",
      "head",
    ],
    { cwd: apiRoot, env: common, stdio: "inherit" },
  );
  await new Promise((resolve, reject) => {
    migrate.on("error", reject);
    migrate.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error("API migrations failed")),
    );
  });
  const api = spawn(
    "uv",
    [
      "run",
      "--project",
      apiRoot,
      "--frozen",
      "uvicorn",
      "private_api:create_test_app",
      "--app-dir",
      join(root, "tests/support"),
      "--factory",
      "--host",
      "127.0.0.1",
      "--port",
      "8100",
    ],
    { cwd: apiRoot, env: common, stdio: "inherit" },
  );
  children.push(api);
  const web = spawn("npm", ["run", "start", "--", "--port", "3400"], {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      AUTH_URL: origin,
      AUTH_SECRET: randomBytes(48).toString("base64url"),
      CAMPUS_API_URL: "http://127.0.0.1:8100",
      CAMPUS_OIDC_ISSUER: issuer,
      CAMPUS_OIDC_CLIENT_ID: clientId,
      CAMPUS_OIDC_CLIENT_SECRET: clientSecret,
      CAMPUS_OIDC_SCOPE: "openid profile email campus.read",
      CAMPUS_PRIVATE_AUTH_CONTEXT: "c1",
      CAMPUS_MODE: "connected",
      NODE_EXTRA_CA_CERTS: cert,
      NEXT_TELEMETRY_DISABLED: "1",
    },
  });
  children.push(web);
  children.forEach((child) => {
    child.on("error", (error) => {
      console.error(error.message);
      shutdown();
    });
    child.on("exit", () => {
      if (!closing) shutdown();
    });
  });
} catch (error) {
  console.error(error.message);
  shutdown();
}
