"use server";
import { signIn, signOut } from "../auth";
import { loginConfig, loginDestination } from "../lib/auth-config";
import { redirect } from "next/navigation";
import { privateClaims } from "../lib/private-policy";

export async function loginAction(data: FormData) {
  if (!loginConfig()) redirect("/login");
  await signIn("campus-oidc", {
    redirectTo: loginDestination(data.get("next")),
  });
}
export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}

export async function privateLoginAction(data: FormData) {
  const config = loginConfig();
  if (!config?.privateContext)
    redirect("/login?next=/private&error=Configuration");
  await signIn(
    "campus-oidc",
    { redirectTo: data.get("next") === "/idees" ? "/idees" : "/private" },
    { claims: privateClaims(config.privateContext) },
  );
}
