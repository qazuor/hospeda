import { eq, getDb, refunds, subscriptions } from '@repo/db';
import {
    AdminSubscriptionCancellationResponseSchema,
    PermissionEnum,
    SubscriptionCancellationPreviewResponseSchema
} from '@repo/schemas';
import { startSubscription } from '@repo/service-core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { AuditEventType } from '../../../src/utils/audit-logger';
import { validateApiEnv } from '../../../src/utils/env';
import { injectPaymentProvider } from '../../../src/utils/payment-provider';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
    decisionsOf,
    NOW,
    presetAdminDirectCancelNotice,
    presetSelfCancelNotice,
    retireAdminCancellationRows,
    revocationWrites,
    routeClock,
    routeFake,
    seedAdminGraceCard,
    seedAdminSuspendedCard,
    seedAdminSuspendedManual,
    seedSelfActive,
    seedSelfState
} from './admin-cancellation-fixtures';

const clock = routeClock();
const fake = routeFake(clock);
const audit = vi.hoisted(() => vi.fn());
vi.mock('../../../src/utils/audit-logger', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    auditLog: audit
}));
let app: ReturnType<typeof initApp>;
const startedSubscriptionIds: string[] = [];
const pathOf = (id: string) => `/api/v1/admin/billing-subscription/${id}/cancellation`;
const adminHeaders = (id: string) =>
    actorHeaders({
        id,
        role: 'SUPER_ADMIN',
        permissions: [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.BILLING_CANCEL_SUBSCRIPTION]
    });
const post = (id: string, actorId: string, expectedOrigin: string) =>
    app.request(pathOf(id), {
        method: 'POST',
        headers: adminHeaders(actorId),
        body: JSON.stringify({ expectedOrigin })
    });

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
    app = initApp({ clock, paymentProvider: fake });
});
beforeEach(() => {
    clock.set(NOW);
    injectPaymentProvider({ provider: fake });
    audit.mockClear();
});
afterEach(async () => {
    for (const id of startedSubscriptionIds.splice(0))
        await getDb()
            .update(subscriptions)
            .set({ status: 'CANCELLED' })
            .where(eq(subscriptions.id, id));
    await retireAdminCancellationRows();
    vi.restoreAllMocks();
});
afterAll(async () => {
    await retireAdminCancellationRows();
    await testDb.teardown();
});

describe('TEST:1696:1 AC:1696:1 admin cancellation acts and AC:B8a:8 admin half', () => {
    it('(a) ACTIVE previews and schedules S11 without creating a refund', async () => {
        const seeded = await seedSelfActive(fake, clock);
        await presetSelfCancelNotice({ ...seeded, status: 'sent' });
        const adminId = '00000000-0000-4000-8000-000000000099';
        const previewResponse = await app.request(pathOf(seeded.subscriptionId), {
            headers: adminHeaders(adminId)
        });
        expect(previewResponse.status).toBe(200);
        const preview = SubscriptionCancellationPreviewResponseSchema.parse(
            (await previewResponse.json()).data
        );
        expect(preview).toMatchObject({ origin: 'ACTIVE' });
        if (preview.origin !== 'ACTIVE') throw new Error('Expected ACTIVE preview');

        const response = await post(
            seeded.subscriptionId,
            '00000000-0000-4000-8000-000000000099',
            'ACTIVE'
        );
        expect(response.status).toBe(200);
        const body = AdminSubscriptionCancellationResponseSchema.parse(
            (await response.json()).data
        );
        expect(body).toMatchObject({
            outcome: 'SCHEDULED',
            transition: 'S11',
            serviceEndsAt: preview.serviceEndsAt,
            cancelCall: 'SENT'
        });
        const [row] = await getDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.subscriptionId));
        expect(row?.status).toBe('CANCEL_SCHEDULED');
        expect(row?.serviceEndsAt?.toISOString()).toBe(preview.serviceEndsAt);
        expect(
            (await decisionsOf(seeded.subscriptionId)).some((event) => event.reason === 'S11')
        ).toBe(true);
        expect(
            (await fake.readAuthorization({ authorizationId: seeded.authorizationId })).snapshot
                .status
        ).toBe('cancelled');
        expect(
            await getDb().select().from(refunds).where(eq(refunds.paymentId, seeded.paymentId))
        ).toEqual([]);
    });

    it('(b) SUSPENDED executes S23, ends service at the act instant, and releases its live authorization', async () => {
        const seeded = await seedAdminSuspendedCard({ fake, clock, preapproval: 'ALIVE' });
        await presetAdminDirectCancelNotice(seeded);
        const response = await post(
            seeded.subscriptionId,
            '00000000-0000-4000-8000-000000000098',
            'SUSPENDED'
        );
        expect(response.status).toBe(200);
        const body = AdminSubscriptionCancellationResponseSchema.parse(
            (await response.json()).data
        );
        expect(body).toMatchObject({ outcome: 'CANCELLED', transition: 'S23', cancelCall: 'SENT' });
        const [row] = await getDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.subscriptionId));
        expect(row?.status).toBe('CANCELLED');
        expect(row?.serviceEndsAt?.toISOString()).toBe(body.serviceEndsAt);
        expect(
            (await decisionsOf(seeded.subscriptionId)).some((event) => event.reason === 'S23')
        ).toBe(true);
        expect(
            (await fake.readAuthorization({ authorizationId: seeded.authorizationId })).snapshot
                .status
        ).toBe('cancelled');
        if (!row?.billingOptionId)
            throw new Error('Expected billing option on suspended subscription');
        const started = await startSubscription(
            {
                userId: seeded.ownerId,
                billingOptionId: row.billingOptionId,
                returnUrl: 'https://example.test'
            },
            {
                provider: fake,
                clock,
                beforeCancelNotice: { beforeCancel: async () => 'SENT' },
                touristVipInheritance: { inherits: async () => false },
                planPolicy: async () => ({
                    graceDays: 10,
                    allowsPause: false,
                    current: true,
                    sellable: true
                })
            }
        );
        startedSubscriptionIds.push(started.subscriptionId);
        expect(started.subscriptionId).not.toBe(seeded.subscriptionId);
    });

    it('(c) an already cancelled provider authorization is NOT_NEEDED', async () => {
        const seeded = await seedAdminSuspendedCard({ fake, clock, preapproval: 'CANCELLED' });
        const response = await post(
            seeded.subscriptionId,
            '00000000-0000-4000-8000-000000000097',
            'SUSPENDED'
        );
        expect(response.status).toBe(200);
        expect((await response.json()).data).toMatchObject({ cancelCall: 'NOT_NEEDED' });
    });

    it('(d) a suspended manual payer has no provider cancellation call', async () => {
        const seeded = await seedAdminSuspendedManual();
        const cancel = vi.spyOn(fake, 'cancel');
        const response = await post(
            seeded.subscriptionId,
            '00000000-0000-4000-8000-000000000096',
            'SUSPENDED'
        );
        expect(response.status).toBe(200);
        expect((await response.json()).data).toMatchObject({ cancelCall: 'NOT_APPLICABLE' });
        expect(cancel).not.toHaveBeenCalled();
    });

    it('(e) GRACE_PERIOD executes S24 today and retains its grace clock', async () => {
        const seeded = await seedAdminGraceCard({ fake, clock });
        await presetAdminDirectCancelNotice(seeded);
        const [before] = await getDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.subscriptionId));
        const response = await post(
            seeded.subscriptionId,
            '00000000-0000-4000-8000-000000000095',
            'GRACE_PERIOD'
        );
        expect(response.status).toBe(200);
        const body = AdminSubscriptionCancellationResponseSchema.parse(
            (await response.json()).data
        );
        expect(body).toMatchObject({ outcome: 'CANCELLED', transition: 'S24' });
        const [after] = await getDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.subscriptionId));
        expect(after?.status).toBe('CANCELLED');
        expect(after?.serviceEndsAt?.toISOString()).toBe(body.serviceEndsAt);
        expect(after?.graceStartedAt?.toISOString()).toBe(before?.graceStartedAt?.toISOString());
        expect(after?.graceEndsAt?.toISOString()).toBe(before?.graceEndsAt?.toISOString());
    });

    it('(f) S11 and S23 repeats are idempotent and do not issue another provider call', async () => {
        const active = await seedSelfActive(fake, clock);
        await presetSelfCancelNotice({ ...active, status: 'sent' });
        const adminId = '00000000-0000-4000-8000-000000000094';
        const cancel = vi.spyOn(fake, 'cancel');
        const first = await post(active.subscriptionId, adminId, 'ACTIVE');
        const callsAfterActive = cancel.mock.calls.length;
        const firstBody = (await first.json()).data;
        const count = (await decisionsOf(active.subscriptionId)).length;
        const second = await post(active.subscriptionId, adminId, 'ACTIVE');
        expect((await second.json()).data).toMatchObject({
            outcome: 'ALREADY_SCHEDULED',
            transition: null,
            serviceEndsAt: firstBody.serviceEndsAt
        });
        expect(cancel).toHaveBeenCalledTimes(callsAfterActive);
        expect((await decisionsOf(active.subscriptionId)).length).toBe(count);

        const suspended = await seedAdminSuspendedCard({ fake, clock, preapproval: 'ALIVE' });
        await presetAdminDirectCancelNotice(suspended);
        await post(suspended.subscriptionId, adminId, 'SUSPENDED');
        const callsAfterSuspended = cancel.mock.calls.length;
        const decisions = await decisionsOf(suspended.subscriptionId);
        const repeated = await post(suspended.subscriptionId, adminId, 'SUSPENDED');
        expect((await repeated.json()).data).toMatchObject({
            outcome: 'ALREADY_CANCELLED',
            transition: null
        });
        expect(cancel).toHaveBeenCalledTimes(callsAfterSuspended);
        expect((await decisionsOf(suspended.subscriptionId)).length).toBe(decisions.length);
    });

    it('(g) a pending before-cancel notice defers the provider call', async () => {
        const seeded = await seedSelfActive(fake, clock);
        const response = await post(
            seeded.subscriptionId,
            '00000000-0000-4000-8000-000000000093',
            'ACTIVE'
        );
        expect(response.status).toBe(200);
        expect((await response.json()).data).toMatchObject({ cancelCall: 'NOTICE_PENDING' });
        expect(
            (await fake.readAuthorization({ authorizationId: seeded.authorizationId })).snapshot
                .status
        ).not.toBe('cancelled');
    });

    it('(h) previews validate, disclose origin-specific fields, and only audit reads', async () => {
        const adminId = '00000000-0000-4000-8000-000000000092';
        const active = await seedSelfActive(fake, clock);
        const activeWrites = await revocationWrites(active);
        const activePreview = await app.request(pathOf(active.subscriptionId), {
            headers: adminHeaders(adminId)
        });
        expect(
            SubscriptionCancellationPreviewResponseSchema.safeParse(
                (await activePreview.json()).data
            ).success
        ).toBe(true);
        const activeAfter = await revocationWrites(active);
        expect(activeAfter).toEqual(activeWrites);
        const grace = await seedAdminGraceCard({ fake, clock });
        const gracePreview = await app.request(pathOf(grace.subscriptionId), {
            headers: adminHeaders(adminId)
        });
        const graceBody = SubscriptionCancellationPreviewResponseSchema.parse(
            (await gracePreview.json()).data
        );
        expect(graceBody.origin).toBe('GRACE_PERIOD');
        if (graceBody.origin === 'GRACE_PERIOD') expect(graceBody.graceEndsAt).toBeTruthy();
        const suspended = await seedAdminSuspendedManual();
        const suspendedPreview = await app.request(pathOf(suspended.subscriptionId), {
            headers: adminHeaders(adminId)
        });
        expect((await suspendedPreview.json()).data.origin).toBe('SUSPENDED');
        const scheduled = await seedSelfState('CANCEL_SCHEDULED');
        const scheduledPreview = await app.request(pathOf(scheduled.subscriptionId), {
            headers: adminHeaders(adminId)
        });
        const scheduledBody = SubscriptionCancellationPreviewResponseSchema.parse(
            (await scheduledPreview.json()).data
        );
        expect(scheduledBody.origin).toBe('CANCEL_SCHEDULED');
        expect(
            audit.mock.calls.every(([entry]) => entry.auditEvent === AuditEventType.BILLING_READ)
        ).toBe(true);
    });
});
