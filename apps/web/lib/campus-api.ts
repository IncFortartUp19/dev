export type ApiUser = { id: string; display_name: string };
export type ApiSpace = {
  id: string;
  title: string;
  subject: string;
  due_at: string | null;
  role: "teacher" | "student";
  created_by: string;
};
export type ApiTeam = { id: string; space_id: string; name: string };
export type ApiProject = {
  id: string;
  team_id: string;
  title: string;
  description: string;
  category: string;
};
export type ApiReview = {
  id: string;
  scores: number[];
  feedback: string;
  total: number;
  rubric_snapshot: { id: string; label: string; weight: number }[];
};
export type ApiSubmission = {
  id: string;
  project_id: string;
  version_number: number;
  note: string;
  review: ApiReview | null;
};
export type ApiInvitation = { id: string; token: string; expires_at: string };
export class CampusError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function campusApi<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(`/api/campus${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  if (response.status === 204) return undefined as T;
  const data = await response.json();
  if (!response.ok) {
    const messages: Record<number, string> = {
      401: "La sessió ha caducat. Torna a iniciar sessió.",
      403: "Aquest compte no té permís per fer aquesta acció.",
      404: "No trobem l’element o no hi tens accés.",
      409: "L’element ja existeix o aquesta versió ja està avaluada.",
      422: "Revisa els camps i els límits de la petició.",
    };
    throw new CampusError(
      response.status,
      messages[response.status] ??
        "No s’ha pogut completar la petició. Torna-ho a provar.",
    );
  }
  return data as T;
}
