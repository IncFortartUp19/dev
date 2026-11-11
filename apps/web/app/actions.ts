"use server";
import { signIn, signOut } from "../auth";
import { loginConfig, loginDestination } from "../lib/auth-config";
import { redirect } from "next/navigation";

export async function loginAction(data: FormData) {
  if (!loginConfig()) redirect("/login");
  await signIn("campus-oidc", {
    redirectTo: loginDestination(data.get("next")),
  });
}
export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}
