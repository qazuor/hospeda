/**
 * GUEST-06 — Free and VIP promotions (HOS-21, reworked by HOS-2589).
 *
 * Actors: a free tourist USER, a tourist-vip USER, a HOST owner.
 * Tags: @p1 @guest @billing
 *
 * Preconditions:
 *   - Suite seed has current `tourist-vip` and `owner-pro` catalog versions, and
 *     `owner-pro` grants `vip_only_promotions` (HOS-2589 D-4).
 *   - Suite seed has at least 1 PUBLISHED (destination-linked) accommodation
 *     available via getAnyCityDestinationId().
 *
 * Validates (HOS-2589):
 *   - The old «Ofertas exclusivas» page 301s to the public `/promociones/` page.
 *   - Free tourist: on the place, the «Solo VIP» promotion comes back LOCKED (no
 *     title, no place name; a blurred card), never as a visible item (AC-9).
 *   - Tourist-vip: sees both the «Para todos» and the «Solo VIP» promotion of the
 *     place, the latter with the VIP badge (AC-13); a promotion of a DRAFT listing
 *     is excluded for every tier.
 *   - Owner (HOST, owner-pro): picks «Solo VIP» in the audience radio group of
 *     the create form, and the row persists with tourist_audience = 'vip'.
 */

import { expect, test } from '@playwright/test';
import {
    createUser,
    getAnyCityDestinationId,
    markProfileCompleted
} from '../../fixtures/api-helpers.ts';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { seedActivePlanHolder } from '../../fixtures/signup-checkout.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:18001';
const WEB_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:18321';
const VISIBLE_PATH = '/api/v1/public/owner-promotions/visible';
const EXCLUSIVE_DEALS_PAGE = `${WEB_URL}/es/mi-cuenta/ofertas-exclusivas/`;

type VisibilityItem =
    | { readonly kind: 'visible'; readonly title: string; readonly audience: string }
    | { readonly kind: 'locked'; readonly audience: string; readonly placeholderName: string };

type AccommodationRow = { id: string } & Record<string, unknown>;
type OwnerPromotionRow = { id: string; tourist_audience: string } & Record<string, unknown>;

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

/** GET the per-actor promotions of one accommodation (HOS-2589 §7.3). */
async function getVisiblePromotions(input: {
    readonly cookie?: string;
    readonly accommodationId: string;
}): Promise<{ readonly status: number; readonly items: readonly VisibilityItem[] }> {
    const query = new URLSearchParams({
        entityType: 'accommodation',
        entityId: input.accommodationId,
        seed: 'e2e-guest-06-seed'
    });
    const response = await fetch(`${API_URL}${VISIBLE_PATH}?${query.toString()}`, {
        headers: { accept: 'application/json', ...(input.cookie ? { cookie: input.cookie } : {}) }
    });
    const body = (await response.json().catch(() => null)) as {
        readonly data?: { readonly items?: readonly VisibilityItem[] };
    } | null;
    return { status: response.status, items: body?.data?.items ?? [] };
}

// The tier-scoping specs read one shared set of seeded deals while the owner spec
// creates another promotion, and the config runs fullyParallel (2 workers on
// nightly, 4 on PR). Run them in order so the writer cannot change what the
// readers assert mid-flight — a race that only surfaced when this file ran
// alongside others, and passed when run on its own.
test.describe.configure({ mode: 'serial' });

test.describe('GUEST-06: exclusive deals & VIP promotions @p1 @guest @billing', () => {
    const userIds: string[] = [];

    // ── Shared fixture: owner + visible/restricted accommodations + deals ──
    // "Visible" is a PUBLISHED listing; "restricted" is one the public never
    // sees (DRAFT), which is all `publication_status` can say (HOS-1641).
    let ownerId: string | null = null;
    let visibleAccommodationId: string | null = null;
    let visibleSlug = '';
    let restrictedAccommodationId: string | null = null;
    const promoIds: string[] = [];

    test.beforeAll(async () => {
        const owner = await createUser({ role: 'HOST' }, { apiBaseUrl: API_URL });
        ownerId = owner.id;
        userIds.push(owner.id);

        const destinationId = await getAnyCityDestinationId();

        visibleSlug = `hos21-e2e-visible-${Date.now().toString(36)}`;
        const visible = await execSQL<AccommodationRow>(
            `INSERT INTO accommodations (
                 slug, name, summary, description, type,
                 owner_id, destination_id,
                 publication_status, inactive_since, deadlines_version,
                 created_at, updated_at
             ) VALUES (
                 $1, $2, $3, $4, 'HOUSE'::accommodation_type_enum,
                 $5, $6,
                 'PUBLISHED'::publication_status_enum, NOW(), 1,
                 NOW(), NOW()
             ) RETURNING id`,
            [
                visibleSlug,
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
                 owner_id, destination_id,
                 publication_status, inactive_since, deadlines_version,
                 created_at, updated_at
             ) VALUES (
                 $1, $2, $3, $4, 'HOUSE'::accommodation_type_enum,
                 $5, $6,
                 'DRAFT'::publication_status_enum, NOW(), 1,
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

    test('the old exclusive deals page moves to the public promotions page', async ({ page }) => {
        const response = await page.request.get(EXCLUSIVE_DEALS_PAGE, { maxRedirects: 0 });
        expect(response.status()).toBe(301);
        expect(response.headers().location).toMatch(/\/es\/promociones\/?$/);
    });

    test('free tourist: the «Solo VIP» promotion comes back locked, with a blurred card', async ({
        page
    }) => {
        const free = await createUser({ role: 'USER' }, { apiBaseUrl: API_URL });
        userIds.push(free.id);
        await markProfileCompleted({ userId: free.id });

        // ── API: the vip row is locked; no visible item carries its title ────
        const result = await getVisiblePromotions({
            cookie: free.sessionCookie,
            accommodationId: visibleAccommodationId ?? ''
        });
        expect(result.status).toBe(200);
        const titles = result.items.flatMap((item) =>
            item.kind === 'visible' ? [item.title] : []
        );
        expect(titles).not.toContain('HOS-21 E2E Vip Deal (visible)');
        expect(result.items.some((item) => item.kind === 'locked' && item.audience === 'vip')).toBe(
            true
        );
        expect(JSON.stringify(result.items)).not.toContain('HOS-21 E2E Visible Accommodation');

        // ── UI: the place shows a locked card ────────────────────────────────
        await attachSession(page, free.sessionCookie);
        await page.goto(`${WEB_URL}/es/alojamientos/${visibleSlug}/`, {
            waitUntil: 'domcontentloaded'
        });
        const promotions = page.getByTestId('place-promotions');
        await expect(promotions.locator('[data-promotion-card="locked"]').first()).toBeVisible({
            timeout: 15_000
        });
        await expect(page.getByText('HOS-21 E2E Vip Deal (visible)')).not.toBeVisible();
    });

    test('tourist-vip: sees both promotions with the VIP badge; a draft listing stays out', async ({
        page
    }) => {
        const vip = await createUser({ role: 'USER' }, { apiBaseUrl: API_URL });
        userIds.push(vip.id);
        await seedActivePlanHolder({ userId: vip.id, slug: 'tourist-vip' });
        await markProfileCompleted({ userId: vip.id });

        const result = await getVisiblePromotions({
            cookie: vip.sessionCookie,
            accommodationId: visibleAccommodationId ?? ''
        });
        expect(result.status).toBe(200);
        const titles = result.items.flatMap((item) =>
            item.kind === 'visible' ? [item.title] : []
        );
        expect(titles).toEqual(
            expect.arrayContaining([
                'HOS-21 E2E Plus Deal (visible)',
                'HOS-21 E2E Vip Deal (visible)'
            ])
        );
        expect(result.items.some((item) => item.kind === 'locked')).toBe(false);

        const restricted = await getVisiblePromotions({
            cookie: vip.sessionCookie,
            accommodationId: restrictedAccommodationId ?? ''
        });
        expect(restricted.items).toHaveLength(0);

        await attachSession(page, vip.sessionCookie);
        await page.goto(`${WEB_URL}/es/alojamientos/${visibleSlug}/`, {
            waitUntil: 'domcontentloaded'
        });
        const vipCard = page
            .getByTestId('place-promotions')
            .locator('[data-promotion-card="visible"]')
            .filter({ hasText: 'HOS-21 E2E Vip Deal (visible)' });
        await expect(vipCard).toBeVisible({ timeout: 15_000 });
        await expect(vipCard.getByText(/vip/i).first()).toBeVisible();
    });

    test('owner: can pick «Solo VIP» in the create form', async ({ page }) => {
        // Fresh owner (not the shared fixture `ownerId`) so this test's
        // owner-pro subscription doesn't interfere with the shared
        // deal-visibility fixture used by the tier-scoping tests above.
        const owner = await createUser({ role: 'HOST' }, { apiBaseUrl: API_URL });
        userIds.push(owner.id);
        await seedActivePlanHolder({ userId: owner.id, slug: 'owner-pro' });
        await markProfileCompleted({ userId: owner.id });

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

        await expect(page.getByRole('radio', { name: /para todos/i })).toBeChecked();
        const vipRadio = page.getByRole('radio', { name: /solo vip/i });
        await expect(vipRadio).toBeEnabled({ timeout: 10_000 });
        await vipRadio.check();

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
