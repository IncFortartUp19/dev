export type Vault = {
  id: string;
  name: string;
  role: "owner" | "contributor" | "reader";
};
export type PrivateDocument = {
  id: string;
  vault_id: string;
  filename: string;
  media_type: string;
  size: number;
  status: "uploading" | "quarantined" | "released" | "blocked" | "failed";
  uploaded_by: string;
  created_at: string;
};
export class PrivateError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    const messages: Record<number, string> = {
      401:
        code === "step_up_required"
          ? "Cal reforçar l’accés abans d’entrar als projectes privats."
          : "La sessió ha caducat. Torna a iniciar sessió.",
      403: "No tens permís per fer aquesta acció.",
      404: "No trobem el document o no hi tens accés.",
      413: "El fitxer supera els 10 MiB.",
      415: "Selecciona un document PDF o TXT vàlid.",
      422: "Revisa el nom, el format i els camps del document.",
      423: "El document encara no està autoritzat per descarregar.",
      503: "L’accés privat o l’emmagatzematge encara no està disponible.",
    };
    super(
      messages[status] ??
        "No hem pogut completar l’operació. Torna-ho a provar.",
    );
  }
}
export async function privateRequest(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const response = await fetch(`/api/private/${path}`, {
    ...init,
    cache: "no-store",
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new PrivateError(response.status, error.code ?? "request_failed");
  }
  return response;
}
export async function privateJson<T>(path: string, body?: unknown): Promise<T> {
  return (
    await privateRequest(
      path,
      body === undefined
        ? undefined
        : {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
    )
  ).json();
}
