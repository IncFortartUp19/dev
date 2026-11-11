const id =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
const rules: Record<string, RegExp[]> = {
  GET: [
    new RegExp("^me$"),
    new RegExp("^spaces$"),
    new RegExp(`^spaces/${id}/(?:teams|projects|members)$`),
    new RegExp(`^teams/${id}/members$`),
    new RegExp(`^projects/${id}(?:/submissions)?$`),
  ],
  POST: [
    new RegExp("^spaces$"),
    new RegExp(`^spaces/${id}/(?:invitations|teams)$`),
    new RegExp("^invitations/accept$"),
    new RegExp(`^teams/${id}/(?:invitations|projects)$`),
    new RegExp(`^projects/${id}/submissions$`),
    new RegExp(`^submissions/${id}/reviews$`),
  ],
  DELETE: [new RegExp(`^invitations/${id}$`)],
};
export function permittedPath(method: string, segments: string[]): boolean {
  return (
    segments.every((p) => p.length > 0 && !/[\\/.%?#]/.test(p)) &&
    !!rules[method]?.some((rule) => rule.test(segments.join("/")))
  );
}
export function permittedQuery(params: URLSearchParams): boolean {
  return [...params].every(
    ([key, value]) =>
      ["limit", "offset"].includes(key) && /^\d{1,5}$/.test(value),
  );
}
export function sameOriginMutation(
  method: string,
  requestOrigin: string | null,
  appOrigin: string,
): boolean {
  return method === "GET" || requestOrigin === appOrigin;
}
