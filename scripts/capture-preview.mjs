import { chromium, devices } from "@playwright/test";

const browser = await chromium.launch({ channel: "chrome" });
try {
  for (const [name, options] of [
    ["desktop", { viewport: { width: 1440, height: 1000 } }],
    ["mobile", { ...devices["iPhone 13"], deviceScaleFactor: 1 }],
  ]) {
    const context = await browser.newContext(options);
    const page = await context.newPage();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("http://127.0.0.1:3100");
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `test-results/${name}-hero.png`, scale: "css" });
    await page.screenshot({
      path: `test-results/${name}-landing.png`,
      fullPage: true,
      scale: "css",
    });
    await page.goto("http://127.0.0.1:3100/register");
    await page.screenshot({
      path: `test-results/${name}-registration.png`,
      fullPage: true,
      scale: "css",
    });
    console.log(
      `${name}: registration width ${await page.evaluate(() => document.documentElement.scrollWidth)}, viewport ${await page.evaluate(() => innerWidth)}`,
    );
    await context.close();
  }
} finally {
  await browser.close();
}
