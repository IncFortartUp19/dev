import type { Metadata } from "next";
import { ValidationLab } from "../../components/validation-lab";
export const metadata: Metadata = {
  title: "Laboratori de validació · IncForStartUp",
};
export default function LabPage() {
  return <ValidationLab />;
}
