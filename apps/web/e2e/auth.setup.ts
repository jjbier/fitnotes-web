import { test as setup } from "@playwright/test";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

const STORAGE_STATE = path.join(__dirname, ".auth/user.json");
const EMPTY_STATE = JSON.stringify({ cookies: [], origins: [] });

setup("autenticar usuario de prueba", async ({ page }) => {
  await mkdir(path.dirname(STORAGE_STATE), { recursive: true });

  const email = process.env["PLAYWRIGHT_USER_EMAIL"];
  const password = process.env["PLAYWRIGHT_USER_PASSWORD"];

  if (!email || !password) {
    // Save empty state so dependent project can start (tests will skip themselves)
    await writeFile(STORAGE_STATE, EMPTY_STATE);
    return;
  }

  await page.goto("/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/dashboard/, { timeout: 20_000 });

  await page.context().storageState({ path: STORAGE_STATE });
});
