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

  await page.getByLabel("Roster CSV").fill(`First Name,Last Name,Email,Approval Status
Ada,Lovelace,ada@example.com,approved
Grace,Hopper,grace@example.com,approved`);
  await expect(page.getByText("2 eligible attendee(s)")).toBeVisible();

  await page.getByLabel("Poll draft").fill(`Launch poll: What should we ship?
- Roster import
- Better invite parsing
- Debug view`);
  await expect(page.getByText("1 inferred poll(s)")).toBeVisible();

  await page.getByTitle("Run DuckDB").click();
  await expect(page.locator(".duckdb-summary")).toContainText("DuckDB", { timeout: 20_000 });
});
