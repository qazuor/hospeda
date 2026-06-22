/**
 * GUEST-04 — Conversational AI search panel: query → results → refinement.
 *
 * Actors: Anonymous guest.
 * Tags: @p1 @guest @ai
 *
 * Preconditions:
 *   - Suite seed populates accommodations in the DB.
 *   - The `search` AI feature is ENABLED in the target environment's AI settings.
 *     (This test requires a live AI provider — OpenAI-compatible endpoint — and
 *     will fail if the feature flag is off or the provider is unreachable.)
 *
 * NOTE: Runs in CI/staging where the app + AI provider are live.
 * DO NOT run locally unless `wt:up` is active and AI keys are configured.
 *
 * Flow validated (SPEC-212 §7):
 *   1. Navigate to `/es/alojamientos/` — panel textarea + send button are visible.
 *   2. Type a conversational query, submit via send button.
 *   3. Panel reaches a settled state: in-panel results section appears (cards,
 *      empty-state, or skeleton that resolves) AND an assistant reply is committed.
 *   4. Type a refinement query, submit — panel updates (new settled state /
 *      new assistant reply). Demonstrates multi-turn conversation.
 *
 * Flakiness notes:
 *   - Reply text and filter values are LLM-non-deterministic. Assertions are
 *     purely structural — we check that the reply region is non-empty and that
 *     the results section renders, NOT specific text or card counts.
 *   - Active-filter chips are asserted optionally: they appear only when the LLM
 *     extracts structured intent, which is not guaranteed for every query. The
 *     chips assertion is wrapped in a conditional check and will not fail the test
 *     if chips are absent.
 *   - Timeouts are generous (60 s first turn, 45 s refinement) to accommodate
 *     cold LLM provider latency and slow DB hydration in CI environments.
 *
 * @see SPEC-212 spec.md §7 — conversational search acceptance criteria
 */

import { expect, test } from '@playwright/test';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';

const WEB_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:4321';

/** Generous timeout for the first AI turn (cold provider + results hydration). */
const FIRST_TURN_TIMEOUT = 60_000;

/** Slightly tighter timeout for the second turn (provider is warm). */
const SECOND_TURN_TIMEOUT = 45_000;

test.describe('GUEST-04: conversational AI search panel @p1 @guest @ai', () => {
    test.beforeEach(async ({ page }) => {
        await seedCookieConsent(page);
    });

    test('anonymous user can query the AI panel and refine results', async ({ page }) => {
        // ── 1. Navigate to the listings page ──────────────────────────────────
        await page.goto(`${WEB_URL}/es/alojamientos/`, { waitUntil: 'domcontentloaded' });
        expect(page.url()).toContain('/alojamientos/');

        // ── 2. Assert the conversational search panel is present ───────────────
        // The panel is a <section aria-label="Panel de búsqueda conversacional con IA">.
        const panel = page.getByRole('region', {
            name: 'Panel de búsqueda conversacional con IA'
        });
        await expect(panel).toBeVisible({ timeout: 10_000 });

        // The composer textarea (label: "Mensaje") and send button must be ready.
        const textarea = panel.getByRole('textbox', { name: 'Mensaje' });
        const sendButton = panel.getByRole('button', { name: 'Enviar mensaje' });
        await expect(textarea).toBeVisible({ timeout: 10_000 });
        await expect(sendButton).toBeVisible({ timeout: 10_000 });

        // ── 3. Submit a first query ────────────────────────────────────────────
        await textarea.fill('cabaña para 4 con pileta');
        await sendButton.click();

        // ── 4. Wait for panel to reach a settled state after first turn ────────
        //
        // "Settled" means: the AI has responded AND results have hydrated (or the
        // API returned zero results). We wait for EITHER:
        //   a) [data-testid="ai-search-results"] to appear (results section mounted),
        //   b) the "Resultados encontrados" list to be present (results with cards),
        //   c) the empty-state paragraph to appear (zero results is still settled),
        //   d) AND at least one committed assistant reply to appear.
        //
        // We do NOT assert specific card count or exact reply text.

        const resultsSection = panel.locator('[data-testid="ai-search-results"]');
        const resultsGrid = panel.getByRole('list', { name: 'Resultados encontrados' });
        const emptyState = panel.getByText('No encontramos alojamientos con esos filtros.', {
            exact: true
        });
        const assistantReply = panel.locator('[data-testid="ai-search-reply"]').first();

        // Wait for the results section wrapper to mount (signals filters SSE arrived
        // and the accommodations fetch started or completed).
        await expect(resultsSection).toBeVisible({ timeout: FIRST_TURN_TIMEOUT });

        // Wait for skeleton / loading state to resolve: either the results grid OR
        // the empty-state paragraph must become visible (loading skeleton disappears).
        await expect(resultsGrid.or(emptyState)).toBeVisible({
            timeout: FIRST_TURN_TIMEOUT
        });

        // A committed assistant reply bubble must be present (reply SSE completed).
        await expect(assistantReply).toBeVisible({ timeout: FIRST_TURN_TIMEOUT });
        // The reply must contain some text — not just an empty bubble.
        await expect(assistantReply).not.toBeEmpty();

        // ── 5. Optional: check active-filter chips appeared ────────────────────
        // Chips only render when the LLM extracts structured intent. We check
        // opportunistically — fail-open so the test is not brittle on chip presence.
        const chipsList = panel.getByRole('list', { name: 'Filtros activos' });
        const chipsCount = await chipsList.count();
        if (chipsCount > 0) {
            await expect(chipsList).toBeVisible({ timeout: 5_000 });
        }

        // ── 6. Submit a refinement query ───────────────────────────────────────
        // The textarea is re-enabled after streaming ends. Wait for it.
        await expect(textarea).toBeEnabled({ timeout: FIRST_TURN_TIMEOUT });
        await textarea.fill('más barata, hasta 50 mil');
        await sendButton.click();

        // ── 7. Assert the panel accepts the refinement and updates ─────────────
        //
        // After the second turn the panel must show a new (second) assistant reply.
        // We assert there are now at least 2 committed assistant bubbles — the panel
        // has progressed through a second turn.

        await expect(panel.locator('[data-testid="ai-search-reply"]').nth(1)).toBeVisible({
            timeout: SECOND_TURN_TIMEOUT
        });

        // Results section should still be mounted (may have updated results or same).
        await expect(resultsSection).toBeVisible({ timeout: SECOND_TURN_TIMEOUT });

        // ── 8. Final settled state ─────────────────────────────────────────────
        // After the second turn completes, the loading/streaming state should resolve.
        await expect(resultsGrid.or(emptyState)).toBeVisible({
            timeout: SECOND_TURN_TIMEOUT
        });
    });
});
