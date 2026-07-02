/**
 * GUEST-06 — Exclusive deals & VIP promotions (HOS-21).
 *
 * Actors: tourist USER on the free / Plus / VIP tiers; a HOST owner.
 * Tags: @p1 @guest @billing
 *
 * Preconditions:
 *   - Suite seed has the tourist billing plans (`tourist-plus`, `tourist-vip`)
 *     and the `owner-pro` plan in `billing_plans` with `name = slug` and
 *     livemode = false. Seeded by packages/seed/src/required/billingPlans.seed.ts.
 *   - Suite seed has at least 1 ACTIVE, publicly-visible (destination-linked)
 *     accommodation available via getAnyCityDestinationId().
 *
 * Validates (HOS-21 T-016 subtasks):
 *   - Free tourist: GET /exclusive-deals → 403 ENTITLEMENT_REQUIRED (API), and
 *     the account page shows the upgrade CTA with no deal items rendered (UI).
 *   - Tourist-plus: sees the plus-tier deal on a visible accommodation, does
 *     NOT see the vip-only deal, and never sees the deal on a
 *     visibility-restricted accommodation.
 *   - Tourist-vip: sees BOTH the plus-tier and vip-only deals (visible
 *     accommodation), the vip-only one carries the "Solo VIP" badge, and the
 *     restricted-accommodation deal is still excluded for this tier too.
 *   - Owner (HOST, owner-pro): can mark a new promotion VIP-only via the
 *     "Exclusiva para plan VIP" toggle on the create form, and the created
 *     row persists with tourist_audience = 'vip'.
 *
 * @see HOS-21 spec.md T-016
 */

import { expect, test } from '@playwright/test';
import {
    createSubscription,
    createUser,
    getAnyCityDestinationId
} from '../../fixtures/api-helpers.ts';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:18001';
const WEB_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:18321';
const EXCLUSIVE_DEALS_PATH = '/api/v1/protected/owner-promotions/exclusive-deals';
const EXCLUSIVE_DEALS_PAGE = `${WEB_URL}/es/mi-cuenta/ofertas-exclusivas/`;

type PlanRow = { id: string } & Record<string, unknown>;
type AccommodationRow = { id: string } & Record<string, unknown>;
type OwnerPromotionRow = { id: string; tourist_audience: string } & Record<string, unknown>;

/**
 * Resolve a seeded plan id by slug. The seed stores the plan slug in
 * `billing_plans.name` (see billingPlans.seed.ts) and the e2e sandbox runs
 * with livemode = false, so the QZPay adapter only sees livemode = false rows.
 */
async function resolvePlanIdBySlug(slug: string): Promise<string | null> {
    const rows = await execSQL<PlanRow>(
        'SELECT id FROM billing_plans WHERE name = $1 AND livemode = false LIMIT 1',
        [slug]
    );
    return rows[0]?.id ?? null;
}

/** Attach a Better-Auth session cookie (from a `sessionCookie` string) to the browser context. */
async function attachSession(
    page: import('@playwright/test').Page,
    sessionCookie: string
): Promise<void> {
    await page.context().addCookies(
        sessionCookie.split('; ').map((c) => {
            const [name, ...rest] = c.split('=');
            return { name: (name ?? '').trim(), value: rest.join('='), url: WEB_URL };
        })
    );
}

/** GET the exclusive-deals endpoint directly with a session cookie. */
async function getExclusiveDeals(
    cookie: string
): Promise<{ readonly status: number; readonly body: unknown }> {
    const response = await fetch(`${API_URL}${EXCLUSIVE_DEALS_PATH}`, {
        headers: { accept: 'application/json', cookie }
    });
    let body: unknown = null;
    try {
        body = await response.json();
    } catch {
        body = null;
    }
    return { status: response.status, body };
}

test.describe('GUEST-06: exclusive deals & VIP promotions @p1 @guest @billing', () => {
    const userIds: string[] = [];
    let plusPlanId: string | null = null;
    let vipPlanId: string | null = null;
    let ownerProPlanId: string | null = null;

    // ── Shared fixture: owner + visible/restricted accommodations + deals ──
    let ownerId: string | null = null;
    let visibleAccommodationId: string | null = null;
    let restrictedAccommodationId: string | null = null;
    const promoIds: string[] = [];

    test.beforeAll(async () => {
        plusPlanId = await resolvePlanIdBySlug('tourist-plus');
        vipPlanId = await resolvePlanIdBySlug('tourist-vip');
        ownerProPlanId = await resolvePlanIdBySlug('owner-pro');

        const owner = await createUser({ role: 'HOST' }, { apiBaseUrl: API_URL });
        ownerId = owner.id;
        userIds.push(owner.id);

        const destinationId = await getAnyCityDestinationId();

        const visible = await execSQL<AccommodationRow>(
            `INSERT INTO accommodations (
                 slug, name, summary, description, type,
                 owner_id, destination_id, lifecycle_state,
                 visibility, moderation_state, is_featured,
                 created_at, updated_at
             ) VALUES (
                 $1, $2, $3, $4, 'HOUSE'::accommodation_type_enum,
                 $5, $6, 'ACTIVE'::lifecycle_status_enum,
                 'PUBLIC'::visibility_enum, 'APPROVED'::moderation_status_enum, false,
                 NOW(), NOW()
             ) RETURNING id`,
            [
                `hos21-e2e-visible-${Date.now().toString(36)}`,
                'HOS-21 E2E Visible Accommodation',
                'Visible',
                'HOS-21 E2E fixture — publicly visible accommodation',
                ownerId,
                destinationId
            ]
        );
        visibleAccommodationId = visible[0]?.id ?? null;

        const restricted = await execSQL<AccommodationRow>(
            `INSERT INTO accommodations (
                 slug, name, summary, description, type,
                 owner_id, destination_id, lifecycle_state,
                 visibility, moderation_state, is_featured,
                 created_at, updated_at
             ) VALUES (
                 $1, $2, $3, $4, 'HOUSE'::accommodation_type_enum,
                 $5, $6, 'ACTIVE'::lifecycle_status_enum,
                 'RESTRICTED'::visibility_enum, 'APPROVED'::moderation_status_enum, false,
                 NOW(), NOW()
             ) RETURNING id`,
            [
                `hos21-e2e-restricted-${Date.now().toString(36)}`,
                'HOS-21 E2E Restricted Accommodation',
                'Restricted',
                'HOS-21 E2E fixture — visibility-restricted accommodation',
                ownerId,
                destinationId
            ]
        );
        restrictedAccommodationId = restricted[0]?.id ?? null;

        const validFrom = new Date(Date.now() - 86_400_000).toISOString();
        const promoRows = await execSQL<{ id: string }>(
            `INSERT INTO owner_promotions (
                 slug, owner_id, accommodation_id, title, discount_type, discount_value,
                 valid_from, lifecycle_state, tourist_audience, created_at, updated_at
             ) VALUES
                 ($1, $2, $3, $4, 'percentage'::owner_promotion_discount_type_enum, 10,
                  $5, 'ACTIVE'::lifecycle_status_enum, 'plus'::tourist_audience_enum, NOW(), NOW()),
                 ($6, $2, $3, $7, 'percentage'::owner_promotion_discount_type_enum, 20,
                  $5, 'ACTIVE'::lifecycle_status_enum, 'vip'::tourist_audience_enum, NOW(), NOW()),
                 ($8, $2, $9, $10, 'percentage'::owner_promotion_discount_type_enum, 10,
                  $5, 'ACTIVE'::lifecycle_status_enum, 'plus'::tourist_audience_enum, NOW(), NOW())
             RETURNING id`,
            [
                `hos21-e2e-plus-visible-${Date.now().toString(36)}`,
                ownerId,
                visibleAccommodationId,
                'HOS-21 E2E Plus Deal (visible)',
                validFrom,
                `hos21-e2e-vip-visible-${Date.now().toString(36)}`,
                'HOS-21 E2E Vip Deal (visible)',
                `hos21-e2e-plus-restricted-${Date.now().toString(36)}`,
                restrictedAccommodationId,
                'HOS-21 E2E Plus Deal (restricted)'
            ]
        );
        promoIds.push(...promoRows.map((r) => r.id));
    });

    test.afterAll(async () => {
        if (promoIds.length > 0) {
            await execSQL('DELETE FROM owner_promotions WHERE id = ANY($1::uuid[])', [promoIds]);
        }
        if (ownerId) {
            await cleanupTestUsers(getDbPool(), [ownerId]);
        }
    });

    test.beforeEach(async ({ page }) => {
        await seedCookieConsent(page);
    });

    test.afterEach(async () => {
        const tourists = userIds.filter((id) => id !== ownerId);
        if (tourists.length > 0) {
            await cleanupTestUsers(getDbPool(), tourists);
            for (const id of tourists) {
                userIds.splice(userIds.indexOf(id), 1);
            }
        }
    });

    test('free tourist: 403 ENTITLEMENT_REQUIRED on the API, upgrade CTA in the UI', async ({
        page
    }) => {
        const free = await createUser({ role: 'USER' }, { apiBaseUrl: API_URL });
        userIds.push(free.id);

        // ── API: 403 ENTITLEMENT_REQUIRED ────────────────────────────────────
        const result = await getExclusiveDeals(free.sessionCookie);
        expect(result.status).toBe(403);
        expect(JSON.stringify(result.body)).toContain('ENTITLEMENT_REQUIRED');

        // ── UI: upgrade CTA, no deal items ───────────────────────────────────
        await attachSession(page, free.sessionCookie);
        await page.goto(EXCLUSIVE_DEALS_PAGE, { waitUntil: 'domcontentloaded' });
        await page.waitForResponse(
            (r) => r.url().includes(EXCLUSIVE_DEALS_PATH) && r.status() === 403,
            { timeout: 15_000 }
        );

        await expect(page.getByRole('link', { name: /ver planes/i })).toBeVisible({
            timeout: 10_000
        });
        await expect(page.getByText('HOS-21 E2E Plus Deal (visible)')).not.toBeVisible();
    });

    test('tourist-plus: sees only the plus-tier deal, never the restricted one', async ({
        page
    }) => {
        test.fixme(!plusPlanId, 'tourist-plus plan not seeded — cannot run');
        if (!plusPlanId) return;

        const plus = await createUser({ role: 'USER' }, { apiBaseUrl: API_URL });
        userIds.push(plus.id);
        await createSubscription({ userId: plus.id, planId: plusPlanId, status: 'active' });

        await attachSession(page, plus.sessionCookie);
        await page.goto(EXCLUSIVE_DEALS_PAGE, { waitUntil: 'domcontentloaded' });
        await page.waitForResponse(
            (r) => r.url().includes(EXCLUSIVE_DEALS_PATH) && r.status() === 200,
            { timeout: 15_000 }
        );

        await expect(page.getByText('HOS-21 E2E Plus Deal (visible)')).toBeVisible({
            timeout: 10_000
        });
        await expect(page.getByText('HOS-21 E2E Vip Deal (visible)')).not.toBeVisible();
        await expect(page.getByText('HOS-21 E2E Plus Deal (restricted)')).not.toBeVisible();
    });

    test('tourist-vip: sees plus + vip deals with the VIP badge, restricted deal still excluded', async ({
        page
    }) => {
        test.fixme(!vipPlanId, 'tourist-vip plan not seeded — cannot run');
        if (!vipPlanId) return;

        const vip = await createUser({ role: 'USER' }, { apiBaseUrl: API_URL });
        userIds.push(vip.id);
        await createSubscription({ userId: vip.id, planId: vipPlanId, status: 'active' });

        await attachSession(page, vip.sessionCookie);
        await page.goto(EXCLUSIVE_DEALS_PAGE, { waitUntil: 'domcontentloaded' });
        await page.waitForResponse(
            (r) => r.url().includes(EXCLUSIVE_DEALS_PATH) && r.status() === 200,
            { timeout: 15_000 }
        );

        await expect(page.getByText('HOS-21 E2E Plus Deal (visible)')).toBeVisible({
            timeout: 10_000
        });
        await expect(page.getByText('HOS-21 E2E Vip Deal (visible)')).toBeVisible();
        await expect(page.getByText('HOS-21 E2E Plus Deal (restricted)')).not.toBeVisible();

        // VIP-only badge visually distinguishes the vip-tier item.
        const vipDealItem = page
            .getByText('HOS-21 E2E Vip Deal (visible)')
            .locator('xpath=ancestor::li[1]');
        await expect(vipDealItem.getByText(/solo vip/i)).toBeVisible();

        const plusDealItem = page
            .getByText('HOS-21 E2E Plus Deal (visible)')
            .locator('xpath=ancestor::li[1]');
        await expect(plusDealItem.getByText(/solo vip/i)).not.toBeVisible();
    });

    test('owner: can mark a new promotion VIP-only via the form', async ({ page }) => {
        test.fixme(!ownerProPlanId, 'owner-pro plan not seeded — cannot run');
        if (!ownerProPlanId) return;

        // Fresh owner (not the shared fixture `ownerId`) so this test's
        // owner-pro subscription doesn't interfere with the shared
        // deal-visibility fixture used by the tier-scoping tests above.
        const owner = await createUser({ role: 'HOST' }, { apiBaseUrl: API_URL });
        userIds.push(owner.id);
        await createSubscription({ userId: owner.id, planId: ownerProPlanId, status: 'active' });

        await attachSession(page, owner.sessionCookie);
        await page.goto(`${WEB_URL}/es/mi-cuenta/promociones/nueva/`, {
            waitUntil: 'domcontentloaded'
        });

        const promoTitle = `HOS-21 E2E Owner VIP Promo ${Date.now().toString(36)}`;
        await page.getByLabel(/^t[ií]tulo/i).fill(promoTitle);
        await page.getByRole('combobox', { name: /tipo de descuento/i }).selectOption('percentage');
        await page.getByLabel(/valor del descuento/i).fill('15');
        const today = new Date().toISOString().slice(0, 10);
        await page.getByLabel(/v[aá]lido desde/i).fill(today);

        const vipToggle = page.getByRole('checkbox', { name: /vip/i });
        await expect(vipToggle).not.toBeChecked();
        await vipToggle.check();

        await page.getByRole('button', { name: /guardar/i }).click();

        await page.waitForURL(/\/es\/mi-cuenta\/promociones\/?$/, { timeout: 15_000 });

        const created = await execSQL<OwnerPromotionRow>(
            'SELECT id, tourist_audience FROM owner_promotions WHERE title = $1 LIMIT 1',
            [promoTitle]
        );
        expect(created[0]?.tourist_audience).toBe('vip');
        if (created[0]?.id) {
            await execSQL('DELETE FROM owner_promotions WHERE id = $1', [created[0].id]);
        }
    });
});
