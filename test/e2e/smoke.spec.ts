import { expect, test } from "@playwright/test";

test("static app loads with welcome screen and project links", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "anon-conf-poll" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Source" })).toHaveAttribute(
    "href",
    "https://github.com/baditaflorin/anon-conf-poll"
  );

  const hostButton = page.getByRole("button", { name: "Create room" });
  await expect(hostButton).toBeVisible({ timeout: 15_000 });
  await hostButton.click();

  // The "Your room is ready" share modal opens — dismiss it before
  // asserting on the room shell behind it.
  const shareModal = page.getByRole("heading", { name: "Your room is ready" });
  await expect(shareModal).toBeVisible({ timeout: 15_000 });
  await page
    .getByRole("button", { name: /Got it|Close|Dismiss/i })
    .first()
    .click();

  await expect(page.getByRole("heading", { name: "Room", exact: true })).toBeVisible({
    timeout: 15_000
  });
  // New room lands in draft mode with the host banner.
  await expect(page.getByText(/You're hosting in draft mode/)).toBeVisible();
});
