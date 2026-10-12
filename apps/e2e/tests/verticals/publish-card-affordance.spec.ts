import { expect, type Page, test } from '@playwright/test';
import {
    createAccommodation,
    createUser,
    markProfileCompleted
} from '../../fixtures/api-helpers.ts';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

/**
 * HOS-1668 — the publish card on "Mis propiedades" derives its affordance from
 * the same decision the server uses when publishing (`subscribe-destination`),
 * and never asks the retired `publish-eligibility` route.
 *
 * The no-plans case is deliberately NOT here: it retires the global plan
 * catalog and would break specs running in parallel, so it stays in the
 * non-`@p0` `subscribe-button.spec.ts` (TEST:V8a:4).
 */

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';
const WEB_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:4321';
const RETIRED_ROUTE = 'publish-eligibility';

interface ListingRow extends Record<string, unknown> {
    readonly publication_status: string;
}

interface TrialRow extends Record<string, unknown> {
    readonly status: string;
}

async function attachSession(page: Page, sessionCookie: string): Promise<void> {
    const cookies = sessionCookie.split('; ').flatMap((cookie) => {
        const [name, ...valueParts] = cookie.split('=');
        return name ? [{ name, value: valueParts.join('='), domain: 'localhost', path: '/' }] : [];
    });
    await page.context().addCookies(cookies);
}

/** Records every URL the page requests so the spec can assert none hits the retired route. */
function recordRequests(page: Page): string[] {
    const urls: string[] = [];
    page.on('request', (request) => {
        urls.push(request.url());
    });
    return urls;
}

/**
 * Publishing requires a main image; a real owner uploads it in the editor, so it is
 * seeded directly, as `trial-01-end-to-end.spec.ts` does. Without it the server
 * answers a per-listing completeness 400 that no owner-level read predicts.
 */
async function seedMainImage(listingId: string): Promise<void> {
    await execSQL(
        `INSERT INTO accommodation_media
             (accommodation_id, url, state, is_featured, sort_order, moderation_state)
         VALUES ($1, 'https://cdn.example.test/e2e-card-main.jpg', 'visible', true, 0, 'APPROVED')`,
        [listingId]
    );
}

async function readPublicationStatus(listingId: string): Promise<string | undefined> {
    const rows = await execSQL<ListingRow>(
        'SELECT publication_status FROM accommodations WHERE id = $1',
        [listingId]
    );
    return rows[0]?.publication_status;
}

async function readOwnerTrials(ownerId: string): Promise<readonly TrialRow[]> {
    return execSQL<TrialRow>(
        "SELECT status FROM trial WHERE user_id = $1 AND vertical = 'accommodation'",
        [ownerId]
    );
}

test.describe('Publish card affordance @p0 @verticals @billing', () => {
    test('HOS-1668 C-1: a spent-trial owner sees the plan link, never Publish, and the server agrees', async ({
        page
    }) => {
        const owner = await createUser({ role: 'HOST' }, { apiBaseUrl: API_URL });
        try {
            await markProfileCompleted({ userId: owner.id });
            const listing = await createAccommodation({
                ownerId: owner.id,
                slugPrefix: 'card-checkout'
            });
            await seedMainImage(listing.id);
            // `ck_trial_clock_order` requires ends_at >= started_at, so the clock is moved whole.
            await execSQL(
                "UPDATE trial SET status = 'TRIAL_EXPIRED', started_at = NOW() - INTERVAL '31 days', ends_at = NOW() - INTERVAL '1 day' WHERE user_id = $1 AND vertical = 'accommodation'",
                [owner.id]
            );
            const requests = recordRequests(page);

            await seedCookieConsent(page);
            await attachSession(page, owner.sessionCookie);
            await page.goto(`${WEB_URL}/es/mi-cuenta/propiedades/`);
            const list = page.getByRole('list', { name: 'Mis propiedades' });
            await expect(
                list.getByRole('link', { name: 'Elegir plan de anfitrión', exact: true })
            ).toBeVisible();
            await expect(list.getByRole('button', { name: 'Publicar', exact: true })).toHaveCount(
                0
            );
            await expect(list.getByTestId('publish-check-failed')).toHaveCount(0);

            // The server agrees: publishing is refused and the listing stays a draft.
            const publishResponse = await page.request.post(
                `${API_URL}/api/v1/protected/accommodations/${listing.id}/publish`,
                { headers: { cookie: owner.sessionCookie } }
            );
            expect(publishResponse.status()).toBe(403);
            await expect(publishResponse.json()).resolves.toMatchObject({
                error: { message: 'subscription_required' }
            });
            expect(await readPublicationStatus(listing.id)).toBe('DRAFT');
            const trials = await readOwnerTrials(owner.id);
            expect(trials).toHaveLength(1);
            expect(trials[0]?.status).toBe('TRIAL_EXPIRED');

            // HOS-1668 C-3: nobody asks the retired route.
            expect(requests.filter((url) => url.includes(RETIRED_ROUTE))).toEqual([]);
        } finally {
            await cleanupTestUsers(getDbPool(), [owner.id]);
        }
    });

    test('HOS-1668 C-1: a covered owner sees Publish and the server publishes', async ({
        page
    }) => {
        const owner = await createUser({ role: 'HOST' }, { apiBaseUrl: API_URL });
        try {
            await markProfileCompleted({ userId: owner.id });
            // The default fixture seeds an ACTIVE trial for the owner: covered.
            const listing = await createAccommodation({
                ownerId: owner.id,
                slugPrefix: 'card-covered'
            });
            await seedMainImage(listing.id);
            const trialsBefore = await readOwnerTrials(owner.id);
            expect(trialsBefore).toHaveLength(1);
            expect(trialsBefore[0]?.status).toBe('TRIAL_ACTIVE');
            const requests = recordRequests(page);

            await seedCookieConsent(page);
            await attachSession(page, owner.sessionCookie);
            await page.goto(`${WEB_URL}/es/mi-cuenta/propiedades/`);
            const list = page.getByRole('list', { name: 'Mis propiedades' });
            const publish = list.getByRole('button', { name: 'Publicar', exact: true });
            await expect(publish).toBeVisible();
            await expect(list.getByRole('link', { name: /elegir plan/i })).toHaveCount(0);
            await expect(list.getByTestId('publish-check-failed')).toHaveCount(0);

            await publish.click();
            await page.getByRole('button', { name: 'Sí, publicar', exact: true }).click();

            await expect
                .poll(() => readPublicationStatus(listing.id), {
                    timeout: 30_000,
                    message: 'publishing from the card should publish the covered listing'
                })
                .toBe('PUBLISHED');
            const trialsAfter = await readOwnerTrials(owner.id);
            expect(trialsAfter).toHaveLength(1);
            expect(trialsAfter[0]?.status).toBe('TRIAL_ACTIVE');

            // HOS-1668 C-3: nobody asks the retired route.
            expect(requests.filter((url) => url.includes(RETIRED_ROUTE))).toEqual([]);
        } finally {
            await cleanupTestUsers(getDbPool(), [owner.id]);
        }
    });
});
