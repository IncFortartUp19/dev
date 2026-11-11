import { redirect } from "next/navigation";
import { auth } from "../../auth";
import { loginConfig } from "../../lib/auth-config";
import { ConnectedCampus } from "../../components/connected-campus";
export const dynamic = "force-dynamic";
export default async function CampusPage() {
  if (!loginConfig()) redirect("/login");
  const session = await auth();
  if (!session?.user || session.error) redirect("/login");
  return <ConnectedCampus />;
}
