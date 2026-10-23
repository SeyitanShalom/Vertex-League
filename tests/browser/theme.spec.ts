import { expect, test } from "@playwright/test";

test("theme toggle remembers the choice across reloads and pages", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto("/");
  const root = page.locator("html");
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(root).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(8, 14, 29)");
  expect(await page.evaluate(() => localStorage.getItem("vertex-theme"))).toBe("dark");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: `test-results/theme-dark-${info.project.name}.png`,
    fullPage: true,
  });

  await page.reload();
  await expect(page.getByRole("button", { name: "Switch to light mode" })).toBeEnabled();
  await expect(root).toHaveAttribute("data-theme", "dark");
  await page.goto("/manager/sign-in");
  await expect(root).toHaveAttribute("data-theme", "dark");
  await expect(page.getByLabel("Email address")).toHaveCSS("background-color", "rgb(8, 14, 29)");
  await page.screenshot({
    path: `test-results/theme-form-${info.project.name}.png`,
    fullPage: true,
  });

  const toggle = page.getByRole("button", { name: "Switch to light mode" });
  await toggle.focus();
  await page.keyboard.press("Space");
  await expect(root).toHaveAttribute("data-theme", "light");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await page.reload();
  await expect(page.getByRole("button", { name: "Switch to dark mode" })).toBeEnabled();
  await expect(root).toHaveAttribute("data-theme", "light");
  expect(errors).toEqual([]);
});

test("theme follows the system until the visitor chooses a mode", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  const root = page.locator("html");
  await expect(page.getByRole("button", { name: "Switch to light mode" })).toBeEnabled();
  await expect(root).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(root).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await page.emulateMedia({ colorScheme: "dark" });
  await page.emulateMedia({ colorScheme: "light" });
  await expect(root).toHaveAttribute("data-theme", "dark");
});

test("saved dark theme applies before hydration under the security policy", async ({ page }) => {
  const securityErrors: string[] = [];
  page.on("console", (message) => {
    if (/Content Security Policy|Refused to execute/i.test(message.text())) {
      securityErrors.push(message.text());
    }
  });
  await page.emulateMedia({ colorScheme: "light" });
  await page.addInitScript(() => localStorage.setItem("vertex-theme", "dark"));
  await page.route(/\/_next\/static\/.*\.js(?:\?.*)?$/, (route) => route.abort());
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(8, 14, 29)");
  expect(securityErrors).toEqual([]);
});
