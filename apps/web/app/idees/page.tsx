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
  if (!loginConfig()) {
    if (process.env.CAMPUS_MODE === "connected") {
      return (
        <main style={{ padding: "3rem", maxWidth: "50rem", margin: "auto" }}>
          <h1>Accés temporalment no disponible</h1>
          <p>La configuració d’identitat del portal encara no està preparada.</p>
          <p>No s’ha activat el desat local com a substitut del teu compte.</p>
        </main>
      );
    }
    return <IdeaDraftEditor />;
  }
  const session = await auth();
  if (!session?.user || session.error) redirect("/login?next=/idees");
  return <ConnectedIdeaDrafts />;
}
