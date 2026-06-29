/**
 * GUEST-05 — Accommodation comparison: per-plan gate + full UI flow (SPEC-288).
 *
 * Actors: tourist USER on the free / Plus / VIP tiers.
 * Tags: @p1 @guest @billing
 *
 * Preconditions:
 *   - Suite seed has the tourist billing plans (`tourist-plus`, `tourist-vip`)
 *     in `billing_plans` with `name = slug` and livemode = false. Seeded by
 *     `packages/seed/src/required/billingPlans.seed.ts` (part of e2e:seed).
 *   - Suite seed has at least 5 ACTIVE, publicly-visible accommodations so the
 *     VIP over-limit leg (5 ids) can be exercised.
 *
 * Validates:
 *   - Gate (server re-validation on POST /protected/accommodations/compare):
 *       · free tier (no CAN_COMPARE_ACCOMMODATIONS) → 403 ENTITLEMENT_REQUIRED;
 *       · Plus (MAX_COMPARE_ITEMS=2) → 200 for 2 ids, 403 LIMIT_REACHED for 3;
 *       · VIP  (MAX_COMPARE_ITEMS=4) → 200 for 4 ids, 403 LIMIT_REACHED for 5.
 *   - UI flow (Plus user): select 2 accommodations from the listing via the
 *     CompareButton islands → the floating CompareBar appears → "Comparar ahora"
 *     opens the comparison page → the side-by-side matrix renders.
 *
 * The comparison selection is client-only (compare-store + localStorage, D-3);
 * the same per-plan cap is re-validated server-side, which is what the gate
 * legs assert directly against the real endpoint.
 *
 * @see SPEC-288 spec.md § T-014
 */

import { expect, test } from '@playwright/test';
import { createSubscription, createUser } from '../../fixtures/api-helpers.ts';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:18001';
const WEB_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:18321';
const COMPARE_PATH = '/api/v1/protected/accommodations/compare';

type PlanRow = { id: string } & Record<string, unknown>;
type AccRow = { id: string; slug: string } & Record<string, unknown>;

/**
 * Resolve a seeded tourist plan id by slug. The seed stores the plan slug in
 * `billing_plans.name` (see billingPlans.seed.ts) and the e2e sandbox runs with
 * livemode = false, so the QZPay adapter only sees livemode = false rows.
 */
async function resolvePlanIdBySlug(slug: string): Promise<string | null> {
    const rows = await execSQL<PlanRow>(
        'SELECT id FROM billing_plans WHERE name = $1 AND livemode = false LIMIT 1',
        [slug]
    );
    return rows[0]?.id ?? null;
}

/** POST the compare endpoint with the given session cookie and accommodation ids. */
async function postCompare(options: {
    readonly cookie: string;
    readonly ids: readonly string[];
}): Promise<{ readonly status: number; readonly body: unknown }> {
    const response = await fetch(`${API_URL}${COMPARE_PATH}`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            // Better Auth CSRF guard inspects Origin on protected routes when it
            // reconstructs the session from the cookie. Direct fetch() never sends
            // it automatically — set it explicitly to a trusted origin.
            Origin: WEB_URL,
            cookie: options.cookie
        },
        body: JSON.stringify({ ids: [...options.ids] })
    });
    let body: unknown = null;
    try {
        body = await response.json();
    } catch {
        body = null;
    }
    return { status: response.status, body };
}

test.describe('GUEST-05: accommodation comparison gate + UI flow @p1 @guest @billing', () => {
    const userIds: string[] = [];
    let plusPlanId: string | null = null;
    let vipPlanId: string | null = null;
    let accIds: string[] = [];

    test.beforeAll(async () => {
        plusPlanId = await resolvePlanIdBySlug('tourist-plus');
        vipPlanId = await resolvePlanIdBySlug('tourist-vip');
        const accs = await execSQL<AccRow>(
            `SELECT id, slug FROM accommodations
             WHERE lifecycle_state = 'ACTIVE'
               AND visibility = 'PUBLIC'
               AND deleted_at IS NULL
             ORDER BY created_at ASC
             LIMIT 5`
        );
        accIds = accs.map((a) => a.id);
    });

    test.beforeEach(async ({ page }) => {
        await seedCookieConsent(page);
    });

    test.afterEach(async () => {
        if (userIds.length > 0) {
            await cleanupTestUsers(getDbPool(), userIds);
            userIds.length = 0;
        }
    });

    test('gate: free tier is blocked with ENTITLEMENT_REQUIRED', async () => {
        test.fixme(accIds.length < 2, 'Seed needs ≥ 2 ACTIVE accommodations');

        // ── Arrange: a fresh USER with no subscription = tourist-free tier ──
        const free = await createUser({ role: 'USER' }, { apiBaseUrl: API_URL });
        userIds.push(free.id);

        // ── Act: ask to compare two accommodations ──────────────────────────
        const result = await postCompare({ cookie: free.sessionCookie, ids: accIds.slice(0, 2) });

        // ── Assert: 403 with the entitlement gate code ──────────────────────
        expect(result.status).toBe(403);
        expect(JSON.stringify(result.body)).toContain('ENTITLEMENT_REQUIRED');
    });

    test('gate: Plus allows 2, blocks 3 with LIMIT_REACHED', async () => {
        test.fixme(!plusPlanId, 'tourist-plus plan not seeded — cannot run');
        test.fixme(accIds.length < 3, 'Seed needs ≥ 3 ACTIVE accommodations');
        if (!plusPlanId) return;

        // ── Arrange: USER with an active tourist-plus subscription (cap = 2) ──
        const plus = await createUser({ role: 'USER' }, { apiBaseUrl: API_URL });
        userIds.push(plus.id);
        await createSubscription({ userId: plus.id, planId: plusPlanId, status: 'active' });

        // ── Act + Assert: 2 ids pass ────────────────────────────────────────
        const ok = await postCompare({ cookie: plus.sessionCookie, ids: accIds.slice(0, 2) });
        expect(ok.status).toBe(200);
        const okData = (ok.body as { data?: { items?: unknown[] } }).data ?? ok.body;
        expect((okData as { items: unknown[] }).items.length).toBe(2);

        // ── Act + Assert: 3 ids trip the per-plan cap ───────────────────────
        const blocked = await postCompare({ cookie: plus.sessionCookie, ids: accIds.slice(0, 3) });
        expect(blocked.status).toBe(403);
        expect(JSON.stringify(blocked.body)).toContain('LIMIT_REACHED');
    });

    test('gate: VIP allows 4, blocks 5 with LIMIT_REACHED', async () => {
        test.fixme(!vipPlanId, 'tourist-vip plan not seeded — cannot run');
        test.fixme(accIds.length < 5, 'Seed needs ≥ 5 ACTIVE accommodations');
        if (!vipPlanId) return;

        // ── Arrange: USER with an active tourist-vip subscription (cap = 4) ──
        const vip = await createUser({ role: 'USER' }, { apiBaseUrl: API_URL });
        userIds.push(vip.id);
        await createSubscription({ userId: vip.id, planId: vipPlanId, status: 'active' });

        // ── Act + Assert: 4 ids pass ────────────────────────────────────────
        const ok = await postCompare({ cookie: vip.sessionCookie, ids: accIds.slice(0, 4) });
        expect(ok.status).toBe(200);
        const okData = (ok.body as { data?: { items?: unknown[] } }).data ?? ok.body;
        expect((okData as { items: unknown[] }).items.length).toBe(4);

        // ── Act + Assert: 5 ids trip the per-plan cap ───────────────────────
        const blocked = await postCompare({ cookie: vip.sessionCookie, ids: accIds.slice(0, 5) });
        expect(blocked.status).toBe(403);
        expect(JSON.stringify(blocked.body)).toContain('LIMIT_REACHED');
    });

    test('UI flow: select from listing → floating bar → compare page → matrix', async ({
        page
    }) => {
        test.fixme(!plusPlanId, 'tourist-plus plan not seeded — cannot run');
        test.fixme(accIds.length < 2, 'Seed needs ≥ 2 ACTIVE accommodations');
        if (!plusPlanId) return;

        // ── Arrange: a Plus user, with its session attached to the browser ──
        const plus = await createUser({ role: 'USER' }, { apiBaseUrl: API_URL });
        userIds.push(plus.id);
        await createSubscription({ userId: plus.id, planId: plusPlanId, status: 'active' });

        await page.context().addCookies(
            plus.sessionCookie.split('; ').map((c) => {
                const [name, ...rest] = c.split('=');
                return {
                    name: (name ?? '').trim(),
                    value: rest.join('='),
                    url: WEB_URL
                };
            })
        );

        // ── Act: open the listing and add the first two accommodations ──────
        await page.goto(`${WEB_URL}/es/alojamientos/`, { waitUntil: 'domcontentloaded' });

        // CompareButton islands carry an aria-label containing "comparación"
        // (FavoriteButton uses "favoritos", so the regex isolates compare).
        const compareButtons = page.getByRole('button', { name: /comparaci[oó]n/i });
        await expect(compareButtons.first()).toBeVisible({ timeout: 15_000 });
        await compareButtons.nth(0).click();
        await compareButtons.nth(1).click();

        // ── Assert: the floating CompareBar shows the selection ─────────────
        const bar = page.getByRole('region', { name: /comparar alojamientos/i });
        await expect(bar).toBeVisible({ timeout: 10_000 });

        // ── Act: open the comparison page via the bar CTA ───────────────────
        const compareNow = bar.getByRole('link', { name: /comparar ahora/i });
        await expect(compareNow).toBeVisible({ timeout: 10_000 });
        await compareNow.click();

        await page.waitForURL(/\/es\/alojamientos\/comparar\/?/, { timeout: 15_000 });

        // ── Assert: the side-by-side matrix renders with the two columns ────
        const matrix = page.getByRole('table');
        await expect(matrix).toBeVisible({ timeout: 15_000 });
        // Header row: one corner cell + one column per selected accommodation.
        const headerCols = matrix.locator('thead th');
        await expect(headerCols).toHaveCount(3, { timeout: 10_000 });
    });
});
