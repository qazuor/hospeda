import {
    courtesyGrants,
    coverageLosses,
    domainEvent,
    eq,
    manualPayments,
    providerLinks,
    subscriptions
} from '@repo/db';
import { afterAll, describe, expect, it } from 'vitest';
import { completeSuccessorCut } from '../../../src/services/billing/subscription/successor-cut-after-commit';
import { createSuccessorCutter } from '../../../src/services/billing/subscription/successor-cutter';
import {
    closeServiceTestPool,
    getServiceTestDb,
    isServiceTestDbAvailable,
    withServiceTestTransaction
} from './helpers';
import { readInstance } from './support/addon-orphan-fixtures';
import { readCloseCase } from './support/succession-close-fixtures';
import { cutNow, seedSuccessorCutCase, successorCutPorts } from './support/successor-cut-fixtures';

afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())('TEST:B8b:13 S31 successor cut', () => {
    it('(a) abandons a pending successor and preserves both succession links', async () => {
        await withServiceTestTransaction(async (tx) => {
            const ids = await seedSuccessorCutCase(tx, {
                predecessorStatus: 'SUSPENDED',
                successorStatus: 'PENDING_AUTHORIZATION'
            });
            const result = await createSuccessorCutter(successorCutPorts(tx)).cutSuccessor({
                predecessorSubscriptionId: ids.predecessor.id,
                tx
            });
            const [pred] = await tx
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, ids.predecessor.id));
            const [succ] = await tx
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, ids.successor.id));
            expect(result).toMatchObject({
                outcome: 'CUT',
                from: 'PENDING_AUTHORIZATION',
                to: 'ABANDONED',
                cancellationDecided: false
            });
            expect(pred).toMatchObject({ status: 'SUSPENDED', succeededById: ids.successor.id });
            expect(succ).toMatchObject({ status: 'ABANDONED', succeedsId: ids.predecessor.id });
        });
    });

    it('(b) cancels an active successor and records coverage loss when no source remains', async () => {
        await withServiceTestTransaction(async (tx) => {
            const ids = await seedSuccessorCutCase(tx, {
                predecessorStatus: 'CANCELLED',
                successorStatus: 'ACTIVE'
            });
            const result = await createSuccessorCutter(successorCutPorts(tx)).cutSuccessor({
                predecessorSubscriptionId: ids.predecessor.id,
                tx
            });
            const losses = await tx
                .select()
                .from(coverageLosses)
                .where(eq(coverageLosses.userId, ids.userId));
            expect(result).toMatchObject({ outcome: 'CUT', from: 'ACTIVE', to: 'CANCELLED' });
            expect(
                losses.some(
                    (row) =>
                        row.vertical === 'accommodation' &&
                        row.lostAt.getTime() === cutNow.getTime()
                )
            ).toBe(true);
        });
    });

    it('(c) cuts pending successors for S12 while a S6 predecessor remains as seeded', async () => {
        await withServiceTestTransaction(async (tx) => {
            const ids = await seedSuccessorCutCase(tx, {
                predecessorStatus: 'CANCELLED',
                successorStatus: 'PENDING_AUTHORIZATION'
            });
            const result = await createSuccessorCutter(successorCutPorts(tx)).cutSuccessor({
                predecessorSubscriptionId: ids.predecessor.id,
                tx
            });
            expect(result).toMatchObject({ outcome: 'CUT', to: 'ABANDONED' });
        });
    });

    it('(c) runs A5 against predecessor complements only after the predecessor has left live states', async () => {
        await withServiceTestTransaction(async (tx) => {
            const s6 = await seedSuccessorCutCase(tx, {
                predecessorStatus: 'SUSPENDED',
                successorStatus: 'PENDING_AUTHORIZATION',
                complement: true
            });
            await createSuccessorCutter(successorCutPorts(tx)).cutSuccessor({
                predecessorSubscriptionId: s6.predecessor.id,
                tx
            });
            expect(await readInstance(tx, s6.addonId!)).toMatchObject({ status: 'ACTIVE' });
            const s12 = await seedSuccessorCutCase(tx, {
                predecessorStatus: 'CANCELLED',
                successorStatus: 'PENDING_AUTHORIZATION',
                complement: true
            });
            const s12Result = await createSuccessorCutter(successorCutPorts(tx)).cutSuccessor({
                predecessorSubscriptionId: s12.predecessor.id,
                tx
            });
            expect(await readInstance(tx, s12.addonId!)).toMatchObject({ status: 'CANCELLED' });
            expect(s12Result).toMatchObject({
                outcome: 'CUT',
                cancelledAddons: [{ clause: 'ORPHANED' }]
            });
        });
    });

    it('(d) closes the first manual installment and leaves active manual installments untouched', async () => {
        await withServiceTestTransaction(async (tx) => {
            const pending = await seedSuccessorCutCase(tx, {
                predecessorStatus: 'SUSPENDED',
                successorStatus: 'PENDING_AUTHORIZATION',
                paymentMethod: 'MANUAL'
            });
            const pendingResult = await createSuccessorCutter(successorCutPorts(tx)).cutSuccessor({
                predecessorSubscriptionId: pending.predecessor.id,
                tx
            });
            const [closed] = await tx
                .select()
                .from(manualPayments)
                .where(eq(manualPayments.subscriptionId, pending.successor.id));
            expect(pendingResult).toMatchObject({
                manualInstallmentClosed: true,
                cancellationDecided: false
            });
            expect(closed?.status).toBe('DECLARED_UNPAID');
            const active = await seedSuccessorCutCase(tx, {
                predecessorStatus: 'CANCELLED',
                successorStatus: 'ACTIVE',
                paymentMethod: 'MANUAL'
            });
            await tx.insert(manualPayments).values({
                subscriptionId: active.successor.id,
                periodStart: cutNow,
                status: 'AWAITING',
                entry: 'INSTALLMENT'
            });
            await createSuccessorCutter(successorCutPorts(tx)).cutSuccessor({
                predecessorSubscriptionId: active.predecessor.id,
                tx
            });
            const [untouched] = await tx
                .select()
                .from(manualPayments)
                .where(eq(manualPayments.subscriptionId, active.successor.id));
            expect(untouched?.status).toBe('AWAITING');
        });
    });

    it('(e) closes only an open deferred courtesy balance with the chargeback reason', async () => {
        await withServiceTestTransaction(async (tx) => {
            const ids = await seedSuccessorCutCase(tx, {
                predecessorStatus: 'SUSPENDED',
                successorStatus: 'PENDING_AUTHORIZATION',
                courtesy: true
            });
            await tx
                .update(courtesyGrants)
                .set({ balanceMonths: 2 })
                .where(eq(courtesyGrants.id, ids.grantId!));
            const result = await createSuccessorCutter(successorCutPorts(tx)).cutSuccessor({
                predecessorSubscriptionId: ids.predecessor.id,
                tx
            });
            const [grant] = await tx
                .select()
                .from(courtesyGrants)
                .where(eq(courtesyGrants.id, ids.grantId!));
            expect(result).toMatchObject({ closedCourtesyMonths: 2 });
            expect(grant).toMatchObject({
                balanceMonths: 2,
                balanceClosedAt: cutNow,
                closeReason: 'CONTRACARGO_DE_LA_PREDECESORA'
            });
        });
    });

    it('(h) returns NO_LIVE_SUCCESSOR when the only successor is already cancelled', async () => {
        await withServiceTestTransaction(async (tx) => {
            const ids = await seedSuccessorCutCase(tx, {
                predecessorStatus: 'CANCELLED',
                successorStatus: 'CANCELLED'
            });
            const result = await createSuccessorCutter(successorCutPorts(tx)).cutSuccessor({
                predecessorSubscriptionId: ids.predecessor.id,
                tx
            });
            expect(result).toEqual({ outcome: 'NO_LIVE_SUCCESSOR' });
        });
    });

    it('(f) records one S31 provider cancellation decision for a linked card successor', async () => {
        await withServiceTestTransaction(async (tx) => {
            const ids = await seedSuccessorCutCase(tx, {
                predecessorStatus: 'SUSPENDED',
                successorStatus: 'PENDING_AUTHORIZATION'
            });
            await tx.insert(providerLinks).values({
                subscriptionId: ids.successor.id,
                provider: 'fake',
                providerId: `successor-cut-${crypto.randomUUID()}`
            });
            const cutter = createSuccessorCutter(successorCutPorts(tx));
            const first = await cutter.cutSuccessor({
                predecessorSubscriptionId: ids.predecessor.id,
                tx
            });
            const second = await cutter.cutSuccessor({
                predecessorSubscriptionId: ids.predecessor.id,
                tx
            });
            expect(first).toMatchObject({
                outcome: 'CUT',
                cancellationDecided: true,
                from: 'PENDING_AUTHORIZATION',
                to: 'ABANDONED'
            });
            expect(second).toEqual({ outcome: 'NO_LIVE_SUCCESSOR' });
            const decisions = await tx
                .select()
                .from(domainEvent)
                .where(eq(domainEvent.entityId, ids.successor.id));
            expect(
                decisions.filter(
                    (event) =>
                        event.eventType === 'subscription.provider_cancellation_decided' &&
                        event.reason === 'S31'
                )
            ).toHaveLength(1);
        });
    });

    it('(g) preserves promo redemption, successor complement and the predecessor S19 retention', async () => {
        await withServiceTestTransaction(async (tx) => {
            const ids = await seedSuccessorCutCase(tx, {
                predecessorStatus: 'SUSPENDED',
                successorStatus: 'PENDING_AUTHORIZATION',
                promo: true,
                retention: 'OPEN',
                complement: true
            });
            const before = await readCloseCase(tx, ids);
            await createSuccessorCutter(successorCutPorts(tx)).cutSuccessor({
                predecessorSubscriptionId: ids.predecessor.id,
                tx
            });
            const after = await readCloseCase(tx, ids);
            expect(after.redemption).toMatchObject({
                subscriptionId: ids.predecessor.id,
                remainingCharges: 2
            });
            expect(after.addon?.targetId).toBe(ids.predecessor.id);
            expect(after.retention).toMatchObject({
                releasedAt: before.retention?.releasedAt ?? null,
                releaseReason: null
            });
            expect(after.hung).toEqual(before.hung);
        });
    });

    it('(i) rejects an undeclared live state and leaves the caller transaction available to roll back', async () => {
        await withServiceTestTransaction(async (tx) => {
            const ids = await seedSuccessorCutCase(tx, {
                predecessorStatus: 'SUSPENDED',
                successorStatus: 'GRACE_PERIOD'
            });
            await expect(
                createSuccessorCutter(successorCutPorts(tx)).cutSuccessor({
                    predecessorSubscriptionId: ids.predecessor.id,
                    tx
                })
            ).rejects.toMatchObject({ reason: 'SUCCESSOR_CUT_UNSUPPORTED_STATE' });
        });
    });

    it('(j) writes no state outside the caller transaction when it rolls back', async () => {
        const idsHolder: { id?: string; userId?: string } = {};
        try {
            await getServiceTestDb().transaction(async (tx) => {
                const ids = await seedSuccessorCutCase(tx, {
                    predecessorStatus: 'SUSPENDED',
                    successorStatus: 'PENDING_AUTHORIZATION'
                });
                idsHolder.id = ids.successor.id;
                idsHolder.userId = ids.userId;
                await createSuccessorCutter(successorCutPorts(tx)).cutSuccessor({
                    predecessorSubscriptionId: ids.predecessor.id,
                    tx
                });
                throw new Error('force caller rollback');
            });
        } catch (error) {
            expect(error).toMatchObject({ message: 'force caller rollback' });
        }
        expect(idsHolder.id).toBeDefined();
        const rows = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, idsHolder.id!));
        expect(rows).toHaveLength(0);
    });
});

describe.skipIf(!isServiceTestDbAvailable())('TEST:B8b:13 S31 after commit notices', () => {
    it('emits REMOVED only for active cuts and swallows notice delivery failures', async () => {
        const events: unknown[] = [];
        await expect(
            completeSuccessorCut(
                {
                    outcome: 'CUT',
                    successorId: crypto.randomUUID(),
                    predecessorId: crypto.randomUUID(),
                    from: 'ACTIVE',
                    to: 'CANCELLED',
                    userId: crypto.randomUUID(),
                    vertical: 'accommodation',
                    paymentMethod: 'CARD',
                    authorizationId: null,
                    closedCourtesyMonths: null,
                    manualInstallmentClosed: false,
                    cancelledAddons: [],
                    cancellationDecided: false
                },
                {
                    coverageNotices: {
                        emitCoverageChanged: async (event) => {
                            events.push(event);
                            throw new Error('notice down');
                        }
                    }
                }
            )
        ).resolves.toBeUndefined();
        expect(events).toEqual([
            {
                userId: expect.any(String),
                vertical: 'accommodation',
                sourceType: 'SUBSCRIPTION',
                change: 'REMOVED'
            }
        ]);
    });

    it('does not emit a subscription removal for an abandoned pending authorization', async () => {
        const events: unknown[] = [];
        await completeSuccessorCut(
            {
                outcome: 'CUT',
                successorId: crypto.randomUUID(),
                predecessorId: crypto.randomUUID(),
                from: 'PENDING_AUTHORIZATION',
                to: 'ABANDONED',
                userId: crypto.randomUUID(),
                vertical: 'accommodation',
                paymentMethod: 'CARD',
                authorizationId: null,
                closedCourtesyMonths: null,
                manualInstallmentClosed: false,
                cancelledAddons: [],
                cancellationDecided: false
            },
            {
                coverageNotices: {
                    emitCoverageChanged: async (event) => {
                        events.push(event);
                    }
                }
            }
        );
        expect(events).toEqual([]);
    });
});
