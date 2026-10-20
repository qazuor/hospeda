/**
 * HOS-1678 (Coord-351, owner option a), admin action 8 with reason revocation through its
 * route: an open or executed refund that already claims the whole revoked payment blocks the
 * revocation entirely (fail closed, nothing moves). The panel screen rests on this premise: it
 * shows the block from the PREVIEW and never offers to confirm, so the preview itself must
 * answer `REFUND_EXCEEDS_BALANCE` with a PENDING (`REQUESTED`) refund open, not only the act.
 * A partial open refund leaves the rest: the preview's `payment.amount` is what is left (H5).
 *
 * Seeds its own rows with random ids and retires only them; never TRUNCATE.
 */
import { getDb, refunds } from '@repo/db';
import { SubscriptionRevocationPreviewResponseSchema } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { AuditEventType } from '../../../src/utils/audit-logger';
import { validateApiEnv } from '../../../src/utils/env';
import { injectPaymentProvider } from '../../../src/utils/payment-provider';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
    NOW,
    OPTION_AMOUNT,
    REVOKER_PERMISSIONS,
    retireRevocationRouteRows,
    revocationWrites,
    routeClock,
    routeFake,
    seedRevocable,
    seedUser
} from './revocation-route-fixtures';

const audit = vi.hoisted(() => vi.fn());
vi.mock('../../../src/utils/audit-logger', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    auditLog: audit
}));

const clock = routeClock();
const fake = routeFake(clock);
let app: ReturnType<typeof initApp>;
let revokerId: string;

const pathOf = (subscriptionId: string) =>
    `/api/v1/admin/billing-subscription/${subscriptionId}/revocation`;

function asRevoker() {
    return actorHeaders({ id: revokerId, role: 'SUPER_ADMIN', permissions: REVOKER_PERMISSIONS });
}

function preview(subscriptionId: string) {
    return app.request(pathOf(subscriptionId), { method: 'GET', headers: asRevoker() });
}

function revoke(subscriptionId: string, body: Record<string, unknown>) {
    return app.request(pathOf(subscriptionId), {
        method: 'POST',
        headers: asRevoker(),
        body: JSON.stringify(body)
    });
}

/** A refund over the seeded payment, as `subscription-revocation-guards.test.ts` (k2)/(k3). */
async function seedRefund(input: {
    readonly paymentId: string;
    readonly amount: number;
    readonly status: 'REQUESTED' | 'CONFIRMED';
}): Promise<void> {
    await getDb().insert(refunds).values({
        paymentId: input.paymentId,
        amount: input.amount,
        reason: 'REVOCATION',
        status: input.status
    });
}

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
    app = initApp({ clock, paymentProvider: fake });
    revokerId = await seedUser('revoker');
});
beforeEach(() => {
    audit.mockClear();
    clock.set(NOW);
    injectPaymentProvider({ provider: fake });
});
afterEach(async () => {
    await retireRevocationRouteRows();
});
afterAll(async () => {
    await retireRevocationRouteRows();
    await testDb.teardown();
});

describe('HOS-1678 Coord-351 an open refund for the whole payment blocks the revocation', () => {
    for (const status of ['REQUESTED', 'CONFIRMED'] as const) {
        it(`(${status === 'REQUESTED' ? 'a' : 'b'}) a ${status} refund for the total: preview and act answer 422 REFUND_EXCEEDS_BALANCE and nothing moves`, async () => {
            // Arrange
            const seeded = await seedRevocable();
            await seedRefund({ paymentId: seeded.paymentId, amount: OPTION_AMOUNT, status });
            const before = await revocationWrites(seeded);
            expect(before.row?.status).toBe('ACTIVE');
            expect(before.refunds).toHaveLength(1);

            // Act
            const shown = await preview(seeded.subscriptionId);
            const acted = await revoke(seeded.subscriptionId, {
                expectedPaymentId: seeded.paymentId
            });

            // Assert
            expect(shown.status).toBe(422);
            expect((await shown.json()).error.reason).toBe('REFUND_EXCEEDS_BALANCE');
            expect(acted.status).toBe(422);
            expect((await acted.json()).error.reason).toBe('REFUND_EXCEEDS_BALANCE');
            const after = await revocationWrites(seeded);
            expect(after).toEqual(before);
            expect(after.row?.status).toBe('ACTIVE');
            expect(after.refunds).toHaveLength(1);
            expect(after.outbox).toBe(0);
            expect(after.decisions).toBe(0);
            expect(audit).not.toHaveBeenCalledWith(
                expect.objectContaining({ auditEvent: AuditEventType.BILLING_MUTATION })
            );
        });
    }

    it('(c) a REQUESTED partial refund of 4000: the preview shows only what is left', async () => {
        // Arrange
        const seeded = await seedRevocable();
        await seedRefund({ paymentId: seeded.paymentId, amount: 4000, status: 'REQUESTED' });
        const before = await revocationWrites(seeded);

        // Act
        const response = await preview(seeded.subscriptionId);

        // Assert
        expect(response.status).toBe(200);
        const body = SubscriptionRevocationPreviewResponseSchema.parse(
            (await response.json()).data
        );
        expect(body.payment.id).toBe(seeded.paymentId);
        expect(body.payment.amount).toBe(OPTION_AMOUNT - 4000);
        expect(await revocationWrites(seeded)).toEqual(before);
    });
});
