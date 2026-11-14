export const IDEA_STORAGE_KEY = "incforstartup-idea-drafts-v1";
export const MAX_IDEA_DRAFTS = 100;
export type IdeaDraft = {
  id: string;
  question: string;
  intention: string;
  nextTest: string;
  name: string;
  updatedAt: string;
  scope: "personal-local";
};
export type IdeaInput = Pick<IdeaDraft, "question" | "intention" | "nextTest" | "name">;

export function validateIdea(value: IdeaInput): string | null {
  if (!value.question.trim()) return "Escriu una pregunta o necessitat per desar la idea.";
  if (value.question.length > 2000 || value.intention.length > 3000 ||
      value.nextTest.length > 3000 || value.name.length > 120)
    return "Un dels camps supera el límit permès.";
  return null;
}

export function pendingIdeaFields(value: IdeaInput): string[] {
  return [
    ...(!value.intention.trim() ? ["Intenció"] : []),
    ...(!value.nextTest.trim() ? ["Propera prova"] : []),
  ];
}

export function parseIdeaDrafts(raw: string | null): IdeaDraft[] {
  if (raw === null) return [];
  if (raw.length > 750_000) throw new Error("El magatzem local és massa gran.");
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value) || value.length > MAX_IDEA_DRAFTS)
    throw new Error("Format d'esborranys no compatible.");
  const ids = new Set<string>();
  return value.map((row: unknown) => {
    if (!row || typeof row !== "object") throw new Error("Esborrany invàlid.");
    const item = row as Record<string, unknown>;
    const check = (key: string, max: number) =>
      typeof item[key] === "string" && (item[key] as string).length <= max;
    if (!check("id", 100) || !(item.id as string) || ids.has(item.id as string) ||
        !check("question", 2000) || !(item.question as string).trim() ||
        !check("intention", 3000) || !check("nextTest", 3000) ||
        !check("name", 120) || !check("updatedAt", 40) ||
        Number.isNaN(Date.parse(item.updatedAt as string)) ||
        item.scope !== "personal-local")
      throw new Error("L'esborrany conté camps invàlids.");
    ids.add(item.id as string);
    return {
      id: item.id as string,
      question: item.question as string,
      intention: item.intention as string,
      nextTest: item.nextTest as string,
      name: item.name as string,
      updatedAt: item.updatedAt as string,
      scope: "personal-local" as const,
    };
  });
}
