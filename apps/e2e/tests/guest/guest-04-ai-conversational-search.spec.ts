/**
 * GUEST-04 — Conversational AI search panel is members-only for anonymous
 * visitors.
 *
 * Actors: Anonymous guest.
 * Tags: @p1 @guest @ai
 *
 * Preconditions: suite seed populates accommodations in the DB. Nothing here
 * talks to an AI provider — see below.
 *
 * ## The deleted second test (HOS-1267)
 *
 * This file used to hold a second test, "authenticated user can query the AI
 * panel and refine results", which was `test.fixme(true, 'ai_settings is not
 * seeded in the E2E environment — no AI provider')` — permanently off, and
 * counted in the inventory as coverage of conversational search.
 *
 * It was deleted rather than repaired, because seeding `ai_settings` would not
 * have made it pass. The body navigated as an ANONYMOUS visitor and then
 * reached for the composer — and the very test above this one proves an
 * anonymous visitor is served `LoginCta` with no composer at all (SPEC-265 W14
 * made conversational search members-only). So the test asserted a flow that
 * the product had already removed, on top of an environment that could not run
 * it. Its own comment conceded the assertions would have to be "re-pointed at
 * an authenticated session".
 *
 * Restoring real coverage of the authenticated multi-turn flow needs three
 * things this issue does not deliver: an `ai_settings` row in the E2E seed, a
 * deterministic AI provider stub that can serve SSE turns (a live LLM makes a
 * `@p0`-gate suite slow, paid and non-deterministic), and an authenticated
 * session in the spec. That is a feature-sized piece of work and belongs to the
 * AI-search testing effort, not to a disabled file that looked like a guard.
 *
 * @see SPEC-212 spec.md §7 — conversational search acceptance criteria
 * @see https://linear.app/hospeda-beta/issue/HOS-1267
 */

import { expect, test } from '@playwright/test';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';

const WEB_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:4321';

test.describe('GUEST-04: conversational AI search panel @p1 @guest @ai', () => {
    test.beforeEach(async ({ page }) => {
        await seedCookieConsent(page);
    });

    test('anonymous visitor is asked to sign in — AI search is members-only', async ({ page }) => {
        // SPEC-265 W14 made conversational search members-only: SearchChatPanel
        // renders LoginCta instead of the composer for anonymous visitors. This spec
        // used to drive a full query + refinement as an anonymous user, which is a
        // product rule that no longer exists, so it could never pass again. Note
        // LoginCta reuses the panel's aria-label, so asserting the region alone does
        // NOT prove the chat is usable — the composer is what separates the two.
        await page.goto(`${WEB_URL}/es/alojamientos/`, { waitUntil: 'domcontentloaded' });
        expect(page.url()).toContain('/alojamientos/');

        // The listing no longer renders SearchChatPanel inline: AiSearchEntry mounts
        // a trigger and only mounts the panel once its drawer is open, so waiting
        // for the panel straight after page load found nothing.
        const aiTrigger = page.getByRole('button', { name: 'Buscá con IA' }).first();
        await expect(aiTrigger).toBeVisible({ timeout: 15_000 });
        await aiTrigger.click();

        const panel = page.getByRole('region', {
            name: 'Panel de búsqueda conversacional con IA'
        });
        await expect(panel).toBeVisible({ timeout: 10_000 });

        // The sign-in prompt is shown…
        await expect(panel.getByText('Iniciá sesión para buscar con IA')).toBeVisible({
            timeout: 10_000
        });
        // …and the composer is absent, which is the part that actually gates usage.
        await expect(panel.getByRole('textbox', { name: 'Mensaje' })).toHaveCount(0);
        await expect(panel.getByRole('button', { name: 'Enviar mensaje' })).toHaveCount(0);
    });
});
