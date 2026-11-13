import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

test("a project plan exports the selected methodology, tasks and design direction", async ({ page }) => {
  await page.goto("/demo");
  await page.getByRole("link", { name: "Direcció de projectes" }).click();
  await expect(page.getByRole("heading", { name: "Direcció de projectes" })).toBeVisible();

  await page.getByLabel("Enfocament").selectOption("adaptatiu");
  await page.getByLabel("Nova tasca").fill("Validar la sala amb dos equips");
  await page.getByLabel("Fase", { exact: true }).selectOption("Implementació");
  await page.getByRole("button", { name: "Afegeix" }).click();
  await page.getByLabel("Validar la sala amb dos equips").selectOption("Feta");
  await page.getByLabel("Enfocament").selectOption("predictiu");
  await expect(page.getByLabel("Validar la sala amb dos equips")).toHaveCount(0);
  await page.getByLabel("Enfocament").selectOption("adaptatiu");
  await expect(page.getByLabel("Validar la sala amb dos equips")).toHaveValue("Feta");

  await page.getByLabel("Estil").selectOption("bohemi");
  await expect(page.getByText(/mobiliari vintage/)).toBeVisible();
  await page.getByLabel("Nom del projecte").fill("Coworking de prova");
  await page.getByLabel("Abast i lliurables").fill("Plànol i proposta de materials");
  await page.getByLabel("Calendari").fill("Tres setmanes");
  await page.getByLabel("Equip i pressupost").fill("Dos participants");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exporta el pla" }).click();
  const path = await (await download).path();
  expect(path).toBeTruthy();
  const plan = JSON.parse(await readFile(path!, "utf8"));
  expect(plan).toMatchObject({
    schemaVersion: 1,
    brief: { title: "Coworking de prova" },
    methodology: "adaptatiu",
    designDirection: "bohemi",
  });
  expect(plan.tasks).toContainEqual({
    title: "Validar la sala amb dos equips",
    phase: "Implementació",
    status: "Feta",
  });

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
