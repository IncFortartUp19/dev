import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "../../auth";
import { loginConfig } from "../../lib/auth-config";
import { IdeaDraftEditor } from "./short-card";
import { ConnectedIdeaDrafts } from "./connected-card";

export const metadata: Metadata = {
  title: "Comença una idea · IncForStartUp",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default async function IdeasPage() {
  if (!loginConfig()) return <IdeaDraftEditor />;
  const session = await auth();
  if (!session?.user || session.error) redirect("/login?next=/idees");
  return <ConnectedIdeaDrafts />;
}
