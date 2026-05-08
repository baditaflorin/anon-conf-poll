import { expect, test } from "@playwright/test";

test("static app loads with project links and local DuckDB analytics", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "anon-conf-poll" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Star" })).toHaveAttribute(
    "href",
    "https://github.com/baditaflorin/anon-conf-poll"
  );
  await expect(page.getByRole("link", { name: "PayPal" })).toHaveAttribute(
    "href",
    "https://www.paypal.com/paypalme/florinbadita"
  );
  await expect(page.getByText(/v0\.1\.0 ·/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Room Control" })).toBeVisible({
    timeout: 15_000
  });

  await page.getByTitle("Run DuckDB").click();
  await expect(page.locator(".duckdb-summary")).toContainText("DuckDB", { timeout: 20_000 });
});
