/**
 * TEST:B13a:25 — web effective-set gates (Coord-58, AC:B13a:27).
 *
 * The absent-key owner holds neither a trial nor a subscription: a trial
 * derives its entitlements from the highest-rank sellable version (AC:V3:4),
 * which grants `create_promotions`, so a trial owner can never meet the closed
 * gate (HOS-1536, Coord-467). The present-key owner holds only an
 * `owner-basico` subscription, so the key can come from nowhere else.
 */

import { expect, type Page, test } from '@playwright/test';
import { createUser, markProfileCompleted } from '../../fixtures/api-helpers.ts';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { getDbPool } from '../../fixtures/db-helpers.ts';
import { seedActivePlanHolder } from '../../fixtures/signup-checkout.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const WEB_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:4321';
const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';
const PROMOTIONS_PATH = '/es/mi-cuenta/promociones/';
const EFFECTIVE_SET_PATH = '/api/v1/protected/users/me/effective-set?vertical=accommodation';

test.describe('TEST:B13a:25 AC:B13a:27 web effective-set gates @p1 @host', () => {
    const userIdsToCleanup: string[] = [];
    let owner: Awaited<ReturnType<typeof createUser>> | null = null;

    test.beforeAll(async () => {
        owner = await createUser({ role: 'HOST' }, { apiBaseUrl: API_URL });
        userIdsToCleanup.push(owner.id);
        await markProfileCompleted({ userId: owner.id });
    });

    test.afterAll(async () => {
        if (userIdsToCleanup.length > 0) {
            await cleanupTestUsers(getDbPool(), [...userIdsToCleanup]);
            userIdsToCleanup.length = 0;
        }
    });

    async function prepareOwner(page: Page) {
        if (!owner) throw new Error('Shared E2E owner was not initialized');
        await page.context().addCookies(
            owner.sessionCookie.split('; ').map((cookie) => {
                const [name, ...value] = cookie.split('=');
                return { name: (name ?? '').trim(), value: value.join('='), url: WEB_URL };
            })
        );
        await seedCookieConsent(page);
    }

    test('closes promotions for an owner with no trial and no subscription', async ({ page }) => {
        await prepareOwner(page);
        const oldEndpointRequests: string[] = [];
        page.on('request', (request) => {
            if (request.url().includes('/protected/users/me/entitlements')) {
                oldEndpointRequests.push(request.url());
            }
        });
        const effectiveSetResponse = page.waitForResponse(
            (response) =>
                response.url().includes(EFFECTIVE_SET_PATH) && response.request().method() === 'GET'
        );
        await page.goto(`${WEB_URL}${PROMOTIONS_PATH}`, { waitUntil: 'domcontentloaded' });

        await expect(page.getByRole('heading', { name: 'Mis promociones' })).toBeVisible({
            timeout: 30_000
        });
        const response = await effectiveSetResponse;
        expect(response.status()).toBe(200);
        const body = (await response.json()) as {
            data?: { entitlements?: Record<string, number | string> };
        };
        expect(body.data?.entitlements).not.toHaveProperty('create_promotions');
        await expect(page.getByText('Tu plan no incluye promociones')).toBeVisible();
        await expect(page.getByRole('link', { name: 'Nueva promoción' })).toHaveCount(0);
        expect(oldEndpointRequests).toEqual([]);
    });

    test('keeps promotions closed when the effective-set read fails', async ({ page }) => {
        await prepareOwner(page);
        const oldEndpointRequests: string[] = [];
        page.on('request', (request) => {
            if (request.url().includes('/protected/users/me/entitlements')) {
                oldEndpointRequests.push(request.url());
            }
        });
        const effectiveSetResponse = page.waitForResponse(
            (response) =>
                response.url().includes(EFFECTIVE_SET_PATH) && response.request().method() === 'GET'
        );
        await page.route(`**${EFFECTIVE_SET_PATH}`, (route) =>
            route.fulfill({
                status: 500,
                contentType: 'application/json',
                body: JSON.stringify({ error: 'failed' })
            })
        );
        await page.goto(`${WEB_URL}${PROMOTIONS_PATH}`, { waitUntil: 'domcontentloaded' });

        await expect(page.getByRole('heading', { name: 'Mis promociones' })).toBeVisible({
            timeout: 30_000
        });
        const response = await effectiveSetResponse;
        expect(response.status()).toBe(500);
        await expect(page.getByText('Tu plan no incluye promociones')).toBeVisible();
        await expect(page.getByRole('link', { name: 'Nueva promoción' })).toHaveCount(0);
        expect(oldEndpointRequests).toEqual([]);
    });

    test('opens promotions for an owner whose live subscription grants the create key', async ({
        page
    }) => {
        // Its OWN owner (HOS-1536, Coord-58, I-8): the shared owner of the
        // beforeAll may sit cached without the key. No trial: the key must
        // come from the owner-basico subscription through billing's real
        // coverage (B4), never from a trial's derived set (AC:V3:4).
        const keyedOwner = await createUser({ role: 'HOST' }, { apiBaseUrl: API_URL });
        userIdsToCleanup.push(keyedOwner.id);
        await markProfileCompleted({ userId: keyedOwner.id });
        await seedActivePlanHolder({ userId: keyedOwner.id, slug: 'owner-basico' });
        await page.context().addCookies(
            keyedOwner.sessionCookie.split('; ').map((cookie) => {
                const [name, ...value] = cookie.split('=');
                return { name: (name ?? '').trim(), value: value.join('='), url: WEB_URL };
            })
        );
        await seedCookieConsent(page);
        const oldEndpointRequests: string[] = [];
        page.on('request', (request) => {
            if (request.url().includes('/protected/users/me/entitlements')) {
                oldEndpointRequests.push(request.url());
            }
        });
        const effectiveSetResponse = page.waitForResponse(
            (response) =>
                response.url().includes(EFFECTIVE_SET_PATH) && response.request().method() === 'GET'
        );
        await page.goto(`${WEB_URL}${PROMOTIONS_PATH}`, { waitUntil: 'domcontentloaded' });

        await expect(page.getByRole('heading', { name: 'Mis promociones' })).toBeVisible({
            timeout: 30_000
        });
        const response = await effectiveSetResponse;
        expect(response.status()).toBe(200);
        const body = (await response.json()) as {
            data?: { entitlements?: Record<string, number | string> };
        };
        expect(body.data?.entitlements).toHaveProperty('create_promotions');
        // The positive assertion first: the open gate shows its link.
        await expect(page.getByRole('link', { name: 'Nueva promoción' })).toBeVisible();
        await expect(page.getByText('Tu plan no incluye promociones')).toHaveCount(0);
        expect(oldEndpointRequests).toEqual([]);
    });
});
