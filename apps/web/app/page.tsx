import { redirect } from "next/navigation";
import DemoCampus from "../components/demo-campus";
export const dynamic = "force-dynamic";
export default function Home() {
  if (process.env.CAMPUS_MODE === "connected") redirect("/campus");
  return <DemoCampus />;
}
