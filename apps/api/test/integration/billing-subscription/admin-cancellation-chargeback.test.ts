import {
    eq,
    getDb,
    payments,
    reconciliationMarkPayments,
    reconciliationMarks,
    refunds,
    subscriptions
} from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { injectPaymentProvider } from '../../../src/utils/payment-provider';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
    NOW,
    presetSelfCancelNotice,
    retireAdminCancellationRows,
    routeClock,
    routeFake,
    seedAdminChargebackActive
} from './admin-cancellation-fixtures';

const clock = routeClock();
const fake = routeFake(clock);
let app: ReturnType<typeof initApp>;
const adminHeaders = (id: string) =>
    actorHeaders({
        id,
        role: 'SUPER_ADMIN',
        permissions: [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.BILLING_CANCEL_SUBSCRIPTION]
    });
const cancellationPath = (id: string) => `/api/v1/admin/billing-subscription/${id}/cancellation`;
const revocationPath = (id: string) => `/api/v1/admin/billing-subscription/${id}/revocation`;

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
    app = initApp({ clock, paymentProvider: fake });
});
beforeEach(() => {
    clock.set(NOW);
    injectPaymentProvider({ provider: fake });
});
afterEach(async () => retireAdminCancellationRows());
afterAll(async () => {
    await retireAdminCancellationRows();
    await testDb.teardown();
});

describe('TEST:1696:4 AC:1696:4 chargeback cancellation outside the revocation window', () => {
    it('(a) S36 revocation is closed after ten days', async () => {
        const seeded = await seedAdminChargebackActive({ fake, clock });
        const response = await app.request(revocationPath(seeded.subscriptionId), {
            headers: adminHeaders('00000000-0000-4000-8000-000000000071')
        });
        const body = await response.json();
        expect(response.status).toBe(422);
        expect(body.error).toMatchObject({ reason: 'REVOCATION_WINDOW_CLOSED' });
    });

    it('(b) action 8 previews and schedules S11 without a refund', async () => {
        const seeded = await seedAdminChargebackActive({ fake, clock });
        await presetSelfCancelNotice({ ...seeded, status: 'sent' });
        const headers = adminHeaders('00000000-0000-4000-8000-000000000072');
        const previewResponse = await app.request(cancellationPath(seeded.subscriptionId), {
            headers
        });
        expect(previewResponse.status).toBe(200);
        expect((await previewResponse.json()).data.origin).toBe('ACTIVE');
        const response = await app.request(cancellationPath(seeded.subscriptionId), {
            method: 'POST',
            headers,
            body: JSON.stringify({ expectedOrigin: 'ACTIVE' })
        });
        expect(response.status).toBe(200);
        expect((await response.json()).data).toMatchObject({
            outcome: 'SCHEDULED',
            transition: 'S11'
        });
        const [row] = await getDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.subscriptionId));
        expect(row?.status).toBe('CANCEL_SCHEDULED');
        expect(
            (await fake.readAuthorization({ authorizationId: seeded.authorizationId })).snapshot
                .status
        ).toBe('cancelled');
        expect(
            await getDb().select().from(refunds).where(eq(refunds.paymentId, seeded.paymentId))
        ).toEqual([]);
        const [mark] = await getDb()
            .select()
            .from(reconciliationMarks)
            .where(eq(reconciliationMarks.id, seeded.markId));
        const [hungPayment] = await getDb()
            .select()
            .from(reconciliationMarkPayments)
            .where(eq(reconciliationMarkPayments.markId, seeded.markId));
        const [payment] = await getDb()
            .select()
            .from(payments)
            .where(eq(payments.id, seeded.paymentId));
        expect(mark?.liftedAt).toBeNull();
        expect(hungPayment?.resolvedAt).toBeNull();
        expect(payment?.status).toBe('SUCCEEDED');
    });
});
