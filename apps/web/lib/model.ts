export type Role = "teacher" | "student";
export type Space = {
  id: string;
  title: string;
  subject: string;
  code: string;
  due: string;
};
export type Attachment = { id: string; name: string; size: number };
export type Review = { scores: number[]; feedback: string; date: string };
export type Delivery = {
  id: string;
  note: string;
  date: string;
  files: Attachment[];
  review?: Review;
};
export type Project = {
  id: string;
  spaceId: string;
  title: string;
  description: string;
  category: string;
  team: string[];
  deliveries: Delivery[];
  color: string;
};
export type Store = { schema: 1; spaces: Space[]; projects: Project[] };
export const rubric = [
  { label: "Definició del problema", weight: 30 },
  { label: "Proposta i viabilitat", weight: 30 },
  { label: "Desenvolupament i evidències", weight: 25 },
  { label: "Comunicació i presentació", weight: 15 },
];
export function score(scores: number[]): number {
  if (
    scores.length !== rubric.length ||
    scores.some((n) => !Number.isFinite(n) || n < 0 || n > 10)
  )
    throw new Error("Cada criteri necessita una puntuació entre 0 i 10.");
  return (
    Math.round(
      scores.reduce((sum, n, i) => sum + (n * rubric[i].weight) / 100, 0) * 10,
    ) / 10
  );
}
export function status(
  project: Project,
): "Esborrany" | "Pendent de revisió" | "Avaluat" {
  const latest = project.deliveries.at(-1);
  return !latest
    ? "Esborrany"
    : latest.review
      ? "Avaluat"
      : "Pendent de revisió";
}
export function readStore(raw: string | null): Store {
  if (!raw) return seed();
  const data = JSON.parse(raw);
  if (
    data.schema !== 1 ||
    !Array.isArray(data.spaces) ||
    !Array.isArray(data.projects)
  )
    throw new Error("Dades locals incompatibles.");
  for (const space of data.spaces) {
    if (
      !["id", "title", "subject", "code", "due"].every(
        (k) => typeof space[k] === "string",
      )
    )
      throw new Error("Espai no vàlid.");
  }
  for (const project of data.projects) {
    if (
      !["id", "spaceId", "title", "description", "category", "color"].every(
        (k) => typeof project[k] === "string",
      ) ||
      !Array.isArray(project.team) ||
      !project.team.every((n: unknown) => typeof n === "string") ||
      !Array.isArray(project.deliveries)
    )
      throw new Error("Projecte no vàlid.");
    for (const delivery of project.deliveries) {
      if (
        !["id", "note", "date"].every((k) => typeof delivery[k] === "string") ||
        !Array.isArray(delivery.files) ||
        delivery.files.some(
          (f: Attachment) =>
            !f ||
            typeof f.id !== "string" ||
            typeof f.name !== "string" ||
            typeof f.size !== "number",
        )
      )
        throw new Error("Entrega no vàlida.");
      if (delivery.review) {
        if (
          !Array.isArray(delivery.review.scores) ||
          typeof delivery.review.feedback !== "string" ||
          typeof delivery.review.date !== "string"
        )
          throw new Error("Revisió no vàlida.");
        score(delivery.review.scores);
      }
    }
  }
  return data;
}
export function seed(): Store {
  return {
    schema: 1,
    spaces: [
      {
        id: "s1",
        title: "Laboratori d’innovació",
        subject: "Projectes interdisciplinaris",
        code: "DEMO-LAB",
        due: "2026-12-18",
      },
      {
        id: "s2",
        title: "Disseny amb impacte",
        subject: "Disseny de serveis",
        code: "DEMO-DIS",
        due: "2026-12-21",
      },
    ],
    projects: [
      {
        id: "p1",
        spaceId: "s1",
        title: "Reverd",
        description:
          "Convertim els espais buits del campus en petits horts compartits. Un sistema de sensors ens ajudarà a reduir el consum d’aigua i a connectar la comunitat universitària.",
        category: "Sostenibilitat",
        team: ["Laia Ferrer", "Pol Serra", "Aina Vidal"],
        color: "sage",
        deliveries: [
          {
            id: "d1",
            note: "Primera definició del problema i entrevistes exploratòries amb estudiants.",
            date: "2026-11-02T10:00:00Z",
            files: [],
            review: {
              scores: [8, 7, 6, 8],
              feedback:
                "La necessitat està ben explicada. Per a la següent entrega, concreteu el pressupost del pilot i com mesurareu l’estalvi d’aigua.",
              date: "2026-11-04T09:00:00Z",
            },
          },
          {
            id: "d2",
            note: "Hem concretat el pilot: dos espais, un pressupost inicial i tres indicadors de seguiment. Afegim el mapa de persones participants.",
            date: "2026-11-08T16:20:00Z",
            files: [],
          },
        ],
      },
      {
        id: "p2",
        spaceId: "s1",
        title: "A prop",
        description:
          "Una xarxa de suport entre estudiants per facilitar els primers mesos a la universitat. Connectem qui acaba d’arribar amb persones que ja coneixen el campus.",
        category: "Comunitat",
        team: ["Nil Costa", "Júlia Roca"],
        color: "peach",
        deliveries: [
          {
            id: "d3",
            note: "Proposta inicial i resultats de les primeres cinc entrevistes.",
            date: "2026-11-07T11:30:00Z",
            files: [],
            review: {
              scores: [9, 8, 7, 9],
              feedback:
                "Bon treball de camp. Ara cal definir el procés d’acollida i com protegireu les dades de contacte.",
              date: "2026-11-08T12:00:00Z",
            },
          },
        ],
      },
      {
        id: "p3",
        spaceId: "s2",
        title: "Segona vida",
        description:
          "Una biblioteca d’objectes que facilita compartir material universitari i allargar-ne la vida útil.",
        category: "Economia circular",
        team: ["Marina Puig", "Eric Solé"],
        color: "lavender",
        deliveries: [],
      },
    ],
  };
}
