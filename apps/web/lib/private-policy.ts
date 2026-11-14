const id =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export function privateRoute(
  method: string,
  path: string[],
): "json" | "upload" | "download" | null {
  if (path.some((p) => !p || /[\\/.%?#]/.test(p))) return null;
  const joined = path.join("/");
  if (
    method === "GET" &&
    new RegExp(`^vaults/${id}/documents/${id}/content$`).test(joined)
  )
    return "download";
  if (method === "POST" && new RegExp(`^vaults/${id}/documents$`).test(joined))
    return "upload";
  if (
    method === "GET" &&
    (joined === "private-access" ||
      joined === "vaults" ||
      new RegExp(`^vaults/${id}(?:/documents)?$`).test(joined))
  )
    return "json";
  if (method === "POST" && joined === "vaults") return "json";
  if ((method === "GET" || method === "POST") &&
      (joined === "idea-drafts" || new RegExp(`^idea-drafts/${id}const id =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export function privateRoute(
  method: string,
  path: string[],
): "json" | "upload" | "download" | null {
  if (path.some((p) => !p || /[\\/.%?#]/.test(p))) return null;
  const joined = path.join("/");
  if (
    method === "GET" &&
    new RegExp(`^vaults/${id}/documents/${id}/content$`).test(joined)
  )
    return "download";
  if (method === "POST" && new RegExp(`^vaults/${id}/documents$`).test(joined))
    return "upload";
  if (
    method === "GET" &&
    (joined === "private-access" ||
      joined === "vaults" ||
      new RegExp(`^vaults/${id}(?:/documents)?$`).test(joined))
  )
    return "json";
).test(joined))) return "json";
  return null;
}
export function privateClaims(context: string): string {
  return JSON.stringify({
    access_token: { acrs: { essential: true, value: context } },
  });
}
export async function boundedBytes(
  source: Request | Response,
  limit: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const reader = source.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      throw new Error("Body too large");
    }
    chunks.push(value);
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
