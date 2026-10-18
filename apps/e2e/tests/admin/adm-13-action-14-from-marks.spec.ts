import { expect, type Page, test } from '@playwright/test';
import type { CreatedUser } from '../../fixtures/api-helpers.ts';
import { createUser, markAdminToursSeen } from '../../fixtures/api-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { monthlyOptionForSlug } from '../../fixtures/signup-checkout.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const ADMIN_URL = process.env.HOSPEDA_E2E_ADMIN_URL ?? 'http://localhost:3000';
const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';
const ownedUserIds: string[] = [];
const ownedPayments: string[] = [];
const ownedMarks: string[] = [];
const ownedRefunds: string[] = [];
let subscriptionId: string;
let mark18Id: string;
let mark19Id: string;

async function useAdminSession(page: Page, admin: CreatedUser): Promise<void> {
    await page.context().addCookies(
        admin.sessionCookie.split('; ').map((cookie) => {
            const [name, ...value] = cookie.split('=');
            return { name: (name ?? '').trim(), value: value.join('='), url: ADMIN_URL };
        })
    );
}

async function findMarkOnAnyPage(page: Page, markId: string) {
    const mark = page.locator(`[data-testid="reconciliation-mark"][data-mark-id="${markId}"]`);
    const next = page.getByRole('button', { name: 'Siguiente' });
    while ((await mark.count()) === 0 && (await next.isEnabled())) {
        await next.click();
        await expect(page.locator('[data-testid="reconciliation-mark"]').first()).toBeVisible();
    }
    await expect(mark).toHaveCount(1);
    return mark;
}

test.describe('TEST:B13a:10 admin action 14 on marks 18 and 19 @p0 @admin', () => {
    test.afterAll(async () => {
        if (ownedRefunds.length)
            await execSQL('DELETE FROM refund WHERE id = ANY($1::uuid[])', [ownedRefunds]);
        if (ownedMarks.length)
            await execSQL(
                'DELETE FROM reconciliation_mark_payment WHERE mark_id = ANY($1::uuid[])',
                [ownedMarks]
            );
        if (ownedMarks.length)
            await execSQL('DELETE FROM reconciliation_mark WHERE id = ANY($1::uuid[])', [
                ownedMarks
            ]);
        if (ownedPayments.length)
            await execSQL('DELETE FROM payment WHERE id = ANY($1::uuid[])', [ownedPayments]);
        if (subscriptionId)
            await execSQL('DELETE FROM subscription WHERE id = $1', [subscriptionId]);
        if (ownedUserIds.length) await cleanupTestUsers(getDbPool(), [...ownedUserIds]);
    });

    test.beforeAll(async () => {
        const owner = await createUser({ role: 'HOST' }, { apiBaseUrl: API_URL });
        ownedUserIds.push(owner.id);
        const optionId = await monthlyOptionForSlug('owner-basico');
        const [subscription] = await execSQL<{ id: string }>(
            `INSERT INTO subscription (user_id, vertical, plan_version_id, billing_option_id,
                                       payment_method, status, class)
             SELECT $1, pv.vertical, pv.id, bo.id, 'CARD', 'ACTIVE', 'PRINCIPAL'
               FROM billing_option bo JOIN plan_version pv ON pv.id = bo.plan_version_id
              WHERE bo.id = $2 RETURNING id`,
            [owner.id, optionId]
        );
        if (!subscription) throw new Error('Expected the owned active subscription');
        subscriptionId = subscription.id;
        const [payment] = await execSQL<{ id: string }>(
            `INSERT INTO payment (subscription_id, amount, currency, status, provider, provider_fact_id, fact_at)
             VALUES ($1, 12500, 'ARS', 'SUCCEEDED', 'TEST', $2, now()) RETURNING id`,
            [subscriptionId, `adm13-${owner.id}`]
        );
        if (!payment) throw new Error('Expected the owned credited payment');
        ownedPayments.push(payment.id);
        const marks = await execSQL<{ id: string; reason: string }>(
            `WITH moment AS (SELECT now() - interval '3650 days' AS at),
             m18 AS (INSERT INTO reconciliation_mark (subscription_id, reason, placed_at, deadlines_version)
                     SELECT $1, 'REEMBOLSO_FUERA_DEL_FLUJO', at,
                            (SELECT max(version) FROM billing_deadline_version) FROM moment RETURNING id, placed_at, reason),
             m19 AS (INSERT INTO reconciliation_mark (subscription_id, reason, placed_at, deadlines_version)
                     SELECT $1, 'COBRO_SIN_REGISTRAR', at + interval '1 second',
                            (SELECT max(version) FROM billing_deadline_version) FROM moment RETURNING id, placed_at),
             hung AS (INSERT INTO reconciliation_mark_payment (mark_id, payment_id, hung_at)
                      SELECT m18.id, $2, m18.placed_at FROM m18),
             events AS (INSERT INTO domain_event (event_type, entity_type, entity_id, actor_type, correlation_id, occurred_at, changes)
                        SELECT 'reconciliation.mark_opened', 'subscription', $1::text, 'provider', gen_random_uuid(), x.placed_at,
                               jsonb_build_array(jsonb_build_object('field','reconciliation_mark.id','new',x.id),
                                                 jsonb_build_object('field','reconciliation_mark.reason','new',x.reason),
                                                 jsonb_build_object('field','reconciliation_mark.outcome','new','OPENED'))
                          FROM (SELECT id, placed_at, 'REEMBOLSO_FUERA_DEL_FLUJO' AS reason FROM m18
                                UNION ALL SELECT id, placed_at, 'COBRO_SIN_REGISTRAR' FROM m19) x RETURNING id)
             SELECT id, reason FROM m18 UNION ALL SELECT id, 'COBRO_SIN_REGISTRAR' FROM m19`,
            [subscriptionId, payment.id]
        );
        const first = marks.find(({ reason }) => reason === 'REEMBOLSO_FUERA_DEL_FLUJO');
        const second = marks.find(({ reason }) => reason === 'COBRO_SIN_REGISTRAR');
        if (!first || !second) throw new Error('Expected owned marks 18 and 19');
        mark18Id = first.id;
        mark19Id = second.id;
        ownedMarks.push(mark18Id, mark19Id);
    });

    test('offers and records mark 18 for a permitted admin, hides it for ADMIN, and offers mark 19', async ({
        page
    }) => {
        const superAdmin = await createUser({ role: 'SUPER_ADMIN' }, { apiBaseUrl: API_URL });
        ownedUserIds.push(superAdmin.id);
        await markAdminToursSeen({ userId: superAdmin.id });
        await useAdminSession(page, superAdmin);
        await page.goto(`${ADMIN_URL}/billing/reconciliation`, { waitUntil: 'domcontentloaded' });
        const mark18 = await findMarkOnAnyPage(page, mark18Id);
        await expect(mark18).toBeVisible();
        const action18 = mark18.getByTestId('reconciliation-mark-action14');
        await expect(action18).toBeVisible();
        const ordinaryAdmin = await createUser({ role: 'ADMIN' }, { apiBaseUrl: API_URL });
        ownedUserIds.push(ordinaryAdmin.id);
        // Allow the mark list to load while leaving action 14's permission absent.
        const readPermission = await fetch(
            `${API_URL}/api/v1/admin/users/${ordinaryAdmin.id}/permissions`,
            {
                method: 'POST',
                headers: {
                    cookie: superAdmin.sessionCookie,
                    'content-type': 'application/json'
                },
                body: JSON.stringify({
                    permission: 'billing.subscription.inspect',
                    effect: 'grant'
                })
            }
        );
        expect(readPermission.ok).toBe(true);
        await markAdminToursSeen({ userId: ordinaryAdmin.id });
        await page.context().clearCookies();
        await useAdminSession(page, ordinaryAdmin);
        await page.goto(`${ADMIN_URL}/billing/reconciliation`, { waitUntil: 'domcontentloaded' });
        const stillVisibleMark18 = await findMarkOnAnyPage(page, mark18Id);
        await expect(stillVisibleMark18).toBeVisible();
        await expect(stillVisibleMark18.getByTestId('reconciliation-mark-action14')).toHaveCount(0);

        await page.context().clearCookies();
        await useAdminSession(page, superAdmin);
        await page.goto(`${ADMIN_URL}/billing/reconciliation`, { waitUntil: 'domcontentloaded' });
        await action18.getByLabel('Monto en pesos').fill('50.00');
        await action18.getByLabel('Canal de devolución').selectOption('BANK_TRANSFER');
        await action18.getByLabel('Comprobante o referencia').fill(`adm13-receipt-${mark18Id}`);
        await action18.getByRole('button', { name: 'Revisar asiento' }).click();
        await expect(
            action18.getByTestId('reconciliation-mark-action14-confirmation')
        ).toContainText(`adm13-receipt-${mark18Id}`);
        await action18.getByRole('button', { name: 'Asentar ahora' }).click();
        await expect(action18.getByRole('status')).toContainText('EXECUTED');
        const refunds = await execSQL<{ id: string }>(
            `SELECT id FROM refund WHERE payment_id = $1 AND status = 'EXECUTED' AND settled_by = $2`,
            [ownedPayments[0], superAdmin.id]
        );
        expect(refunds).toHaveLength(1);
        ownedRefunds.push(refunds[0]!.id);

        const mark19 = await findMarkOnAnyPage(page, mark19Id);
        await expect(mark19).toBeVisible();
        const action19 = mark19.getByTestId('reconciliation-mark-action14');
        await expect(action19.getByLabel('ID del cobro aprobado en el proveedor')).toBeVisible();
        await action19
            .getByLabel('ID del cobro aprobado en el proveedor')
            .fill('charge-id-from-provider-panel');
        await action19.getByRole('button', { name: 'Revisar asiento' }).click();
        await expect(
            action19.getByTestId('reconciliation-mark-action14-confirmation')
        ).toContainText('charge-id-from-provider-panel');
    });
});
