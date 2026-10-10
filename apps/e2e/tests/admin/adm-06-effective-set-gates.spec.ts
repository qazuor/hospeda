/**
 * TEST:B13a:23 (e2e admin half, AC:B13a:23) — an accommodation gate reads V3.
 * Tags: @p1 @admin
 *
 * Coord-58: bootstrap coverage only grants trials, and the accommodation trial
 * has no screen entitlement. The live E2E therefore covers the absent-key case.
 * The present-key case is covered by route/component tests and moves to B4.
 */

import { expect, test } from '@playwright/test';
import { createAccommodation, createUser, markAdminToursSeen } from '../../fixtures/api-helpers.ts';
import { getDbPool } from '../../fixtures/db-helpers.ts';
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

    test('closes advanced statistics for an owner with an active trial but no key', async ({
        page
    }) => {
        const superAdmin = await createUser({ role: 'SUPER_ADMIN' }, { apiBaseUrl: API_URL });
        userIdsToCleanup.push(superAdmin.id);
        await markAdminToursSeen({ userId: superAdmin.id });

        const owner = await createUser({ role: 'HOST' }, { apiBaseUrl: API_URL });
        userIdsToCleanup.push(owner.id);
        const accommodation = await createAccommodation({
            ownerId: owner.id,
            slugPrefix: 'adm-06'
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
        await expect(page.getByRole('heading', { name: 'E2E Test Accommodation' })).toBeVisible({
            timeout: 30_000
        });
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

        await expect(
            page.getByRole('heading', {
                name: /Estadísticas y Métricas - (Función Premium|Premium Feature|Recurso Premium)/i
            })
        ).toBeVisible();
        await expect(page.getByText('Total de Visualizaciones')).toHaveCount(0);
    });
});
