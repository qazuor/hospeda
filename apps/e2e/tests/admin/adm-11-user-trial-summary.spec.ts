/**
 * TEST:V8a:7 (panel, fila 4) — the admin reads accumulated trial days, their
 * origins, and the ceiling for each vertical. Uses owned accounts and cleans
 * them after each case; no global catalog rows are changed.
 * Tags: @p1 @admin. Permission denial is covered by component and API tests.
 */
import { expect, type Page, test } from '@playwright/test';
import { VerticalEnum } from '@repo/schemas';
import type { CreatedUser } from '../../fixtures/api-helpers.ts';
import { createUser, markAdminToursSeen } from '../../fixtures/api-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { extendAccommodationTrialBySupport } from '../../fixtures/listing-notices.ts';
import { ensureListingOwnerTrial } from '../../fixtures/listing-owner-trial.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const ADMIN_URL = process.env.HOSPEDA_E2E_ADMIN_URL ?? 'http://localhost:3000';
const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';

async function useAdminSession(page: Page, admin: CreatedUser): Promise<void> {
    await page.context().addCookies(
        admin.sessionCookie.split('; ').map((cookie) => {
            const [name, ...value] = cookie.split('=');
            return { name: (name ?? '').trim(), value: value.join('='), url: ADMIN_URL };
        })
    );
}

test.describe('TEST:V8a:7 (panel, fila 4) admin user trial summary @p1 @admin', () => {
    const ownedUserIds: string[] = [];
    test.afterEach(async () => {
        if (ownedUserIds.length) {
            await execSQL('DELETE FROM canje_de_trial WHERE user_id = ANY($1::uuid[])', [
                [...ownedUserIds]
            ]);
            await cleanupTestUsers(getDbPool(), [...ownedUserIds]);
            ownedUserIds.length = 0;
        }
    });

    test('shows accommodation total, ceiling, and origin facts from the API', async ({ page }) => {
        const admin = await createUser({ role: 'SUPER_ADMIN' }, { apiBaseUrl: API_URL });
        ownedUserIds.push(admin.id);
        await markAdminToursSeen({ userId: admin.id });
        const owner = await createUser({ role: 'HOST' }, { apiBaseUrl: API_URL });
        ownedUserIds.push(owner.id);
        await ensureListingOwnerTrial(getDbPool(), owner.id, VerticalEnum.ACCOMMODATION);
        const support = await extendAccommodationTrialBySupport({ ownerId: owner.id, days: 7 });

        const [trial] = await execSQL<{
            id: string;
            base_days: number;
            ceiling: number;
            total: number;
        }>(
            `SELECT t.id,
                   (EXTRACT(EPOCH FROM (t.ends_at - t.started_at)) / 86400)::int AS total,
                   (v.values->'7'->>'days')::int AS ceiling,
                   ((EXTRACT(EPOCH FROM (t.ends_at - t.started_at)) / 86400)::int - 17) AS base_days
              FROM trial t
              JOIN vertical_deadline_version v ON v.version = t.deadlines_version
             WHERE t.id = $1`,
            [support.trialId]
        );
        if (!trial) throw new Error('Expected the owned accommodation trial row');
        const redemptionKey = `adm11-${owner.id}`;
        await execSQL(
            `WITH extended AS (
                UPDATE trial SET ends_at = ends_at + interval '10 days'
                 WHERE id = $1 RETURNING user_id, vertical
             )
             INSERT INTO canje_de_trial (user_id, vertical, redemption_key, applied_days)
             SELECT user_id, vertical, $2, 10 FROM extended`,
            [trial.id, redemptionKey]
        );
        const [facts] = await execSQL<{ total: number; base_days: number; ceiling: number }>(
            `SELECT (EXTRACT(EPOCH FROM (ends_at - started_at)) / 86400)::int AS total,
                    ((EXTRACT(EPOCH FROM (ends_at - started_at)) / 86400)::int - 17) AS base_days,
                    (v.values->'7'->>'days')::int AS ceiling
               FROM trial t JOIN vertical_deadline_version v ON v.version = t.deadlines_version
              WHERE t.id = $1`,
            [trial.id]
        );
        if (!facts) throw new Error('Expected facts after promo extension');

        await useAdminSession(page, admin);
        const summaryResponse = page.waitForResponse((response) =>
            response
                .url()
                .endsWith(`/api/v1/admin/users/${owner.id}/trial-summary?vertical=accommodation`)
        );
        await page.goto(`${ADMIN_URL}/access/users/${owner.id}`, { waitUntil: 'domcontentloaded' });
        const card = page.getByTestId('user-trial-summary');
        await expect(card).toBeVisible({ timeout: 30_000 });
        expect((await summaryResponse).status()).toBe(200);
        await expect(card).toContainText('Alojamiento');
        await expect(card).toContainText(`${facts.total} de ${facts.ceiling} días máx.`);
        await expect(card).toContainText(`${facts.base_days} del plan`);
        await expect(card).toContainText('10 por promociones');
        await expect(card).toContainText('7 regalados por soporte');
        await expect(page.getByTestId('user-trial-summary-gastronomy')).toContainText(
            'Sin prueba gratis en esta vertical.'
        );
        await expect(page.getByTestId('user-trial-summary-experience')).toContainText(
            'Sin prueba gratis en esta vertical.'
        );
    });

    test('shows NONE for all verticals on an account without a trial', async ({ page }) => {
        const admin = await createUser({ role: 'SUPER_ADMIN' }, { apiBaseUrl: API_URL });
        ownedUserIds.push(admin.id);
        await markAdminToursSeen({ userId: admin.id });
        const account = await createUser({}, { apiBaseUrl: API_URL });
        ownedUserIds.push(account.id);
        await useAdminSession(page, admin);
        await page.goto(`${ADMIN_URL}/access/users/${account.id}`, {
            waitUntil: 'domcontentloaded'
        });
        const card = page.getByTestId('user-trial-summary');
        await expect(card).toBeVisible({ timeout: 30_000 });
        for (const vertical of ['accommodation', 'gastronomy', 'experience']) {
            await expect(page.getByTestId(`user-trial-summary-${vertical}`)).toContainText(
                'Sin prueba gratis en esta vertical.'
            );
        }
    });
});
