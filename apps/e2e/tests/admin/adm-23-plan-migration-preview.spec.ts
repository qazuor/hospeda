import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { FakePaymentProvider } from '@repo/payments/fake';
import { createAdjustableClock } from '@repo/test-clock';
import { z } from 'zod';
import { formatCurrency } from '../../../../packages/i18n/src/formatting.ts';
import esPages from '../../../../packages/i18n/src/locales/es/admin-pages.json' with {
    type: 'json'
};
import { type CreatedUser, createUser, markProfileCompleted } from '../../fixtures/api-helpers.ts';
import {
    API_URL,
    cleanupArrearsRows,
    ensureDeadlineVersion,
    type FakeWorld
} from '../../fixtures/arrears-cycle.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { startE2eFakeProvider } from '../../fixtures/fake-provider-server.ts';
import { startE2eMailCapture } from '../../fixtures/mail-capture-server.ts';
import { cleanupPlanChangeCase } from '../../fixtures/plan-change-e2e.ts';
import {
    createMigrationPlan,
    priceMigrationVersion,
    publishMigrationVersion,
    subscribeMigrationCustomer
} from '../../fixtures/plan-migration-flow.ts';
import { useAdminSession } from '../../fixtures/revocation-flow.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const ADMIN_URL = process.env.HOSPEDA_E2E_ADMIN_URL ?? 'http://localhost:18000';
const copy = esPages.planMigration;
const sourcePrice = 250000;
const upPrice = 350000;
const downPrice = 150000;
const ApiError = z.object({ error: z.object({ code: z.string() }) });
const PreviewBody = z.object({
    data: z.object({
        rows: z.array(
            z.object({ subscriptionId: z.string().uuid(), applicationDate: z.string().nullable() })
        )
    })
});
const money = ({ cents }: { readonly cents: number }) =>
    formatCurrency({ value: cents / 100, locale: 'es-AR', currency: 'ARS' });

/**
 * Requires the suite's catalog keys and billing deadline seed, API, admin, web,
 * and local fake provider. The case creates every plan and customer it uses.
 */
test.describe('TEST:B12:2 AC:B12:2 la previsualización @p0 @admin @billing @clock', () => {
    test.setTimeout(600_000);
    let world: FakeWorld | null = null;
    let providerNamespace = '';
    let actors: CreatedUser[] = [];
    let sourceVersionId = '';

    test.afterAll(async () => {
        const userIds = actors.map((actor) => actor.id);
        try {
            await world?.fakeServer.close();
            if (sourceVersionId) {
                await execSQL(
                    `DELETE FROM plan_migration_subscription
                      WHERE plan_migration_id IN
                        (SELECT id FROM plan_migration WHERE source_plan_version_id = $1)`,
                    [sourceVersionId]
                );
                await execSQL('DELETE FROM plan_migration WHERE source_plan_version_id = $1', [
                    sourceVersionId
                ]);
            }
            if (providerNamespace && userIds.length > 0) {
                await cleanupPlanChangeCase({ userIds, providerNamespace });
            }
            if (userIds.length > 0) {
                await cleanupArrearsRows({ userIds });
                await cleanupTestUsers(getDbPool(), userIds);
            }
            // Published plan versions are immutable audit history and are never deleted.
        } finally {
            await world?.mailCapture.close().catch(() => undefined);
        }
    });

    test('Dado un plan retirado con clientes, SUPER_ADMIN ve a cada cliente con subida o bajada, precios y fecha; su cuenta queda excluida; destino no vendible se rechaza y el lanzamiento guarda plazos', async ({
        page,
        browser
    }) => {
        // The catalog key and initial deadline row are suite-level seed data.
        await ensureDeadlineVersion();
        const [key] = await execSQL<{ key: string }>(
            `SELECT key FROM catalog_key
              WHERE kind = 'limit' AND key_class = 'COMMERCIAL'
                AND aggregation_strategy = 'MAX'
              ORDER BY key LIMIT 1`
        );
        if (!key) throw new Error('Expected a seeded comparable commercial limit.');
        providerNamespace = randomUUID();
        const clock = createAdjustableClock({ start: new Date() });
        const fakeServer = await startE2eFakeProvider({
            provider: new FakePaymentProvider({
                clock,
                idNamespace: providerNamespace,
                honestAbout: [
                    { lie: 'M6', why: 'TEST:B12:2 activates three real card checkouts.' },
                    { lie: 'M8', why: 'TEST:B12:2 needs credited active subscriptions.' }
                ]
            }),
            clock
        });
        try {
            world = { clock, fakeServer, mailCapture: await startE2eMailCapture() };
        } catch (error) {
            await fakeServer.close();
            throw error;
        }
        const admin = await createUser({ role: 'SUPER_ADMIN' }, { apiBaseUrl: API_URL });
        const first = await createUser({}, { apiBaseUrl: API_URL });
        const second = await createUser({}, { apiBaseUrl: API_URL });
        actors = [admin, first, second];
        for (const actor of actors) await markProfileCompleted({ userId: actor.id });

        const rank = 1_000_000_000 + Number.parseInt(providerNamespace.slice(0, 7), 16);
        const source = await createMigrationPlan({
            page,
            admin,
            label: 'source',
            limitKey: key.key,
            limitValue: 3,
            rank
        });
        sourceVersionId = source.versionId;
        const billingOptionId = await priceMigrationVersion({
            page,
            admin,
            versionId: source.versionId,
            amount: sourcePrice
        });
        const subscriptions: string[] = [];
        for (const actor of actors) {
            const context = await browser.newContext();
            try {
                subscriptions.push(
                    await subscribeMigrationCustomer({
                        page: await context.newPage(),
                        world,
                        user: actor,
                        billingOptionId
                    })
                );
            } finally {
                await context.close();
            }
        }
        const [ownSubscriptionId, firstSubscriptionId, secondSubscriptionId] = subscriptions;
        if (!ownSubscriptionId || !firstSubscriptionId || !secondSubscriptionId)
            throw new Error('Expected three checkout subscriptions.');

        const up = await createMigrationPlan({
            page,
            admin,
            label: 'up',
            limitKey: key.key,
            limitValue: 5,
            rank: rank + 1
        });
        await priceMigrationVersion({ page, admin, versionId: up.versionId, amount: upPrice });
        const down = await createMigrationPlan({
            page,
            admin,
            label: 'down',
            limitKey: key.key,
            limitValue: 1,
            rank: rank + 2
        });
        await priceMigrationVersion({ page, admin, versionId: down.versionId, amount: downPrice });
        const unsellable = await createMigrationPlan({
            page,
            admin,
            label: 'unsellable',
            limitKey: key.key,
            limitValue: 4,
            rank: rank + 3
        });
        const retiredTargetId = await publishMigrationVersion({
            page,
            admin,
            planId: unsellable.planId,
            rank: rank + 3,
            sellable: false,
            limitKey: key.key,
            limitValue: 4
        });
        await publishMigrationVersion({
            page,
            admin,
            planId: source.planId,
            rank,
            sellable: false,
            limitKey: key.key,
            limitValue: 3
        });

        await useAdminSession({ page, admin, adminUrl: ADMIN_URL });
        await page.goto(`${ADMIN_URL}/billing/plan-migration`);
        await expect(page.getByTestId('plan-migration-screen')).toBeVisible();
        await page.getByTestId('plan-migration-source').selectOption(source.versionId);
        await page.getByTestId('plan-migration-target').selectOption(up.versionId);
        const upResponse = page.waitForResponse(
            (response) =>
                response.url().endsWith('/api/v1/admin/plan-migrations/preview') &&
                response.request().method() === 'POST',
            { timeout: 30_000 }
        );
        await page.getByTestId('plan-migration-preview-button').click();
        const upRows = PreviewBody.parse(await (await upResponse).json()).data.rows;
        const rows = page.locator('tr[data-testid^="plan-migration-row-"]');
        await expect(rows).toHaveCount(3);
        for (const id of [firstSubscriptionId, secondSubscriptionId]) {
            const row = page.getByTestId(`plan-migration-row-${id}`);
            await expect(row.getByTestId('plan-migration-row-direction')).toHaveText(
                copy.direction.UP
            );
            await expect(row.getByTestId('plan-migration-row-current-amount')).toHaveText(
                money({ cents: sourcePrice })
            );
            await expect(row.getByTestId('plan-migration-row-new-amount')).toHaveText(
                money({ cents: upPrice })
            );
            const date = upRows.find((item) => item.subscriptionId === id)?.applicationDate;
            expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            await expect(row.getByTestId('plan-migration-row-date')).toHaveText(date ?? '');
        }
        const own = page.getByTestId(`plan-migration-row-${ownSubscriptionId}`);
        await expect(own.getByTestId('plan-migration-row-excluded')).toHaveText(copy.excludedBadge);
        await expect(own.getByTestId('plan-migration-row-date')).toContainText(
            copy.excluded.ACTOR_IS_SUBJECT
        );
        await expect(page.getByTestId('plan-migration-row-excluded')).toHaveCount(1);

        await page.getByTestId('plan-migration-target').selectOption(down.versionId);
        const downResponse = page.waitForResponse(
            (response) =>
                response.url().endsWith('/api/v1/admin/plan-migrations/preview') &&
                response.request().method() === 'POST',
            { timeout: 30_000 }
        );
        await page.getByTestId('plan-migration-preview-button').click();
        const downRows = PreviewBody.parse(await (await downResponse).json()).data.rows;
        await expect(rows).toHaveCount(3);
        for (const id of [firstSubscriptionId, secondSubscriptionId]) {
            const row = page.getByTestId(`plan-migration-row-${id}`);
            await expect(row.getByTestId('plan-migration-row-direction')).toHaveText(
                copy.direction.DOWN
            );
            await expect(row.getByTestId('plan-migration-row-new-amount')).toHaveText(
                money({ cents: downPrice })
            );
            const date = downRows.find((item) => item.subscriptionId === id)?.applicationDate;
            expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            await expect(row.getByTestId('plan-migration-row-date')).toHaveText(date ?? '');
        }
        await expect(page.getByTestId('plan-migration-row-excluded')).toHaveCount(1);

        // A retired target cannot be selected in the UI; exercise the real API rejection.
        await expect(
            page.getByTestId('plan-migration-target').locator(`option[value="${retiredTargetId}"]`)
        ).toHaveCount(0);
        const rejected = await page.request.post(
            `${API_URL}/api/v1/admin/plan-migrations/preview`,
            {
                headers: { cookie: admin.sessionCookie },
                data: {
                    sourcePlanVersionId: source.versionId,
                    targetPlanVersionId: retiredTargetId
                }
            }
        );
        expect(rejected.status()).toBeGreaterThanOrEqual(400);
        expect(rejected.status()).toBeLessThan(500);
        expect(ApiError.parse(await rejected.json()).error.code).toEqual(
            'PLAN_MIGRATION_TARGET_NOT_SELLABLE'
        );

        await page.getByTestId('plan-migration-confirm').click();
        await expect(page.getByTestId('plan-migration-result')).toBeVisible();
        const migrations = await execSQL<{ id: string; deadline_version: number }>(
            `SELECT id, deadline_version FROM plan_migration
              WHERE source_plan_version_id = $1 AND signed_by = $2 ORDER BY id`,
            [source.versionId, admin.id]
        );
        expect(migrations).toHaveLength(1);
        const [currentDeadline] = await execSQL<{ version: number }>(
            'SELECT version FROM billing_deadline_version ORDER BY version DESC LIMIT 1'
        );
        expect(migrations[0]?.deadline_version).toEqual(currentDeadline?.version);
        const persisted = await execSQL<{ subscription_id: string }>(
            `SELECT subscription_id FROM plan_migration_subscription
              WHERE plan_migration_id = $1 ORDER BY subscription_id`,
            [migrations[0]?.id]
        );
        expect(persisted.map((row) => row.subscription_id)).toEqual(
            [firstSubscriptionId, secondSubscriptionId].sort()
        );
        const ownRows = await execSQL<{ subscription_id: string }>(
            `SELECT subscription_id FROM plan_migration_subscription
              WHERE plan_migration_id = $1 AND subscription_id = $2`,
            [migrations[0]?.id, ownSubscriptionId]
        );
        expect(ownRows).toHaveLength(0);
    });
});
