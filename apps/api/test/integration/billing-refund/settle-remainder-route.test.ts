/**
 * HOS-2406: POST /api/v1/admin/billing-refunds/{refundId}/settle-remainder. Records the remainder
 * of a CONFIRMED refund the provider accepted only in part, refunded by hand from the provider
 * panel. Covers the error-contract order (401 → 403 → 400 → 404 → 409/422) and the audit record.
 * HOS-2538: also a CONFIRMED refund whose only unanswered call is older than 24 hours.
 */
import { eq, getDb, idempotencyKeys, payments, refundCalls, refunds } from '@repo/db';
import { PaymentProviderError } from '@repo/payments';
import { PermissionEnum } from '@repo/schemas';
import { REFUND_CALL_RETRY_LIMIT_MS } from '@repo/service-core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { AuditEventType } from '../../../src/utils/audit-logger';
import { validateApiEnv } from '../../../src/utils/env';
import { injectPaymentProvider } from '../../../src/utils/payment-provider';
import { testDb } from '../../e2e/setup/test-database';
import { actorHeaders, NOW } from '../billing-subscription/revocation-route-fixtures';
import {
    baselineFake,
    cleanupConfirmRefundRows,
    confirmClock,
    confirmFake,
    confirmRows,
    seedConfirmRefund
} from './confirm-refund-fixtures';

const audit = vi.hoisted(() => vi.fn());
vi.mock('../../../src/utils/audit-logger', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    auditLog: audit
}));

const permissions = [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.BILLING_SETTLE_EXTERNAL];
let app: ReturnType<typeof initApp>;

const settle = (input: {
    readonly refundId: string;
    readonly headers: HeadersInit;
    readonly body?: unknown;
}) =>
    app.request(`/api/v1/admin/billing-refunds/${input.refundId}/settle-remainder`, {
        method: 'POST',
        headers: input.headers,
        body: JSON.stringify(input.body ?? { amount: 2000, reference: `mp-${crypto.randomUUID()}` })
    });

const admin = (id: string, granted: readonly PermissionEnum[] = permissions) =>
    actorHeaders({ id, role: 'SUPER_ADMIN', permissions: granted });

/**
 * Refunds `amount` of a charge at the fake and returns the provider refund id. The first partial
 * refund of a charge is refused as not refundable (lie M13, on), so it is asked once more.
 */
async function refundAtFake(chargeId: string, amount: number): Promise<string> {
    for (let attempt = 0; ; attempt++) {
        try {
            const { refundId } = await confirmFake.refund({
                chargeId,
                amount: { amountMinor: amount, currency: 'ARS' },
                reference: `refund-${crypto.randomUUID()}`
            });
            return refundId;
        } catch (error) {
            const m13 =
                error instanceof PaymentProviderError &&
                error.refundRefusal === 'AMOUNT_NOT_ACCEPTED';
            if (!m13 || attempt > 0) throw error;
        }
    }
}

/**
 * A 6000 refund on a 10000 charge, CONFIRMED with one accepted 4000 call (credited at the fake
 * unless `accepted` names another provider refund id) and one rejected (or unanswered) 2000 call.
 */
async function seedPartiallyAccepted(
    calls: 'PARTIAL' | 'UNANSWERED' = 'PARTIAL',
    acceptedId?: string
) {
    const seeded = await seedConfirmRefund(10000, 6000);
    const db = getDb();
    await db
        .update(refunds)
        .set({ status: 'CONFIRMED', confirmedBy: seeded.adminId })
        .where(eq(refunds.id, seeded.refundId));
    const accepted = acceptedId ?? (await refundAtFake(seeded.chargeId, 4000));
    const rows = [
        { amount: 4000, providerRefundId: accepted, result: { outcome: 'ACCEPTED' } },
        {
            amount: 2000,
            providerRefundId: null,
            result: calls === 'PARTIAL' ? { outcome: 'REJECTED' } : null
        }
    ];
    for (const [index, row] of rows.entries()) {
        const key = `refund:${seeded.refundId}:${index + 1}`;
        await db.insert(idempotencyKeys).values({
            key,
            operation: 'REFUND_CREATE',
            subjectId: seeded.refundId,
            result: row.result,
            completedAt: row.result === null ? null : confirmClock.now()
        });
        await db.insert(refundCalls).values({
            refundId: seeded.refundId,
            idempotencyKey: key,
            amount: row.amount,
            providerRefundId: row.providerRefundId
        });
    }
    return seeded;
}

/** HOS-2538: a CONFIRMED refund of `amount` whose only call went unanswered `ageMs` ago. */
async function seedStaleCall(amount: number, ageMs: number) {
    const seeded = await seedConfirmRefund(10000, amount);
    const db = getDb();
    await db
        .update(refunds)
        .set({ status: 'CONFIRMED', confirmedBy: seeded.adminId })
        .where(eq(refunds.id, seeded.refundId));
    const key = `refund:${seeded.refundId}:1`;
    await db
        .insert(idempotencyKeys)
        .values({ key, operation: 'REFUND_CREATE', subjectId: seeded.refundId });
    await db.insert(refundCalls).values({
        refundId: seeded.refundId,
        idempotencyKey: key,
        amount,
        providerRefundId: null,
        createdAt: new Date(confirmClock.now().getTime() - ageMs)
    });
    return { ...seeded, key };
}

const PAST_LIMIT = REFUND_CALL_RETRY_LIMIT_MS + 1;

const paymentState = async (paymentId: string) => {
    const [row] = await getDb()
        .select({ status: payments.status, refundedAmount: payments.refundedAmount })
        .from(payments)
        .where(eq(payments.id, paymentId));
    return row;
};

describe('HOS-2406 remainder settlement route', () => {
    beforeAll(async () => {
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        await testDb.setup();
        validateApiEnv();
        app = initApp({ clock: confirmClock, paymentProvider: confirmFake });
    });
    beforeEach(() => {
        // The settlement reads the charge from the provider the route resolves.
        injectPaymentProvider({ provider: confirmFake });
    });
    afterEach(() => {
        confirmClock.set(NOW);
        injectPaymentProvider({ provider: baselineFake });
        vi.restoreAllMocks();
        audit.mockClear();
    });
    afterAll(async () => {
        await cleanupConfirmRefundRows();
        await testDb.teardown();
    });

    it('closes the refund EXECUTED, squares the payment and audits like action 14', async () => {
        // Arrange
        const seeded = await seedPartiallyAccepted();
        const reference = await refundAtFake(seeded.chargeId, 2000);

        // Act
        const response = await settle({
            refundId: seeded.refundId,
            headers: admin(seeded.adminId),
            body: { amount: 2000, reference, note: 'refunded from the panel' }
        });

        // Assert
        expect(response.status).toBe(200);
        expect((await response.json()).data).toEqual({
            refundId: seeded.refundId,
            status: 'EXECUTED',
            acceptedAmount: 4000,
            remainderAmount: 2000,
            paymentOutcome: 'P4',
            coverageReleased: false
        });
        expect((await confirmRows(seeded.refundId)).refund).toMatchObject({
            status: 'EXECUTED',
            executedVia: 'EXTERNAL',
            externalChannel: 'PROVIDER_PANEL',
            externalRef: reference,
            settledBy: seeded.adminId
        });
        expect(await paymentState(seeded.paymentId)).toEqual({
            status: 'PARTIALLY_REFUNDED',
            refundedAmount: 6000
        });
        const mutations = audit.mock.calls.filter(
            ([entry]) => entry.auditEvent === AuditEventType.BILLING_MUTATION
        );
        expect(mutations).toEqual([
            [
                {
                    auditEvent: AuditEventType.BILLING_MUTATION,
                    actorId: seeded.adminId,
                    action: 'update',
                    resourceType: 'refund',
                    resourceId: seeded.refundId,
                    metadata: {
                        administrativeAction: 'ACC_14',
                        transition: 'RF3',
                        settlement: 'PARTIAL_REFUND_REMAINDER',
                        subjectId: seeded.ownerId,
                        acceptedAmount: 4000,
                        amount: 2000,
                        channel: 'PROVIDER_PANEL',
                        reference,
                        settledStaleCallKeys: [],
                        paymentOutcome: 'P4',
                        coverageReleased: false,
                        note: 'refunded from the panel'
                    }
                }
            ]
        ]);
    });

    it('answers 401 without a session and 403 without billing.settleExternal', async () => {
        // Arrange
        const seeded = await seedPartiallyAccepted();

        // Act
        const anonymous = await settle({
            refundId: seeded.refundId,
            headers: actorHeaders(undefined)
        });
        const forbidden = await settle({
            refundId: seeded.refundId,
            headers: admin(seeded.adminId, [
                PermissionEnum.ACCESS_PANEL_ADMIN,
                PermissionEnum.BILLING_REFUND
            ])
        });

        // Assert
        expect(anonymous.status).toBe(401);
        expect(forbidden.status).toBe(403);
        expect((await confirmRows(seeded.refundId)).refund?.status).toBe('CONFIRMED');
        expect(audit).not.toHaveBeenCalledWith(
            expect.objectContaining({ auditEvent: AuditEventType.BILLING_MUTATION })
        );
    });

    it.each([
        { amount: 0, reference: 'mp' },
        { amount: 2000, reference: '' },
        { amount: '2000', reference: 'mp' }
    ])('answers 400 for an invalid body %j', async (body) => {
        // Arrange
        const seeded = await seedPartiallyAccepted();

        // Act
        const response = await settle({
            refundId: seeded.refundId,
            headers: admin(seeded.adminId),
            body
        });

        // Assert
        expect(response.status).toBe(400);
        expect((await confirmRows(seeded.refundId)).refund?.status).toBe('CONFIRMED');
    });

    it('answers 404 REFUND_NOT_FOUND for an unknown refund', async () => {
        // Arrange
        const seeded = await seedPartiallyAccepted();

        // Act
        const response = await settle({
            refundId: crypto.randomUUID(),
            headers: admin(seeded.adminId)
        });

        // Assert
        expect(response.status).toBe(404);
        expect((await response.json()).error).toMatchObject({
            code: 'NOT_FOUND',
            reason: 'REFUND_NOT_FOUND'
        });
    });

    it('answers 422 REMAINDER_AMOUNT_MISMATCH when the remainder is not what is owed', async () => {
        // Arrange
        const seeded = await seedPartiallyAccepted();

        // Act
        const response = await settle({
            refundId: seeded.refundId,
            headers: admin(seeded.adminId),
            body: { amount: 6000, reference: `mp-${crypto.randomUUID()}` }
        });

        // Assert
        expect(response.status).toBe(422);
        expect((await response.json()).error).toMatchObject({
            code: 'VALIDATION_ERROR',
            reason: 'REMAINDER_AMOUNT_MISMATCH'
        });
        expect(await paymentState(seeded.paymentId)).toMatchObject({ refundedAmount: 0 });
    });

    it('answers 409 REFUND_CALL_UNANSWERED and 409 REFUND_NOT_CONFIRMED', async () => {
        // Arrange
        const unanswered = await seedPartiallyAccepted('UNANSWERED');
        const requested = await seedConfirmRefund(10000, 6000);

        // Act
        const first = await settle({
            refundId: unanswered.refundId,
            headers: admin(unanswered.adminId)
        });
        const second = await settle({
            refundId: requested.refundId,
            headers: admin(requested.adminId)
        });

        // Assert
        expect(first.status).toBe(409);
        expect((await first.json()).error).toMatchObject({
            code: 'ALREADY_EXISTS',
            reason: 'REFUND_CALL_UNANSWERED'
        });
        expect(second.status).toBe(409);
        expect((await second.json()).error).toMatchObject({
            code: 'ALREADY_EXISTS',
            reason: 'REFUND_NOT_CONFIRMED'
        });
    });

    it('answers 409 ACCEPTED_PART_NOT_ACCREDITED when the provider does not credit the accepted part', async () => {
        // Arrange
        const seeded = await seedPartiallyAccepted('PARTIAL', `mp-ghost-${crypto.randomUUID()}`);

        // Act
        const response = await settle({
            refundId: seeded.refundId,
            headers: admin(seeded.adminId),
            body: { amount: 2000, reference: await refundAtFake(seeded.chargeId, 2000) }
        });

        // Assert
        expect(response.status).toBe(409);
        expect((await response.json()).error).toMatchObject({
            code: 'ALREADY_EXISTS',
            reason: 'ACCEPTED_PART_NOT_ACCREDITED'
        });
        expect((await confirmRows(seeded.refundId)).refund?.status).toBe('CONFIRMED');
    });

    it('answers 422 REMAINDER_NOT_FOUND_AT_PROVIDER for a reference the provider does not credit', async () => {
        // Arrange
        const seeded = await seedPartiallyAccepted();

        // Act
        const response = await settle({
            refundId: seeded.refundId,
            headers: admin(seeded.adminId),
            body: { amount: 2000, reference: `mp-panel-${crypto.randomUUID()}` }
        });

        // Assert
        expect(response.status).toBe(422);
        expect((await response.json()).error).toMatchObject({
            code: 'VALIDATION_ERROR',
            reason: 'REMAINDER_NOT_FOUND_AT_PROVIDER'
        });
        expect(await paymentState(seeded.paymentId)).toMatchObject({ refundedAmount: 0 });
    });

    it('HOS-2538 closes a refund stuck on a call older than 24 hours and audits it', async () => {
        // Arrange
        const seeded = await seedStaleCall(6000, PAST_LIMIT);
        const reference = await refundAtFake(seeded.chargeId, 6000);

        // Act
        const response = await settle({
            refundId: seeded.refundId,
            headers: admin(seeded.adminId),
            body: { amount: 6000, reference }
        });

        // Assert
        expect(response.status).toBe(200);
        expect((await response.json()).data).toMatchObject({
            status: 'EXECUTED',
            acceptedAmount: 0,
            remainderAmount: 6000
        });
        const rows = await confirmRows(seeded.refundId);
        expect(rows.refund).toMatchObject({ status: 'EXECUTED', externalRef: reference });
        expect(audit.mock.calls.map(([entry]) => entry.metadata)).toContainEqual(
            expect.objectContaining({
                settlement: 'STALE_PROVIDER_CALL',
                settledStaleCallKeys: [seeded.key],
                amount: 6000
            })
        );
    });

    it('HOS-2538 answers 409 REFUND_CALL_UNANSWERED for a call inside the 24 hours', async () => {
        // Arrange: a second inside the limit (this clock ticks 1 ms on every read, so the exact
        // boundary is pinned by the service-core suite instead).
        const seeded = await seedStaleCall(6000, REFUND_CALL_RETRY_LIMIT_MS - 1000);

        // Act
        const response = await settle({
            refundId: seeded.refundId,
            headers: admin(seeded.adminId),
            body: { amount: 6000, reference: await refundAtFake(seeded.chargeId, 6000) }
        });

        // Assert
        expect(response.status).toBe(409);
        expect((await response.json()).error).toMatchObject({
            code: 'ALREADY_EXISTS',
            reason: 'REFUND_CALL_UNANSWERED'
        });
        expect((await confirmRows(seeded.refundId)).refund?.status).toBe('CONFIRMED');
    });

    it('HOS-2538 answers 409 UNCITED_PROVIDER_REFUND_ON_CHARGE when the lost call may have landed', async () => {
        // Arrange
        const seeded = await seedStaleCall(4000, PAST_LIMIT);
        await refundAtFake(seeded.chargeId, 4000);

        // Act
        const response = await settle({
            refundId: seeded.refundId,
            headers: admin(seeded.adminId),
            body: { amount: 4000, reference: await refundAtFake(seeded.chargeId, 4000) }
        });

        // Assert
        expect(response.status).toBe(409);
        expect((await response.json()).error).toMatchObject({
            code: 'ALREADY_EXISTS',
            reason: 'UNCITED_PROVIDER_REFUND_ON_CHARGE'
        });
        expect((await confirmRows(seeded.refundId)).refund?.status).toBe('CONFIRMED');
    });
});
