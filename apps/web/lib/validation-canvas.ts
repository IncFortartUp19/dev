export const canvasFields = [
  {
    key: "name",
    label: "Nom del projecte",
    help: "Un nom provisional és suficient.",
  },
  {
    key: "problem",
    label: "Problema",
    help: "Quina dificultat, pregunta de recerca o intenció creativa vols explorar? Separa observacions i suposicions.",
  },
  {
    key: "audience",
    label: "Públic inicial",
    help: "A qui s’adreça la proposta? Pot ser un públic, una comunitat o les persones que participaran en la recerca.",
  },
  {
    key: "hypothesis",
    label: "Hipòtesi",
    help: "Què creus que milloraria i per què? Formula una afirmació que puguis contrastar.",
  },
  {
    key: "experiment",
    label: "Proper experiment",
    help: "Quina prova petita pots fer? Pot ser una entrevista, un assaig, una maqueta, un experiment o una mostra artística.",
  },
  {
    key: "criterion",
    label: "Criteri de decisió",
    help: "Defineix abans de provar què observaràs i què et faria canviar d’idea.",
  },
  {
    key: "evidence",
    label: "Resultats observats",
    help: "Descriu què ha passat, amb data i context. Evita noms i dades personals.",
  },
  {
    key: "learning",
    label: "Aprenentatge i següent pas",
    help: "Què mantens, què canvies i què provaràs després?",
  },
] as const;
export type CanvasKey = (typeof canvasFields)[number]["key"];
export type Canvas = { schema: 1; fields: Record<CanvasKey, string> };
export const MAX_CANVAS_FILE = 100_000;
export function emptyCanvas(): Canvas {
  return {
    schema: 1,
    fields: Object.fromEntries(
      canvasFields.map(({ key }) => [key, ""]),
    ) as Canvas["fields"],
  };
}
export function readCanvas(raw: string): Canvas {
  if (raw.length > MAX_CANVAS_FILE) throw new Error("El fitxer és massa gran.");
  const value: unknown = JSON.parse(raw);
  if (
    !value ||
    typeof value !== "object" ||
    !("schema" in value) ||
    value.schema !== 1 ||
    !("fields" in value) ||
    !value.fields ||
    typeof value.fields !== "object"
  )
    throw new Error("Format d’esborrany no compatible.");
  const result = emptyCanvas();
  for (const { key } of canvasFields) {
    const field = (value.fields as Record<string, unknown>)[key];
    if (typeof field !== "string" || field.length > 4000)
      throw new Error("L’esborrany conté camps invàlids.");
    result.fields[key] = field;
  }
  return result;
}
// Suggestions describe missing preparation, never market viability or an academic grade.
export function nextValidationStep(canvas: Canvas): string {
  const has = (key: CanvasKey) => Boolean(canvas.fields[key].trim());
  if (!has("problem") || !has("audience"))
    return "Concreta el problema i el públic abans de definir la solució.";
  if (!has("hypothesis"))
    return "Escriu una hipòtesi que puguis contrastar amb el teu públic.";
  if (!has("experiment") || !has("criterion"))
    return "Prepara una prova i el criteri amb què decidiràs què fer després.";
  if (!has("evidence"))
    return "Fes la prova i registra els resultats, encara que contradiguin la hipòtesi.";
  if (!has("learning"))
    return "Transforma els resultats en un aprenentatge i un següent pas.";
  return "Revisa la qualitat de les evidències amb el teu equip i prepara el següent experiment. Omplir la fitxa no demostra que el projecte sigui viable.";
}
