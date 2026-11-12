import { test, expect, type Page } from "@playwright/test";
test.skip(
  process.env.RUN_CONNECTED_E2E !== "1",
  "Requires isolated OIDC/API/storage services",
);
async function enter(page: Page, account: "Professor" | "Alumne") {
  await page.goto("http://localhost:3400/private");
  await page
    .getByRole("button", { name: "Continua amb el teu compte", exact: true })
    .click();
  await page
    .getByRole("link", { name: `${account} de proves`, exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Els teus projectes", exact: true }),
  ).toBeVisible();
}
test("private UI enforces step-up, quarantines files and separates accounts", async ({
  browser,
}) => {
  test.setTimeout(60000);
  const ownerContext = await browser.newContext({ ignoreHTTPSErrors: true });
  const otherContext = await browser.newContext({ ignoreHTTPSErrors: true });
  const owner = await ownerContext.newPage();
  // Enter Campus without a context first. Visiting private space must challenge again.
  await owner.goto("http://localhost:3400/campus");
  await owner
    .getByRole("button", { name: "Continua amb el teu compte", exact: true })
    .click();
  await owner
    .getByRole("link", { name: "Professor de proves", exact: true })
    .click();
  await owner.goto("http://localhost:3400/private");
  await expect(
    owner.getByRole("heading", { name: "Reforça l’accés al teu espai" }),
  ).toBeVisible();
  await owner
    .getByRole("button", { name: "Reforça l’accés", exact: true })
    .click();
  await owner
    .getByRole("link", { name: "Professor de proves", exact: true })
    .click();
  await owner.getByLabel("Nom del nou projecte").fill("Startup privada A");
  await owner.getByRole("button", { name: "Crea un espai privat" }).click();
  await expect(
    owner.getByRole("heading", { name: "Startup privada A", exact: true }),
  ).toBeVisible();
  await owner
    .getByLabel("Document del projecte", { exact: true })
    .setInputFiles({
      name: "projecte.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("private browser test document"),
    });
  await owner.getByRole("button", { name: "Puja a quarantena" }).click();
  await expect(
    owner.getByRole("heading", { name: "projecte.txt", exact: true }),
  ).toBeVisible();
  const download = owner.getByRole("button", {
    name: "Descarrega projecte.txt",
    exact: true,
  });
  await expect
    .poll(async () => {
      await owner.getByRole("button", { name: "Actualitza l’estat" }).click();
      return download.isEnabled();
    })
    .toBe(true);
  const event = owner.waitForEvent("download");
  await download.click();
  expect((await event).suggestedFilename()).toBe("projecte.txt");
  const ownVaults = await (
    await owner.request.get("http://localhost:3400/api/private/vaults")
  ).json();
  const vault = ownVaults.find(
    (row: { name: string }) => row.name === "Startup privada A",
  );
  const docs = await (
    await owner.request.get(
      `http://localhost:3400/api/private/vaults/${vault.id}/documents`,
    )
  ).json();
  const other = await otherContext.newPage();
  await enter(other, "Alumne");
  await expect(
    other.getByText("Startup privada A", { exact: true }),
  ).toHaveCount(0);
  const denied = await other.request.get(
    `http://localhost:3400/api/private/vaults/${vault.id}/documents/${docs[0].id}/content`,
  );
  expect(denied.status()).toBe(404);
  const crossOrigin = await owner.request.post(
    "http://localhost:3400/api/private/vaults",
    {
      headers: { Origin: "https://attacker.example" },
      data: { name: "Invalid" },
    },
  );
  expect(crossOrigin.status()).toBe(403);
  const missingOrigin = await owner.request.post(
    "http://localhost:3400/api/private/vaults",
    { data: { name: "Invalid" } },
  );
  expect(missingOrigin.status()).toBe(403);
  const anonymous = await browser.newContext();
  const forged = await anonymous.request.get(
    "http://localhost:3400/api/private/vaults",
    { headers: { Authorization: "Bearer forged" } },
  );
  expect(forged.status()).toBe(401);
  await anonymous.close();
  await owner
    .getByLabel("Document del projecte", { exact: true })
    .setInputFiles({
      name: "blocked.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("blocked-test"),
    });
  await owner.getByRole("button", { name: "Puja a quarantena" }).click();
  const blocked = owner.getByRole("article").filter({
    has: owner.getByRole("heading", { name: "blocked.txt", exact: true }),
  });
  await expect
    .poll(async () => {
      await owner.getByRole("button", { name: "Actualitza l’estat" }).click();
      return blocked.innerText();
    })
    .toContain("Bloquejat");
  await expect(
    owner.getByRole("button", { name: "Descarrega blocked.txt", exact: true }),
  ).toBeDisabled();
  expect(await owner.evaluate(() => localStorage.length)).toBe(0);
  await owner.screenshot({
    path: test.info().outputPath("private-desktop.png"),
    fullPage: true,
  });
  await owner.setViewportSize({ width: 390, height: 844 });
  expect(
    await owner.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await owner.screenshot({
    path: test.info().outputPath("private-mobile.png"),
    fullPage: true,
  });
  await ownerContext.close();
  await otherContext.close();
});
