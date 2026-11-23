import type { PaymentProvider } from '@repo/payments';
import { PaymentProviderError } from '@repo/payments';
import { PermissionEnum, RoleEnum, StuckRefundListResponseSchema } from '@repo/schemas';
import { confirmRefund } from '@repo/service-core';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { injectPaymentProvider } from '../../../src/utils/payment-provider';
import { testDb } from '../../e2e/setup/test-database';
import { actorHeaders } from '../billing-subscription/revocation-route-fixtures';
import {
    baselineFake,
    cleanupConfirmRefundRows,
    confirmClock,
    confirmFake,
    seedConfirmRefund
} from './confirm-refund-fixtures';

const permissions = [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.BILLING_REFUND];
const PATH = '/api/v1/admin/billing-refunds/stuck';
let app: ReturnType<typeof initApp>;

const list = (headers: HeadersInit, query = '?page=1&pageSize=100') =>
    app.request(`${PATH}${query}`, { method: 'GET', headers });

/** The fake behind a proxy whose `refund` lands at the provider and then loses its answer. */
function lossyProvider(): PaymentProvider {
    return new Proxy(confirmFake as PaymentProvider, {
        get(target, property, receiver) {
            if (property === 'refund')
                return async (input: Parameters<PaymentProvider['refund']>[0]) => {
                    await confirmFake.refund(input);
                    throw new PaymentProviderError({
                        code: 'UNAVAILABLE',
                        capability: 'refund',
                        message: 'lost response'
                    });
                };
            return Reflect.get(target, property, receiver);
        }
    });
}

/** The ids of every listed refund, paging the whole list. */
async function listedIds(headers: HeadersInit): Promise<string[]> {
    const ids: string[] = [];
    for (let page = 1; page < 100; page++) {
        const response = await list(headers, `?page=${page}&pageSize=100`);
        const data = StuckRefundListResponseSchema.parse((await response.json()).data);
        ids.push(...data.items.map((item) => item.refundId));
        if (page >= data.pagination.totalPages) break;
    }
    return ids;
}

describe('HOS-2560 stuck refunds list route', () => {
    beforeAll(async () => {
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        await testDb.setup();
        validateApiEnv();
        app = initApp({ clock: confirmClock, paymentProvider: confirmFake });
    });
    afterEach(() => {
        injectPaymentProvider({ provider: baselineFake });
        vi.restoreAllMocks();
    });
    afterAll(async () => {
        await cleanupConfirmRefundRows();
        await testDb.teardown();
    });

    it('lists a confirmed refund whose provider call went unanswered, suggesting the retry', async () => {
        // Arrange
        const seeded = await seedConfirmRefund();
        const confirmed = await confirmRefund(
            {
                actor: { id: seeded.adminId, roles: [RoleEnum.ADMIN], permissions },
                refundId: seeded.refundId
            },
            { clock: confirmClock, provider: lossyProvider() }
        );
        expect(confirmed.outcome).toBe('AWAITING_PROVIDER_ANSWER');
        const headers = actorHeaders({ id: seeded.adminId, role: 'SUPER_ADMIN', permissions });

        // Act
        let item:
            | ReturnType<typeof StuckRefundListResponseSchema.parse>['items'][number]
            | undefined;
        for (let page = 1; page < 100 && !item; page++) {
            const response = await list(headers, `?page=${page}&pageSize=100`);
            expect(response.status).toBe(200);
            const data = StuckRefundListResponseSchema.parse((await response.json()).data);
            item = data.items.find((entry) => entry.refundId === seeded.refundId);
            if (page >= data.pagination.totalPages) break;
        }

        // Assert
        expect(item).toMatchObject({
            payment: { source: 'PAYMENT', id: seeded.paymentId },
            providerCallCount: 1,
            unansweredCallCount: 1,
            acceptedAmountMinor: 0,
            suggestedAction: 'RETRY'
        });
        expect(item?.oldestUnansweredAt).not.toBeNull();
    });

    it('leaves out a refund that is only requested', async () => {
        // Arrange
        const seeded = await seedConfirmRefund();

        // Act
        const ids = await listedIds(
            actorHeaders({ id: seeded.adminId, role: 'SUPER_ADMIN', permissions })
        );

        // Assert
        expect(ids).not.toContain(seeded.refundId);
    });

    it('answers 401 without a session', async () => {
        const response = await list(actorHeaders(undefined));
        expect(response.status).toBe(401);
    });

    it('answers 403 to an admin without billing.refund', async () => {
        const seeded = await seedConfirmRefund();
        const response = await list(
            actorHeaders({
                id: seeded.adminId,
                role: 'ADMIN',
                permissions: [
                    PermissionEnum.ACCESS_PANEL_ADMIN,
                    PermissionEnum.BILLING_SETTLE_EXTERNAL
                ]
            })
        );
        expect(response.status).toBe(403);
    });

    it('rejects a page size above the limit with 400', async () => {
        const seeded = await seedConfirmRefund();
        const response = await list(
            actorHeaders({ id: seeded.adminId, role: 'SUPER_ADMIN', permissions }),
            '?page=1&pageSize=101'
        );
        expect(response.status).toBe(400);
    });
});
