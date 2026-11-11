import { auth } from "../../../auth";
import { loginConfig } from "../../../lib/auth-config";
import { JoinSpace } from "../../../components/join-space";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function JoinPage() {
  if (!loginConfig()) redirect("/login?next=/campus/join");
  const session = await auth();
  return (
    <JoinSpace
      userName={
        session?.user && !session.error
          ? (session.user.name ?? "Compte Campus")
          : null
      }
    />
  );
}
