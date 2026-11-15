import { billingOptions, eq, subscriptions } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { afterAll, describe, expect, it } from 'vitest';
import {
    closeSuccessionWrites,
    createSuccessionCloser
} from '../../../src/services/billing/subscription/succession-closer.service';
import { closeSuccessionIfPredecessor } from '../../../src/services/billing/subscription/succession-end';
import type { ServiceError } from '../../../src/types';
import {
    closeServiceTestPool,
    isServiceTestDbAvailable,
    withServiceTestTransaction
} from './helpers';
import {
    closeNow,
    closePorts,
    readCloseCase,
    seedCloseCase
} from './support/succession-close-fixtures';

afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())('TEST:B8b:10 (a) monthly succession close', () => {
    it('moves links and complements, preserves promo, defers courtesy, and marks and releases S19 payment', async () => {
        await withServiceTestTransaction(async (tx) => {
            const ids = await seedCloseCase(tx, {
                complement: true,
                courtesy: true,
                promo: true,
                retention: 'OPEN'
            });
            const result = await closeSuccessionWrites(
                { predecessorSubscriptionId: ids.predecessor.id, tx },
                closePorts
            );
            const rows = await readCloseCase(tx, ids);
            expect(result).toEqual({
                outcome: 'CLOSED',
                successorId: ids.successor.id,
                complementsMoved: 1,
                courtesy: 'DEFERRED',
                marksOpened: 1
            });
            expect(rows.predecessor?.succeededById).toBe(ids.successor.id);
            expect(rows.successor?.succeedsId).toBeNull();
            expect(rows.addon?.targetId).toBe(ids.successor.id);
            expect(rows.redemption).toMatchObject({
                subscriptionId: ids.predecessor.id,
                remainingCharges: 2
            });
            expect(rows.grant).toMatchObject({
                subscriptionId: ids.predecessor.id,
                balanceMonths: 3,
                balanceClosedAt: null,
                closeReason: null
            });
            expect(rows.marks).toHaveLength(1);
            expect(rows.marks[0]).toMatchObject({
                subscriptionId: ids.predecessor.id,
                reason: 'REEMBOLSO_POR_CONFIRMAR',
                liftedAt: null
            });
            expect(rows.hung).toHaveLength(1);
            expect(rows.hung[0]).toMatchObject({ paymentId: ids.paymentId, resolvedAt: null });
            expect(rows.retention).toMatchObject({
                releasedAt: closeNow,
                releaseReason: 'SUCCESSION_CLOSED'
            });
        });
    });
});

describe.skipIf(!isServiceTestDbAvailable())('TEST:B8b:10 (b) nonmonthly successor', () => {
    it('closes the predecessor courtesy balance with the catalog reason', async () => {
        await withServiceTestTransaction(async (tx) => {
            const ids = await seedCloseCase(tx, { successorCycle: 'annual', courtesy: true });
            const result = await closeSuccessionWrites(
                { predecessorSubscriptionId: ids.predecessor.id, tx },
                closePorts
            );
            const rows = await readCloseCase(tx, ids);
            expect(result).toEqual({
                outcome: 'CLOSED',
                successorId: ids.successor.id,
                complementsMoved: 0,
                courtesy: 'CLOSED_NON_MONTHLY',
                marksOpened: 0
            });
            expect(rows.grant).toMatchObject({
                subscriptionId: ids.predecessor.id,
                balanceMonths: 3,
                balanceClosedAt: closeNow,
                closeReason: 'DESTINO_DE_PLAN_NO_MENSUAL'
            });
        });
    });
});

describe.skipIf(!isServiceTestDbAvailable())('TEST:B8b:10 (d) S36 released retention', () => {
    it('leaves the RF1 released retention and mark count unchanged', async () => {
        await withServiceTestTransaction(async (tx) => {
            const ids = await seedCloseCase(tx, { retention: 'RELEASED' });
            const before = await readCloseCase(tx, ids);
            const result = await closeSuccessionWrites(
                { predecessorSubscriptionId: ids.predecessor.id, tx },
                closePorts
            );
            const after = await readCloseCase(tx, ids);
            expect(result.marksOpened).toBe(0);
            expect(after.marks).toHaveLength(before.marks.length);
            expect(after.retention).toMatchObject({
                releasedAt: closeNow,
                releaseReason: 'REVOCATION_REFUNDED'
            });
        });
    });
});

describe.skipIf(!isServiceTestDbAvailable())('TEST:B8b:10 (e) live predecessor D-1', () => {
    it('writes nothing before predecessor cancellation', async () => {
        await withServiceTestTransaction(async (tx) => {
            const ids = await seedCloseCase(tx, {
                predecessorStatus: 'ACTIVE',
                complement: true,
                courtesy: true
            });
            const before = await readCloseCase(tx, ids);
            const result = await closeSuccessionWrites(
                { predecessorSubscriptionId: ids.predecessor.id, tx },
                closePorts
            );
            const after = await readCloseCase(tx, ids);
            expect(result).toEqual({
                outcome: 'PREDECESSOR_STILL_LIVE',
                successorId: ids.successor.id,
                complementsMoved: 0,
                courtesy: 'NONE',
                marksOpened: 0
            });
            expect(after.predecessor?.succeededById).toBe(before.predecessor?.succeededById);
            expect(after.successor?.succeedsId).toBe(ids.predecessor.id);
            expect(after.addon?.targetId).toBe(ids.predecessor.id);
            expect(after.grant).toMatchObject({
                balanceMonths: null,
                balanceClosedAt: null,
                closeReason: null
            });
        });
    });
});

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B8b:10 (f) predecessor died before authorization',
    () => {
        it('makes the pending successor the unique commitment origin', async () => {
            await withServiceTestTransaction(async (tx) => {
                const ids = await seedCloseCase(tx, {
                    predecessorStatus: 'CHARGE_DECLINED',
                    successorStatus: 'PENDING_AUTHORIZATION'
                });
                const result = await closeSuccessionWrites(
                    { predecessorSubscriptionId: ids.predecessor.id, tx },
                    closePorts
                );
                const rows = await readCloseCase(tx, ids);
                expect(result.outcome).toBe('CLOSED');
                expect(rows.successor?.succeedsId).toBeNull();
                const [option] = await tx
                    .select({ id: billingOptions.id })
                    .from(billingOptions)
                    .where(eq(billingOptions.id, ids.successor.billingOptionId!));
                expect(option?.id).toBe(ids.successor.billingOptionId);
                await expect(
                    tx.transaction(async (savepoint) => {
                        await savepoint.insert(subscriptions).values({
                            userId: ids.userId,
                            vertical: 'accommodation',
                            planVersionId: ids.successor.planVersionId,
                            billingOptionId: ids.successor.billingOptionId,
                            paymentMethod: 'CARD',
                            class: 'PRINCIPAL',
                            status: 'ACTIVE'
                        });
                    })
                ).rejects.toMatchObject({
                    cause: { code: '23505', constraint: 'uq_subscription_commitment_origin' }
                });
            });
        });
    }
);

describe.skipIf(!isServiceTestDbAvailable())('TEST:B8b:10 (g) idempotent close', () => {
    it('does not open another mark on a second call', async () => {
        await withServiceTestTransaction(async (tx) => {
            const ids = await seedCloseCase(tx, {
                complement: true,
                courtesy: true,
                retention: 'OPEN'
            });
            await closeSuccessionWrites(
                { predecessorSubscriptionId: ids.predecessor.id, tx },
                closePorts
            );
            const second = await closeSuccessionWrites(
                { predecessorSubscriptionId: ids.predecessor.id, tx },
                closePorts
            );
            const rows = await readCloseCase(tx, ids);
            expect(second).toEqual({
                outcome: 'NO_LIVE_SUCCESSOR',
                successorId: null,
                complementsMoved: 0,
                courtesy: 'NONE',
                marksOpened: 0
            });
            expect(rows.marks).toHaveLength(1);
            expect(rows.addon?.targetId).toBe(ids.successor.id);
            expect(rows.grant).toMatchObject({
                balanceMonths: 3,
                balanceClosedAt: null,
                closeReason: null
            });
        });
    });
});

describe.skipIf(!isServiceTestDbAvailable())('TEST:B8b:10 (h) SuccessionCloser interface', () => {
    it('closes through the B7 caller in its transaction', async () => {
        await withServiceTestTransaction(async (tx) => {
            const ids = await seedCloseCase(tx, {
                complement: true,
                courtesy: true,
                retention: 'OPEN'
            });
            const result = await closeSuccessionIfPredecessor(
                { predecessorSubscriptionId: ids.predecessor.id, tx },
                { successionCloser: createSuccessionCloser(closePorts) }
            );
            const rows = await readCloseCase(tx, ids);
            expect(result).toEqual({ called: true });
            expect(rows.successor?.succeedsId).toBeNull();
            expect(rows.addon?.targetId).toBe(ids.successor.id);
            expect(rows.grant?.balanceMonths).toBe(3);
            expect(rows.marks).toHaveLength(1);
        });
    });
});

describe.skipIf(!isServiceTestDbAvailable())('TEST:B8b:10 (i) caller rollback', () => {
    it('rolls back the caller write on an unsupported live successor status', async () => {
        await withServiceTestTransaction(async (tx) => {
            const ids = await seedCloseCase(tx, { successorStatus: 'GRACE_PERIOD' });
            await expect(
                tx.transaction(async (savepoint) => {
                    await savepoint
                        .update(subscriptions)
                        .set({ serviceEndsAt: closeNow })
                        .where(eq(subscriptions.id, ids.predecessor.id));
                    await closeSuccessionWrites(
                        { predecessorSubscriptionId: ids.predecessor.id, tx: savepoint },
                        closePorts
                    );
                })
            ).rejects.toMatchObject({
                code: ServiceErrorCode.INTERNAL_ERROR,
                reason: 'SUCCESSION_CLOSE_SUCCESSOR_STATE'
            } satisfies Partial<ServiceError>);
            const rows = await readCloseCase(tx, ids);
            expect(rows.predecessor?.serviceEndsAt).toBeNull();
            expect(rows.successor?.succeedsId).toBe(ids.predecessor.id);
        });
    });
});
