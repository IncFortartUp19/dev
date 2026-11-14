import { test } from "node:test";
import assert from "node:assert/strict";
import { loginConfig, loginDestination } from "./auth-config";
import {
  permittedPath,
  permittedQuery,
  sameOriginMutation,
} from "./proxy-policy";

const env = {
  AUTH_URL: "https://campus.example",
  AUTH_SECRET: "a".repeat(48),
  CAMPUS_API_URL: "https://api.example",
  CAMPUS_OIDC_ISSUER: "https://id.example/tenant/",
  CAMPUS_OIDC_CLIENT_ID: "web",
  CAMPUS_OIDC_CLIENT_SECRET: "secret",
  CAMPUS_OIDC_SCOPE: "openid profile email campus.read",
};

test("login configuration fails closed and preserves the exact issuer", () => {
  assert.equal(loginConfig({}), null);
  assert.equal(loginConfig(env)?.issuer, env.CAMPUS_OIDC_ISSUER);
  assert.equal(loginConfig(env)?.secureCookies, true);
  for (const change of [
    { AUTH_SECRET: "short" },
    { AUTH_URL: "https://user:secret@campus.example" },
    { CAMPUS_API_URL: "http://api.example" },
    { CAMPUS_OIDC_ISSUER: "https://id.example#secret" },
    { CAMPUS_OIDC_SCOPE: "profile email" },
  ])
    assert.equal(loginConfig({ ...env, ...change }), null);
  assert.equal(
    loginConfig({
      ...env,
      AUTH_URL: "http://localhost:3400",
      CAMPUS_API_URL: "http://127.0.0.1:8100",
    })?.secureCookies,
    false,
  );
});
test("login destinations cannot redirect off-site", () => {
  assert.equal(loginDestination("/campus/join"), "/campus/join");
  assert.equal(loginDestination("/private"), "/private");
  assert.equal(loginDestination("/idees"), "/idees");
  for (const value of [
    "https://evil.example",
    "//evil.example",
    "/campus/join?token=secret",
    "/private?redirect=https://evil.example",
    "/idees?redirect=https://evil.example",
    null,
  ])
    assert.equal(loginDestination(value), "/campus");
});
test("proxy only allows known routes and bounded pagination", () => {
  const id = "e299e7e6-628f-415a-955e-b77daea335a8";
  assert.equal(permittedPath("GET", ["spaces", id, "projects"]), true);
  assert.equal(permittedPath("POST", ["submissions", id, "reviews"]), true);
  for (const path of [
    ["..", "secrets"],
    ["https:", "evil.example"],
    ["spaces", "%2fadmin"],
    ["spaces", id, "../members"],
    ["spaces", id, "unknown"],
  ])
    assert.equal(permittedPath("GET", path), false);
  assert.equal(permittedPath("PUT", ["spaces"]), false);
  assert.equal(permittedQuery(new URLSearchParams("limit=100&offset=0")), true);
  assert.equal(
    permittedQuery(new URLSearchParams("redirect=https://evil.example")),
    false,
  );
  assert.equal(
    permittedQuery(new URLSearchParams("limit=100000000000")),
    false,
  );
});
test("cookie-authenticated mutations require an exact origin", () => {
  assert.equal(
    sameOriginMutation(
      "POST",
      "https://campus.example",
      "https://campus.example",
    ),
    true,
  );
  for (const origin of [
    null,
    "https://evil.example",
    "https://campus.example.evil.test",
    "http://campus.example",
  ])
    assert.equal(
      sameOriginMutation("POST", origin, "https://campus.example"),
      false,
    );
});
