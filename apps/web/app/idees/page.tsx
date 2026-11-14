import type { Metadata } from "next";
import { IdeaDraftEditor } from "./short-card";
export const metadata: Metadata = { title: "Comença una idea · IncForStartUp" };
export default function IdeasPage() { return <IdeaDraftEditor />; }
