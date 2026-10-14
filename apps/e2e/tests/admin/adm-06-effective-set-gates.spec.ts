/**
 * TEST:B13a:23 (e2e admin half, AC:B13a:23) — an accommodation gate reads V3.
 * Tags: @p1 @admin
 *
 * The absent-key case is an owner with neither a trial nor a subscription: a
 * trial derives its entitlements from the highest-rank sellable version
 * (AC:V3:4), which grants every screen key, so no trial owner can meet a
 * closed gate (HOS-1536, Coord-467). The present-key case lives here too since
 * B4 (HOS-1536, Coord-58): billing's real coverage turns a live subscription
 * into a source whose ANCHORED version grants its keys, so an `owner-premium`
 * subscriber with no trial opens the gate, and only the subscription can.
 *
 * The page title is read inside `entity-page-header`: the entity page also
 * renders an `sr-only` h1 with the same name.
 */

import { expect, test } from '@playwright/test';
import { createAccommodation, createUser, markAdminToursSeen } from '../../fixtures/api-helpers.ts';
import { getDbPool } from '../../fixtures/db-helpers.ts';
import { seedActivePlanHolder } from '../../fixtures/signup-checkout.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const ADMIN_URL = process.env.HOSPEDA_E2E_ADMIN_URL ?? 'http://localhost:3000';
const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';

test.describe('TEST:B13a:23 AC:B13a:23 admin effective-set gate @p1 @admin', () => {
    const userIdsToCleanup: string[] = [];

    test.afterEach(async () => {
        if (userIdsToCleanup.length > 0) {
            await cleanupTestUsers(getDbPool(), [...userIdsToCleanup]);
            userIdsToCleanup.length = 0;
        }
    });

    test('closes advanced statistics for an owner with no trial and no subscription', async ({
        page
    }) => {
        const superAdmin = await createUser({ role: 'SUPER_ADMIN' }, { apiBaseUrl: API_URL });
        userIdsToCleanup.push(superAdmin.id);
        await markAdminToursSeen({ userId: superAdmin.id });

        const owner = await createUser({ role: 'HOST' }, { apiBaseUrl: API_URL });
        userIdsToCleanup.push(owner.id);
        const accommodation = await createAccommodation({
            ownerId: owner.id,
            slugPrefix: 'adm-06',
            withTrial: false
        });

        await page.context().addCookies(
            superAdmin.sessionCookie.split('; ').map((cookie) => {
                const [name, ...value] = cookie.split('=');
                return { name: (name ?? '').trim(), value: value.join('='), url: ADMIN_URL };
            })
        );

        const effectiveSetPath = `/api/v1/admin/users/${owner.id}/effective-set?vertical=accommodation`;
        const effectiveSetResponse = page.waitForResponse(
            (response) =>
                response.url().endsWith(effectiveSetPath) && response.request().method() === 'GET'
        );
        await page.goto(`${ADMIN_URL}/accommodations/${accommodation.id}`, {
            waitUntil: 'domcontentloaded'
        });

        // A loaded page and the owner's exact API read are prerequisites for
        // any negative assertion: an empty page must never satisfy this test.
        await expect(
            page
                .getByTestId('entity-page-header')
                .getByRole('heading', { name: 'E2E Test Accommodation' })
        ).toBeVisible({ timeout: 30_000 });
        await page.getByRole('button', { name: /Estadísticas y Métricas/i }).click();
        const response = await effectiveSetResponse;
        expect(response.status()).toBe(200);
        const body = (await response.json()) as {
            data?: {
                userId?: string;
                vertical?: string;
                entitlements?: Record<string, number | string>;
            };
        };
        expect(body.data?.userId).toBe(owner.id);
        expect(body.data?.vertical).toBe('accommodation');
        expect(body.data?.entitlements).not.toHaveProperty('view_advanced_stats');

        // The section's fields carry no data, so an OPEN gate renders the
        // section's empty-state body; a closed one renders the premium fallback.
        const statistics = page.getByRole('region', { name: 'Estadísticas y Métricas' });
        await expect(
            statistics.getByRole('heading', {
                name: /Estadísticas y Métricas - (Función Premium|Premium Feature|Recurso Premium)/i
            })
        ).toBeVisible();
        await expect(statistics.getByText('No hay datos para mostrar.')).toHaveCount(0);
    });

    test('opens advanced statistics for an owner whose live subscription grants the key', async ({
        page
    }) => {
        const superAdmin = await createUser({ role: 'SUPER_ADMIN' }, { apiBaseUrl: API_URL });
        userIdsToCleanup.push(superAdmin.id);
        await markAdminToursSeen({ userId: superAdmin.id });

        // Its OWN owner: the absent-key owner above may sit cached without the key.
        const owner = await createUser({ role: 'HOST' }, { apiBaseUrl: API_URL });
        userIdsToCleanup.push(owner.id);
        const accommodation = await createAccommodation({
            ownerId: owner.id,
            slugPrefix: 'adm-06-key',
            withTrial: false
        });
        await seedActivePlanHolder({ userId: owner.id, slug: 'owner-premium' });

        await page.context().addCookies(
            superAdmin.sessionCookie.split('; ').map((cookie) => {
                const [name, ...value] = cookie.split('=');
                return { name: (name ?? '').trim(), value: value.join('='), url: ADMIN_URL };
            })
        );

        const effectiveSetPath = `/api/v1/admin/users/${owner.id}/effective-set?vertical=accommodation`;
        const effectiveSetResponse = page.waitForResponse(
            (response) =>
                response.url().endsWith(effectiveSetPath) && response.request().method() === 'GET'
        );
        await page.goto(`${ADMIN_URL}/accommodations/${accommodation.id}`, {
            waitUntil: 'domcontentloaded'
        });

        await expect(
            page
                .getByTestId('entity-page-header')
                .getByRole('heading', { name: 'E2E Test Accommodation' })
        ).toBeVisible({ timeout: 30_000 });
        await page.getByRole('button', { name: /Estadísticas y Métricas/i }).click();
        const response = await effectiveSetResponse;
        expect(response.status()).toBe(200);
        const body = (await response.json()) as {
            data?: {
                userId?: string;
                vertical?: string;
                entitlements?: Record<string, number | string>;
            };
        };
        expect(body.data?.userId).toBe(owner.id);
        expect(body.data?.vertical).toBe('accommodation');
        expect(body.data?.entitlements).toHaveProperty('view_advanced_stats');
        expect(body.data?.entitlements).toHaveProperty('respond_reviews');

        // The positive assertion goes first: the open gate renders the section
        // body, which is its empty state because its fields carry no data
        // (EntityViewSection hides empty fields); only then can the premium
        // fallback's absence mean anything.
        const statistics = page.getByRole('region', { name: 'Estadísticas y Métricas' });
        await expect(statistics.getByText('No hay datos para mostrar.')).toBeVisible();
        await expect(
            statistics.getByRole('heading', {
                name: /Estadísticas y Métricas - (Función Premium|Premium Feature|Recurso Premium)/i
            })
        ).toHaveCount(0);
    });
});
