import { test, expect } from "@playwright/test";
test.skip(
  process.env.RUN_CONNECTED_E2E === "1",
  "Independent local lab is checked in the web suite",
);
test("validation draft can be exported and explicitly restored without losing work on bad imports", async ({
  page,
}) => {
  await page.goto("/lab");
  await page
    .getByLabel("Nom del projecte", { exact: true })
    .fill("Projecte de prova");
  await page
    .getByLabel("Problema", { exact: true })
    .fill("Una dificultat observada");
  await page
    .getByLabel("Públic inicial", { exact: true })
    .fill("Un grup concret");
  await expect(page.getByRole("status").first()).toContainText("hipòtesi");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exporta l’esborrany" }).click();
  const saved = await (await download).path();
  if (!saved) throw new Error("Missing exported draft");
  await page.reload();
  await expect(
    page.getByLabel("Nom del projecte", { exact: true }),
  ).toHaveValue("");
  await page.getByLabel("Fitxer d’esborrany").setInputFiles(saved);
  await page.getByRole("button", { name: "Substitueix l’esborrany" }).click();
  await expect(
    page.getByLabel("Nom del projecte", { exact: true }),
  ).toHaveValue("Projecte de prova");
  await page
    .getByLabel("Fitxer d’esborrany")
    .setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"schema":2}'),
    });
  await expect(
    page.getByRole("alert").filter({ hasText: "No hem pogut importar" }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Nom del projecte", { exact: true }),
  ).toHaveValue("Projecte de prova");
  await page.getByLabel("Fitxer d’esborrany").setInputFiles(saved);
  await page.getByRole("button", { name: "Cancel·la la importació" }).click();
  await expect(
    page.getByRole("region", { name: "Confirma la importació" }),
  ).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
