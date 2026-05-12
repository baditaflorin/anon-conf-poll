import { expect, test } from "@playwright/test";

/**
 * Exercises the host-role + phase-lock flow end-to-end in a single browser:
 *
 *   welcome → create room → draft mode → publish polls →
 *   verify voting blocked → lock → verify voting opens →
 *   cast vote → add mid-session poll → unlock back to draft.
 *
 * Cross-device sync is out of scope — that's a CLAUDE.md "two real
 * browsers" smoke that this file deliberately does not replace.
 */
test("host can draft, lock, vote, add a mid-session poll, and unlock", async ({ page }) => {
  await page.goto("/");

  // --- Welcome → create room -------------------------------------------------
  await page.getByRole("button", { name: "Create room" }).click();

  // Dismiss the "Your room is ready" share modal.
  await expect(page.getByRole("heading", { name: "Your room is ready" })).toBeVisible({
    timeout: 15_000
  });
  await page.getByRole("button", { name: /Got it/i }).click();

  // --- Confirm host-in-draft state ------------------------------------------
  await expect(page.getByText(/You're hosting in draft mode/)).toBeVisible();
  await expect(page.getByText("Host (you)")).toBeVisible();
  await expect(page.getByText("Draft — host setting up")).toBeVisible();

  // --- Draft polls from text input ------------------------------------------
  await page.getByLabel("Draft questions (text or CSV)").fill(
    `Opening poll: What should we build today?
- Demo
- Architecture
- Q&A`
  );
  await expect(page.getByText(/1 inferred poll/)).toBeVisible({ timeout: 5_000 });
  await page.getByRole("button", { name: /Publish drafted polls/ }).click();
  await expect(page.getByText("1 poll(s) published.")).toBeVisible();

  // --- Live poll card appears, vote is blocked in draft ---------------------
  const pollCard = page.getByRole("article").filter({ hasText: "What should we build today?" });
  await expect(pollCard).toBeVisible({ timeout: 10_000 });
  await expect(
    pollCard.getByRole("button", { name: /Voting opens after host locks/ })
  ).toBeDisabled();

  // --- Lock the room → voting opens -----------------------------------------
  await page.getByRole("button", { name: /Lock & open voting/ }).click();
  // The toast confirms the action; the phase pill confirms the new state.
  await expect(page.locator(".toast.good").filter({ hasText: "Voting is open." })).toBeVisible();
  await expect(page.getByText("Voting open", { exact: true })).toBeVisible();

  // --- Cast a vote ----------------------------------------------------------
  await pollCard.getByText("Demo").click();
  await pollCard.getByRole("button", { name: /Cast anonymous vote/ }).click();
  await expect(page.getByText("Anonymous vote published.")).toBeVisible({ timeout: 30_000 });
  await expect(pollCard.getByRole("button", { name: /Vote verified/ })).toBeDisabled();

  // --- Add a mid-session poll -----------------------------------------------
  await page.getByRole("button", { name: /^Add poll$/ }).click();
  await expect(page.getByText("Blank poll added. Edit it inline.")).toBeVisible();
  await expect(page.getByRole("article").filter({ hasText: "New question" })).toBeVisible({
    timeout: 5_000
  });

  // --- Unlock back to draft -------------------------------------------------
  await page.getByRole("button", { name: /Unlock \(back to draft\)/ }).click();
  await expect(page.getByText("Back to draft — questions are editable again.")).toBeVisible();
  await expect(page.getByText(/You're hosting in draft mode/)).toBeVisible();
});
