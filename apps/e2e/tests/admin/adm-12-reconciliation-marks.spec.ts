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
let subscriptionId: string;

async function useAdminSession(page: Page, admin: CreatedUser): Promise<void> {
    await page.context().addCookies(
        admin.sessionCookie.split('; ').map((cookie) => {
            const [name, ...value] = cookie.split('=');
            return { name: (name ?? '').trim(), value: value.join('='), url: ADMIN_URL };
        })
    );
}

test.describe('TEST:B13a:8 actionable reconciliation list @p0 @admin', () => {
    test.afterAll(async () => {
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

    test('shows one entry per mark and links reason 7 to its failed condition', async ({
        page
    }) => {
        const admin = await createUser({ role: 'SUPER_ADMIN' }, { apiBaseUrl: API_URL });
        ownedUserIds.push(admin.id);
        await markAdminToursSeen({ userId: admin.id });
        const owner = await createUser({ role: 'HOST' }, { apiBaseUrl: API_URL });
        ownedUserIds.push(owner.id);
        const billingOptionId = await monthlyOptionForSlug('owner-basico');
        const [subscription] = await execSQL<{ id: string }>(
            `INSERT INTO subscription (user_id, vertical, plan_version_id, billing_option_id,
                                       payment_method, status, class, grace_started_at, grace_ends_at)
             SELECT $1, pv.vertical, pv.id, bo.id, 'CARD', 'GRACE_PERIOD', 'PRINCIPAL', now(), now() + interval '10 days'
               FROM billing_option bo JOIN plan_version pv ON pv.id = bo.plan_version_id
              WHERE bo.id = $2 RETURNING id`,
            [owner.id, billingOptionId]
        );
        if (!subscription) throw new Error('Expected the owned grace-period subscription');
        subscriptionId = subscription.id;
        const payments = await execSQL<{ id: string }>(
            `INSERT INTO payment (subscription_id, amount, currency, status, provider, provider_fact_id, fact_at)
             VALUES ($1, 12500, 'ARS', 'SUCCEEDED', 'TEST', $2, now()),
                    ($1, 12500, 'ARS', 'SUCCEEDED', 'TEST', $3, now()) RETURNING id`,
            [subscriptionId, `adm12-a-${owner.id}`, `adm12-b-${owner.id}`]
        );
        ownedPayments.push(...payments.map(({ id }) => id));

        const [reasonSeven] = await execSQL<{ id: string }>(
            `WITH moment AS (SELECT now() - interval '3650 days' AS at), mark AS (
                 INSERT INTO reconciliation_mark (subscription_id, reason, placed_at, deadlines_version)
                 SELECT $1, 'PAGO_TARDIO_RECHAZADO', moment.at,
                        (SELECT max(version) FROM billing_deadline_version)
                   FROM moment RETURNING id, placed_at
             ), hung AS (
                 INSERT INTO reconciliation_mark_payment (mark_id, payment_id, hung_at)
                 SELECT mark.id, payment.id, mark.placed_at FROM mark CROSS JOIN unnest($2::uuid[]) payment(id)
             ), event AS (
                 INSERT INTO domain_event (event_type, entity_type, entity_id, actor_type, correlation_id, occurred_at, changes)
                 SELECT 'reconciliation.mark_opened', 'subscription', $1::text, 'provider', gen_random_uuid(), mark.placed_at,
                        jsonb_build_array(jsonb_build_object('field','reconciliation_mark.id','new',mark.id),
                                          jsonb_build_object('field','reconciliation_mark.reason','new','PAGO_TARDIO_RECHAZADO'),
                                          jsonb_build_object('field','reconciliation_mark.outcome','new','OPENED'),
                                          jsonb_build_object('field','late_payment.failed_condition','new',2))
                   FROM mark RETURNING id
             ) SELECT mark.id FROM mark CROSS JOIN event`,
            [subscriptionId, ownedPayments]
        );
        if (!reasonSeven) throw new Error('Expected the owned reason-seven mark');
        ownedMarks.push(reasonSeven.id);
        const [reasonFive] = await execSQL<{ id: string }>(
            `WITH moment AS (SELECT now() - interval '3650 days' AS at), mark AS (
                 INSERT INTO reconciliation_mark (subscription_id, reason, placed_at, deadlines_version)
                 SELECT $1, 'DIVERGENCIA_DE_MONTO', moment.at,
                        (SELECT max(version) FROM billing_deadline_version)
                   FROM moment RETURNING id, placed_at
             ), event AS (
                 INSERT INTO domain_event (event_type, entity_type, entity_id, actor_type, correlation_id, occurred_at, changes)
                 SELECT 'reconciliation.mark_opened', 'subscription', $1::text, 'provider', gen_random_uuid(), mark.placed_at,
                        jsonb_build_array(jsonb_build_object('field','reconciliation_mark.id','new',mark.id),
                                          jsonb_build_object('field','reconciliation_mark.reason','new','DIVERGENCIA_DE_MONTO'),
                                          jsonb_build_object('field','reconciliation_mark.outcome','new','OPENED'))
                   FROM mark RETURNING id
             ) SELECT mark.id FROM mark CROSS JOIN event`,
            [subscriptionId]
        );
        if (!reasonFive) throw new Error('Expected the owned reason-five mark');
        ownedMarks.push(reasonFive.id);

        await useAdminSession(page, admin);
        await page.goto(`${ADMIN_URL}/billing/reconciliation`, { waitUntil: 'domcontentloaded' });
        let pageIndex = 1;
        const findMark = (id: string) =>
            page.locator(`[data-testid="reconciliation-mark"][data-mark-id="${id}"]`);
        await expect
            .poll(async () => findMark(reasonSeven.id).count(), { timeout: 30_000 })
            .toBe(1);
        const markSeven = findMark(reasonSeven.id);
        await expect(markSeven.getByTestId('reconciliation-mark-payment')).toHaveCount(2);
        await expect(markSeven.getByTestId('reconciliation-mark-payment-count')).toContainText('2');
        await expect(markSeven.getByTestId('reconciliation-mark-total')).toContainText('250,00');
        await expect(markSeven.getByTestId('reconciliation-mark-proposal')).toContainText(
            'Devolver'
        );
        await expect(markSeven.getByTestId('reconciliation-mark-event-link')).toBeVisible();
        while ((await findMark(reasonFive.id).count()) === 0) {
            await page.getByRole('button', { name: 'Siguiente' }).click();
            pageIndex += 1;
            await expect
                .poll(async () => page.locator('[data-testid="reconciliation-mark"]').count(), {
                    timeout: 10_000
                })
                .toBeGreaterThan(0);
        }
        const markFive = findMark(reasonFive.id);
        await expect(markFive).toBeVisible();
        await expect(markFive.getByTestId('reconciliation-mark-event-link')).toHaveCount(0);
        if (pageIndex === 1) {
            const ids = await page
                .locator('[data-testid="reconciliation-mark"]')
                .evaluateAll((items) => items.map((item) => item.getAttribute('data-mark-id')));
            expect(ids.indexOf(reasonSeven.id)).toBeLessThan(ids.indexOf(reasonFive.id));
        } else {
            expect(pageIndex).toBeGreaterThan(1);
        }
        await markSeven.getByTestId('reconciliation-mark-event-link').click();
        await expect(page.getByTestId('reconciliation-mark-event-condition')).toContainText(
            'Condición 2: El monto coincide con el esperado para el período que cubre.'
        );
    });
});
