import { redirect } from "next/navigation";
import { auth } from "../../auth";
import { loginConfig } from "../../lib/auth-config";
import { PrivateDocuments } from "../../components/private-documents";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Documents privats · IncForStartUp",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default async function PrivatePage() {
  const config = loginConfig();
  if (!config) redirect("/login?next=/private");
  const session = await auth();
  if (!session?.user || session.error) redirect("/login?next=/private");
  return (
    <PrivateDocuments
      userName={session.user.name ?? "Compte"}
      stepUpConfigured={!!config.privateContext}
    />
  );
}
