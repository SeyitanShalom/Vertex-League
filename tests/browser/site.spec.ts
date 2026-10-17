import { test, expect } from "@playwright/test";
test("landing page, navigation and registration setup", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page).toHaveTitle(/Vertex League/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("BRING");
  await expect(page.getByText("Registration and payment details are for testing.")).toBeVisible();
  await page.getByRole("link", { name: "Register your team", exact: true }).last().click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByLabel("Team name", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save & continue to payment" })).toBeDisabled();
  await page.getByLabel("Phone number", { exact: false }).fill("08031234567");
  await page.getByRole("button", { name: "Use my phone number" }).click();
  await expect(page.getByLabel("WhatsApp number", { exact: false })).toHaveValue("08031234567");
  await page.goto("/");
  if (info.project.name === "mobile") {
    await page.getByRole("button", { name: "Open menu" }).click();
    await page
      .getByRole("navigation", { name: "Mobile navigation" })
      .getByRole("link", { name: "FAQs" })
      .click();
    await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toHaveCount(0);
  }
  await page
    .locator("summary")
    .filter({ hasText: "What if my team does not pass screening?" })
    .click();
  await expect(page.getByText(/Teams that paid but fail eligibility approval/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: `test-results/vertex-${info.project.name}.png`, fullPage: true });
  expect(errors).toEqual([]);
});
test("private pages and administrator endpoints reject unauthorized access", async ({
  page,
  request,
}) => {
  for (const path of ["/payment/VL-TEST-2026-000001", "/registration/VL-TEST-2026-000001"]) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: "Your access link is required." }),
    ).toBeVisible();
  }
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
  expect((await request.get("/admin/export")).status()).toBe(401);
  expect((await request.get("/api/logo/VL-TEST-2026-000001")).status()).toBe(404);
  expect((await request.get("/api/health")).status()).toBe(503);
});
test("security headers and private-link token handling", async ({ page, request }) => {
  const first = await request.get("/access");
  const second = await request.get("/access");
  const headers = first.headers();
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["content-security-policy"]).toContain("script-src 'self' 'nonce-");
  expect(second.headers()["content-security-policy"]).not.toBe(headers["content-security-policy"]);
  expect(headers["referrer-policy"]).toBe("no-referrer");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-robots-tag"]).toContain("noindex");
  expect(headers["cache-control"]).toContain("no-store");
  await page.goto(`/access#reference=VL-TEST-2026-000001&key=${"a".repeat(43)}`);
  await expect(page).toHaveURL(/\/access$/);
  await expect(page.getByRole("alert").filter({ hasText: "invalid or has expired" })).toBeVisible();
});
