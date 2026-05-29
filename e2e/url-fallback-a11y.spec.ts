import { test, expect } from "../playwright-fixture";

/**
 * Route-level smoke test for the AI Question Generator page accessibility.
 *
 * Component-level focus-trap, aria-live, and keyboard tests live in
 * `src/components/admin/UrlFallbackCard.test.tsx` (vitest + vitest-axe),
 * which run fast in jsdom and don't require admin auth.
 *
 * This spec just checks that the public route renders without axe violations
 * — the fallback card itself can only be reached after admin auth + a real
 * URL fetch failure, which we cover at the component level.
 */
test.describe("AI Question Generator — route a11y smoke", () => {
  test("admin route renders without high-impact axe violations", async ({ page }) => {
    await page.goto("/admin/ai-question-gen");
    // Page either renders the gate (login) or the generator. Either way it
    // must not have critical/serious axe violations on first paint.
    await page.waitForLoadState("networkidle");

    // Inject axe-core from CDN at runtime (no extra dep in package.json).
    await page.addScriptTag({
      url: "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.0/axe.min.js",
    });
    const violations = await page.evaluate(async () => {
      // @ts-expect-error - axe injected at runtime
      const results = await window.axe.run(document, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
        resultTypes: ["violations"],
      });
      return results.violations.filter(
        (v: { impact: string }) => v.impact === "critical" || v.impact === "serious",
      );
    });
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });
});
