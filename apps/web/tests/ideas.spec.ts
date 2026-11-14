import { test, expect, type Page } from "@playwright/test";

test.skip(
  process.env.RUN_CONNECTED_E2E !== "1",
  "Requires isolated OIDC and API test services.",
);

async function signIn(page: Page, account: "Professor" | "Alumne") {
  await page.goto("http://localhost:3400/idees");
  await page
    .getByRole("button", { name: "Continua amb el teu compte", exact: true })
    .click();
  await page
    .getByRole("link", { name: `${account} de proves`, exact: true })
    .click();
  await expect(page).toHaveURL(/\/idees$/);
  await expect(
    page.getByRole("heading", { name: "Una idea comença amb una pregunta." }),
  ).toBeVisible();
}

test("personal ideas persist across reload and remain invisible to another account", async ({
  browser,
}) => {
  test.setTimeout(90000);
  const ownerContext = await browser.newContext({ ignoreHTTPSErrors: true });
  const otherContext = await browser.newContext({ ignoreHTTPSErrors: true });
  const owner = await ownerContext.newPage();
  const other = await otherContext.newPage();

  await signIn(owner, "Professor");
  await owner.getByLabel("Pregunta o necessitat").fill("Què necessita el barri?");
  await owner.getByRole("button", { name: "Desa al compte privat" }).click();
  await expect(
    owner.getByText("Esborrany desat al teu compte privat.", { exact: false }),
  ).toBeVisible();

  const response = await owner.request.get(
    "http://localhost:3400/api/private/idea-drafts",
  );
  expect(response.ok()).toBe(true);
  const own = await response.json();
  expect(own).toHaveLength(1);
  expect(own[0].visibility).toBe("private");
  expect(own[0].next_test).toBe("");
  const draftId = own[0].id;

  await owner.reload();
  await owner
    .getByRole("button", { name: /Què necessita el barri\?/ })
    .click();
  await expect(owner.getByLabel("Pregunta o necessitat")).toHaveValue(
    "Què necessita el barri?",
  );

  await signIn(other, "Alumne");
  await expect(other.getByText("Què necessita el barri?")).toHaveCount(0);
  const hidden = await other.request.get(
    `http://localhost:3400/api/private/idea-drafts/${draftId}`,
  );
  expect(hidden.status()).toBe(404);
  const forbidden = await other.request.post(
    `http://localhost:3400/api/private/idea-drafts/${draftId}`,
    {
      headers: { Origin: "http://localhost:3400" },
      data: { question: "Intent no autoritzat" },
    },
  );
  expect(forbidden.status()).toBe(404);
  await ownerContext.close();
  await otherContext.close();
});
