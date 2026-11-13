import type { Metadata } from "next";
import { ProjectPlanner } from "./planner";

export const metadata: Metadata = {
  title: "Direcció de projectes · IncForStartUp",
};

export default function ProjectsPage() {
  return <ProjectPlanner />;
}
