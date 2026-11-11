import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("teacher and student complete a project submission, file download and review", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Hola, Marta." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Crea un espai", exact: true })
    .click();
  await page.getByLabel("Nom de l’espai").fill("Pilot d’emprenedoria");
  await page.getByLabel("Assignatura o àmbit").fill("Innovació oberta");
  await page.getByLabel("Data d’entrega").fill("2027-01-20");
  await page.getByRole("button", { name: "Crea l’espai", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Pilot d’emprenedoria." }),
  ).toBeVisible();
  await page.getByLabel("Vista de demostració").selectOption("student");
  await page.getByRole("button", { name: "Nou projecte", exact: true }).click();
  await page.getByLabel("Nom del projecte").fill("Campus compartit");
  await page
    .getByRole("dialog")
    .locator("select[name=space]")
    .selectOption({ label: "Pilot d’emprenedoria" });
  await page
    .getByLabel("Quin problema voleu resoldre?")
    .fill(
      "Connectem estudiants que volen compartir materials i crear una comunitat al campus.",
    );
  await page.getByLabel("Companys d’equip").fill("Oriol Pla");
  await page
    .getByRole("button", { name: "Crea el projecte", exact: true })
    .click();
  await page.getByRole("button", { name: "Nova entrega", exact: true }).click();
  await page
    .getByLabel("Què heu treballat?")
    .fill("Primera proposta basada en cinc entrevistes amb estudiants.");
  await page.locator("input[type=file]").setInputFiles({
    name: "proposta.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Document de prova del campus"),
  });
  await page
    .getByRole("button", { name: "Presenta l’entrega", exact: true })
    .click();
  await expect(
    page.getByText("Aquesta versió està pendent de revisió."),
  ).toBeVisible();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: /proposta.txt/ }).click();
  const download = await downloadEvent;
  expect(await readFile((await download.path())!, "utf8")).toBe(
    "Document de prova del campus",
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Hola, Marta." }),
  ).toBeVisible();
  await page.getByLabel("Cerca projectes").fill("Campus compartit");
  await page.getByRole("button", { name: /Campus compartit/ }).click();
  for (const [label, value] of [
    ["Definició del problema", "8"],
    ["Proposta i viabilitat", "7"],
    ["Desenvolupament i evidències", "6"],
    ["Comunicació i presentació", "8"],
  ]) {
    await page.getByLabel(label, { exact: true }).fill(value);
  }
  await page
    .getByLabel("Comentari per a l’equip")
    .fill("Bon inici. Concreteu el pressupost i un indicador de participació.");
  await page
    .getByRole("button", { name: "Publica el feedback", exact: true })
    .click();
  await expect(page.locator(".feedback")).toContainText("7,2 / 10");
  await expect(page.locator(".project-meta .badge")).toHaveText("Avaluat");
  await page.getByLabel("Vista de demostració").selectOption("student");
  await page.getByLabel("Cerca projectes").fill("Campus compartit");
  await page.getByRole("button", { name: /Campus compartit/ }).click();
  await page.getByRole("button", { name: "Nova entrega", exact: true }).click();
  await page
    .getByLabel("Què heu treballat?")
    .fill(
      "Segona versió: pressupost concret i indicador de participació definits.",
    );
  await page
    .getByRole("button", { name: "Presenta l’entrega", exact: true })
    .click();
  await expect(page.locator(".project-meta .badge")).toHaveText(
    "Pendent de revisió",
  );
  await page.getByRole("button", { name: "Versió 1", exact: false }).click();
  await expect(page.locator(".feedback")).toContainText("Bon inici.");
  expect(errors).toEqual([]);
});

test("mobile layout, filters and demo role selection remain usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Hola, Marta." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByLabel("Cerca projectes").fill("aucun-resultat");
  await expect(
    page.getByRole("heading", { name: "No hem trobat coincidències" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Esborra la cerca" }).click();
  await page.getByLabel("Vista de demostració").selectOption("student");
  await expect(page.locator(".project-card")).toHaveCount(1);
  await page.getByRole("button", { name: /Reverd/ }).click();
  await expect(
    page.getByRole("button", { name: "Nova entrega", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("too many files shows an actionable error inside the delivery dialog", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Vista de demostració").selectOption("student");
  await page.getByRole("button", { name: /Reverd/ }).click();
  await page.getByRole("button", { name: "Nova entrega", exact: true }).click();
  await page
    .getByLabel("Què heu treballat?")
    .fill("Entrega amb un nombre de documents superior al límit.");
  await page.locator("input[type=file]").setInputFiles(
    Array.from({ length: 6 }, (_, i) => ({
      name: `fitxer-${i}.txt`,
      mimeType: "text/plain",
      buffer: Buffer.from("prova"),
    })),
  );
  await page
    .getByRole("button", { name: "Presenta l’entrega", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "fins a 5 fitxers",
  );
  await page.getByRole("button", { name: "Cancel·la", exact: true }).click();
  await expect(page.getByText("2 versions", { exact: true })).toBeVisible();
});

test("BeFirst has a separate profile without exposing private code or school submissions", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Projectes incubats", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Projectes incubats." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "BeFirst", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Veure fitxa", exact: true }).click();
  await expect(page.getByRole("heading", { name: "BeFirst." })).toBeVisible();
  await expect(page.getByText("befirst90.com", { exact: true })).toBeVisible();
  await expect(page.locator("main a[href*='github.com']")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Nova entrega", exact: true }),
  ).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Torna als projectes incubats" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Projectes incubats." }),
  ).toBeVisible();
});
