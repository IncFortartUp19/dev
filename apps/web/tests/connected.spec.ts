import { test, expect, type Page } from "@playwright/test";

test.skip(
  process.env.RUN_CONNECTED_E2E !== "1",
  "Requires the isolated OIDC and API test services.",
);

async function login(page: Page, account: "Professor" | "Alumne") {
  await page.goto("http://localhost:3400/campus");
  await page
    .getByRole("button", { name: "Continua amb el teu compte", exact: true })
    .click();
  await page
    .getByRole("link", { name: `${account} de proves`, exact: true })
    .click();
  await expect(page).toHaveURL(/\/campus$/);
  await expect(
    page.getByText("Compte connectat", { exact: true }),
  ).toBeVisible();
}

test("separate teacher and student accounts share the full invitation, submission and review flow", async ({
  browser,
}) => {
  test.setTimeout(60000);
  const teacherContext = await browser.newContext({ ignoreHTTPSErrors: true });
  const studentContext = await browser.newContext({ ignoreHTTPSErrors: true });
  const teacher = await teacherContext.newPage();
  const student = await studentContext.newPage();
  await login(teacher, "Professor");
  await teacher
    .getByRole("button", { name: "Crea el primer espai docent", exact: true })
    .click();
  await teacher.getByLabel("Nom de l’espai").fill("Campus entre comptes");
  await teacher
    .getByLabel("Assignatura o àmbit")
    .fill("Innovació col·laborativa");
  await teacher
    .getByRole("button", { name: "Crea l’espai", exact: true })
    .click();
  await expect(
    teacher.getByText("Professor d’aquest espai", { exact: true }),
  ).toBeVisible();
  await teacher
    .getByRole("button", { name: "Invita un alumne", exact: true })
    .click();
  const invitation = await teacher
    .getByLabel("Enllaç d’invitació", { exact: true })
    .inputValue();
  expect(invitation).toContain("/campus/join#token=");
  await student.goto(invitation);
  await expect(
    student.getByRole("button", {
      name: "Identifica’t per continuar",
      exact: true,
    }),
  ).toBeVisible();
  expect(student.url()).not.toContain("token=");
  await student
    .getByRole("button", { name: "Identifica’t per continuar", exact: true })
    .click();
  await student
    .getByRole("link", { name: "Alumne de proves", exact: true })
    .click();
  await expect(
    student.getByText("Laia de proves", { exact: true }),
  ).toBeVisible();
  await student
    .getByRole("button", { name: "Accepta la invitació", exact: true })
    .click();
  await student
    .getByRole("link", { name: "Obre el Campus", exact: true })
    .click();
  await expect(
    student.getByText("Alumne d’aquest espai", { exact: true }),
  ).toBeVisible();
  await expect(
    student.getByRole("button", { name: "Invita un alumne", exact: true }),
  ).toHaveCount(0);
  await student
    .getByRole("button", { name: "Crea un equip", exact: true })
    .click();
  await student.getByLabel("Nom de l’equip").fill("Equip compartit");
  await student
    .getByRole("button", { name: "Crea l’equip", exact: true })
    .click();
  await student
    .getByRole("button", { name: "Nou projecte", exact: true })
    .click();
  await student.getByLabel("Nom del projecte").fill("Un campus més verd");
  await student
    .getByLabel("Quin problema voleu resoldre?")
    .fill("Reduïm el malbaratament d’aigua del campus amb un pilot compartit.");
  await student
    .getByRole("button", { name: "Crea el projecte", exact: true })
    .click();
  await student
    .getByRole("button", { name: "Nova entrega", exact: true })
    .click();
  await student
    .getByLabel("Què heu treballat?")
    .fill(
      "Primera proposta, entrevistes i indicadors del pilot de sostenibilitat.",
    );
  await student
    .getByRole("button", { name: "Presenta l’entrega", exact: true })
    .click();
  await expect(
    student.getByText("Pendent d’avaluació del professor.", { exact: true }),
  ).toBeVisible();
  await expect(
    student.getByRole("button", { name: "Publica l’avaluació", exact: true }),
  ).toHaveCount(0);
  await teacher
    .getByRole("button", { name: "Actualitza les dades", exact: true })
    .click();
  await teacher.getByRole("button", { name: /Un campus més verd/ }).click();
  for (const [label, value] of [
    ["Definició del problema", "8"],
    ["Proposta i viabilitat", "7"],
    ["Desenvolupament i evidències", "6"],
    ["Comunicació i presentació", "8"],
  ])
    await teacher.getByLabel(label, { exact: true }).fill(value);
  await teacher
    .getByLabel("Comentari per a l’equip")
    .fill("Bon treball. Cal concretar el pressupost del primer pilot.");
  await teacher
    .getByRole("button", { name: "Publica l’avaluació", exact: true })
    .click();
  await expect(teacher.locator(".feedback")).toContainText("7,2 / 10");
  await student
    .getByRole("button", { name: "Actualitza les dades", exact: true })
    .click();
  await expect(student.locator(".feedback")).toContainText(
    "Cal concretar el pressupost",
  );
  await student
    .getByRole("button", { name: "Nova entrega", exact: true })
    .click();
  await student
    .getByLabel("Què heu treballat?")
    .fill(
      "Segona versió amb pressupost i indicadors revisats després del feedback.",
    );
  await student
    .getByRole("button", { name: "Presenta l’entrega", exact: true })
    .click();
  await expect(
    student.getByRole("button", { name: "Versió 2", exact: true }),
  ).toBeVisible();
  await student.getByRole("button", { name: "Versió 1", exact: false }).click();
  await expect(student.locator(".feedback")).toContainText("7,2 / 10");
  const session = await student.request.get(
    "http://localhost:3400/api/auth/session",
  );
  const sessionBody = await session.text();
  expect(sessionBody).not.toContain("accessToken");
  expect(sessionBody).not.toContain("access_token");
  expect(sessionBody).not.toContain("eyJ");
  const cookies = await studentContext.cookies();
  const sessionCookies = cookies.filter((c) =>
    c.name.startsWith("authjs.session-token"),
  );
  expect(sessionCookies.length).toBeGreaterThan(0);
  expect(sessionCookies.every((c) => c.httpOnly && c.sameSite === "Lax")).toBe(
    true,
  );
  expect(await student.evaluate(() => localStorage.length)).toBe(0);
  // A user can teach a different space without becoming a teacher in this course.
  const originalSpaces = await (
    await student.request.get(
      "http://localhost:3400/api/campus/spaces?limit=100",
    )
  ).json();
  const originalSpace = originalSpaces.find(
    (row: { title: string }) => row.title === "Campus entre comptes",
  );
  await student
    .getByRole("button", { name: "Crea un espai docent", exact: true })
    .click();
  await student.getByLabel("Nom de l’espai").fill("Espai propi de Laia");
  await student.getByLabel("Assignatura o àmbit").fill("Un altre grup");
  await student
    .getByRole("button", { name: "Crea l’espai", exact: true })
    .click();
  await expect(
    student.getByText("Professor d’aquest espai", { exact: true }),
  ).toBeVisible();
  await student.getByLabel("Espai docent actiu").selectOption(originalSpace.id);
  await expect(
    student.getByText("Alumne d’aquest espai", { exact: true }),
  ).toBeVisible();
  const courseProjects = await (
    await student.request.get(
      `http://localhost:3400/api/campus/spaces/${originalSpace.id}/projects?limit=100`,
    )
  ).json();
  const versions = await (
    await student.request.get(
      `http://localhost:3400/api/campus/projects/${courseProjects[0].id}/submissions?limit=100`,
    )
  ).json();
  const blocked = await student.request.post(
    `http://localhost:3400/api/campus/submissions/${versions.at(-1).id}/reviews`,
    {
      headers: { Origin: "http://localhost:3400" },
      data: { scores: [10, 10, 10, 10], feedback: "No es pot autoavaluar." },
    },
  );
  expect(blocked.status()).toBe(403);
  await student.goto(invitation);
  await student
    .getByRole("button", { name: "Accepta la invitació", exact: true })
    .click();
  await expect(
    student.getByRole("alert").filter({ hasText: "Aquesta invitació" }),
  ).toContainText("ja s’ha utilitzat");
  await teacherContext.close();
  await studentContext.close();
});

test("proxy rejects anonymous requests, client bearer tokens and cross-origin mutations", async ({
  browser,
}) => {
  const anonymous = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await anonymous.newPage();
  const origin = "http://localhost:3400";
  expect(
    (await anonymous.request.get(`${origin}/api/campus/me`)).status(),
  ).toBe(401);
  expect(
    (
      await anonymous.request.get(`${origin}/api/campus/me`, {
        headers: { Authorization: "Bearer caller-supplied-token" },
      })
    ).status(),
  ).toBe(401);
  await login(page, "Professor");
  expect(
    (
      await anonymous.request.post(`${origin}/api/campus/spaces`, {
        headers: { Origin: "https://untrusted.example" },
        data: { title: "Untrusted", subject: "Must fail" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await anonymous.request.post(`${origin}/api/campus/spaces`, {
        data: { title: "No origin", subject: "Must fail" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (await anonymous.request.get(`${origin}/api/campus/secrets`)).status(),
  ).toBe(404);
  await page
    .getByRole("button", { name: "Tanca la sessió", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/login$/);
  expect(
    (await anonymous.request.get(`${origin}/api/campus/me`)).status(),
  ).toBe(401);
  await anonymous.close();
});
