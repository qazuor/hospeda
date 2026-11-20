import { eq, getDb, payments } from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { PaymentProviderError } from '@repo/payments';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { confirmRefund } from '@repo/service-core';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { AuditEventType } from '../../../src/utils/audit-logger';
import { validateApiEnv } from '../../../src/utils/env';
import { injectPaymentProvider } from '../../../src/utils/payment-provider';
import { testDb } from '../../e2e/setup/test-database';
import { actorHeaders } from '../billing-subscription/revocation-route-fixtures';
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

const permissions = [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.BILLING_REFUND];
let app: ReturnType<typeof initApp>;

/** The fake behind a proxy that loses the answer of its first `refund` call, after it lands. */
function lossyFake() {
    const refund = vi.fn(confirmFake.refund.bind(confirmFake));
    let lost = false;
    const provider = new Proxy(confirmFake as PaymentProvider, {
        get(target, property, receiver) {
            if (property === 'refund')
                return async (input: Parameters<PaymentProvider['refund']>[0]) => {
                    const answer = await refund(input);
                    if (!lost) {
                        lost = true;
                        throw new PaymentProviderError({
                            code: 'UNAVAILABLE',
                            capability: 'refund',
                            message: 'lost response'
                        });
                    }
                    return answer;
                };
            return Reflect.get(target, property, receiver);
        }
    });
    return { provider, refund };
}

/** A CONFIRMED refund whose only provider call went unanswered. */
async function seedStuckRefund() {
    const seeded = await seedConfirmRefund();
    const lossy = lossyFake();
    const confirmed = await confirmRefund(
        {
            actor: { id: seeded.adminId, roles: [RoleEnum.ADMIN], permissions },
            refundId: seeded.refundId
        },
        { clock: confirmClock, provider: lossy.provider }
    );
    expect(confirmed.outcome).toBe('AWAITING_PROVIDER_ANSWER');
    return { seeded, lossy };
}

async function retryRequest(input: {
    readonly refundId: string;
    readonly provider: PaymentProvider;
    readonly actor?: { id: string; role: string; permissions: readonly PermissionEnum[] };
    readonly body?: unknown;
}): Promise<Response> {
    injectPaymentProvider({ provider: input.provider });
    return await app.request(
        `/api/v1/admin/billing-refunds/${input.refundId}/retry-provider-calls`,
        {
            method: 'POST',
            headers: actorHeaders(input.actor),
            body: JSON.stringify(input.body ?? { confirmed: true })
        }
    );
}

describe('HOS-2516 admin route retries the unanswered provider calls of a refund', () => {
    beforeAll(async () => {
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        await testDb.setup();
        validateApiEnv();
        app = initApp({ clock: confirmClock, paymentProvider: confirmFake });
    });
    afterEach(() => {
        injectPaymentProvider({ provider: baselineFake });
        audit.mockClear();
        vi.restoreAllMocks();
    });
    afterAll(async () => {
        await cleanupConfirmRefundRows();
        await testDb.teardown();
    });

    it('resends with the same key, executes the accredited refund and audits it', async () => {
        // Arrange
        const { seeded, lossy } = await seedStuckRefund();
        const key = (await confirmRows(seeded.refundId)).calls[0]!.idempotencyKey;

        // Act
        const response = await retryRequest({
            refundId: seeded.refundId,
            provider: lossy.provider,
            actor: { id: seeded.adminId, role: 'SUPER_ADMIN', permissions }
        });

        // Assert
        expect(response.status).toBe(200);
        expect((await response.json()).data).toEqual({
            refundId: seeded.refundId,
            status: 'EXECUTED',
            calls: [{ idempotencyKey: key, outcome: 'SENT' }],
            execution: 'EXECUTED'
        });
        expect(lossy.refund).toHaveBeenLastCalledWith(expect.objectContaining({ reference: key }));
        expect((await confirmRows(seeded.refundId)).refund?.status).toBe('EXECUTED');
        expect(audit).toHaveBeenCalledWith(
            expect.objectContaining({
                auditEvent: AuditEventType.BILLING_MUTATION,
                actorId: seeded.adminId,
                resourceType: 'refund',
                resourceId: seeded.refundId,
                metadata: expect.objectContaining({
                    administrativeAction: 'ACC_13',
                    operation: 'RETRY_PROVIDER_CALLS',
                    transition: 'RF3',
                    status: 'EXECUTED',
                    execution: 'EXECUTED',
                    calls: [{ idempotencyKey: key, outcome: 'SENT' }]
                })
            })
        );
    });

    it('answers 401 without a session and sends nothing', async () => {
        const { seeded, lossy } = await seedStuckRefund();
        const response = await retryRequest({
            refundId: seeded.refundId,
            provider: lossy.provider
        });
        expect(response.status).toBe(401);
        expect(lossy.refund).toHaveBeenCalledTimes(1);
    });

    it('answers 403 without billing.refund before reading the body', async () => {
        const { seeded, lossy } = await seedStuckRefund();
        const response = await retryRequest({
            refundId: seeded.refundId,
            provider: lossy.provider,
            actor: {
                id: seeded.adminId,
                role: 'ADMIN',
                permissions: [PermissionEnum.ACCESS_PANEL_ADMIN]
            },
            body: {}
        });
        expect(response.status).toBe(403);
        expect(lossy.refund).toHaveBeenCalledTimes(1);
    });

    it('answers 400 to a body without the explicit confirmation', async () => {
        const { seeded, lossy } = await seedStuckRefund();
        const response = await retryRequest({
            refundId: seeded.refundId,
            provider: lossy.provider,
            actor: { id: seeded.adminId, role: 'SUPER_ADMIN', permissions },
            body: { confirmed: false }
        });
        expect(response.status).toBe(400);
        expect(lossy.refund).toHaveBeenCalledTimes(1);
    });

    it('answers 404 REFUND_NOT_FOUND to an unknown refund', async () => {
        const seeded = await seedConfirmRefund();
        const response = await retryRequest({
            refundId: crypto.randomUUID(),
            provider: confirmFake,
            actor: { id: seeded.adminId, role: 'SUPER_ADMIN', permissions }
        });
        expect(response.status).toBe(404);
        expect((await response.json()).error).toMatchObject({
            code: 'NOT_FOUND',
            reason: 'REFUND_NOT_FOUND'
        });
    });

    it('answers 403 ADMINISTRATIVE_ACTION_FORBIDDEN to the payer retrying their own refund', async () => {
        const { seeded, lossy } = await seedStuckRefund();
        const response = await retryRequest({
            refundId: seeded.refundId,
            provider: lossy.provider,
            actor: { id: seeded.ownerId, role: 'ADMIN', permissions }
        });
        expect(response.status).toBe(403);
        expect((await response.json()).error).toMatchObject({
            code: 'FORBIDDEN',
            reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN'
        });
        expect(lossy.refund).toHaveBeenCalledTimes(1);
    });

    it('answers 409 REFUND_NOT_CONFIRMED to a REQUESTED refund', async () => {
        const seeded = await seedConfirmRefund();
        const response = await retryRequest({
            refundId: seeded.refundId,
            provider: confirmFake,
            actor: { id: seeded.adminId, role: 'SUPER_ADMIN', permissions }
        });
        expect(response.status).toBe(409);
        expect((await response.json()).error).toMatchObject({
            code: 'ALREADY_EXISTS',
            reason: 'REFUND_NOT_CONFIRMED'
        });
    });

    it('answers 409 REFUND_HAS_NO_UNANSWERED_CALL to a CONFIRMED refund whose call was answered', async () => {
        // Arrange: a clean confirmation answers its only call and stays CONFIRMED until RF3.
        const seeded = await seedConfirmRefund();
        await confirmRefund(
            {
                actor: { id: seeded.adminId, roles: [RoleEnum.ADMIN], permissions },
                refundId: seeded.refundId
            },
            { clock: confirmClock, provider: confirmFake }
        );
        const refundSpy = vi.spyOn(confirmFake, 'refund');

        // Act
        const response = await retryRequest({
            refundId: seeded.refundId,
            provider: confirmFake,
            actor: { id: seeded.adminId, role: 'SUPER_ADMIN', permissions }
        });

        // Assert
        expect(response.status).toBe(409);
        expect((await response.json()).error).toMatchObject({
            code: 'ALREADY_EXISTS',
            reason: 'REFUND_HAS_NO_UNANSWERED_CALL'
        });
        expect(refundSpy).not.toHaveBeenCalled();
        expect((await confirmRows(seeded.refundId)).refund?.status).toBe('CONFIRMED');
    });

    it('answers 422 REFUND_PAST_PROVIDER_WINDOW and leaves the call unanswered', async () => {
        const { seeded, lossy } = await seedStuckRefund();
        await getDb()
            .update(payments)
            .set({ factAt: new Date(confirmClock.now().getTime() - 181 * 86400000) })
            .where(eq(payments.id, seeded.paymentId));
        const response = await retryRequest({
            refundId: seeded.refundId,
            provider: lossy.provider,
            actor: { id: seeded.adminId, role: 'SUPER_ADMIN', permissions }
        });
        expect(response.status).toBe(422);
        expect((await response.json()).error).toMatchObject({
            code: 'VALIDATION_ERROR',
            reason: 'REFUND_PAST_PROVIDER_WINDOW'
        });
        expect(lossy.refund).toHaveBeenCalledTimes(1);
        expect((await confirmRows(seeded.refundId)).keys[0]?.completedAt).toBeNull();
    });
});
