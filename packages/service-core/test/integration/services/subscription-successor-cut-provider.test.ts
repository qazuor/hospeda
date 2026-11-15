import {
    emailOutbox,
    eq,
    inArray,
    payments,
    providerLinks,
    subscriptions,
    successionRetainedPayments
} from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { runReconciliationSweep } from '../../../src/services/billing/reconciliation/sweep/reconciliation-sweep.service';
import * as authorizationWindows from '../../../src/services/billing/subscription/expire-authorization-windows.service';
import { completeSuccessorCut } from '../../../src/services/billing/subscription/successor-cut-after-commit';
import { createSuccessorCutter } from '../../../src/services/billing/subscription/successor-cutter';
import {
    closeServiceTestPool,
    getServiceTestDb,
    isServiceTestDbAvailable,
    withServiceTestTransaction
} from './helpers';
import {
    resetSeededReconciliationInventory,
    trackSeededReconciliationRow,
    withSeededCancellationRetryInventory,
    withSeededReconciliationInventory
} from './reconciliation-sweep-fixtures';
import {
    ORPHAN_VERTICAL,
    retireCommittedOrphanRows,
    seedCommittedOrphans
} from './support/addon-orphan-fixtures';
import { outboxBeforeCancelNotice } from './support/outbox-before-cancel-notice';
import { retainInOwnTransaction } from './support/succession-retention-fixtures';
import { retireS17, s17Now, s17Ports, seedS17 } from './support/succession-s17-fixtures';
import { seedSuccessorCutCase, successorCutPorts } from './support/successor-cut-fixtures';

const seededPaymentIds: string[] = [];
const cutSuccessors: { readonly id: string; readonly predecessorId: string }[] = [];

afterEach(async () => {
    vi.restoreAllMocks();
    const db = getServiceTestDb();
    if (seededPaymentIds.length)
        await db
            .delete(successionRetainedPayments)
            .where(inArray(successionRetainedPayments.paymentId, seededPaymentIds));
    if (seededPaymentIds.length)
        await db.delete(payments).where(inArray(payments.id, seededPaymentIds.splice(0)));
    for (const successor of cutSuccessors.splice(0)) {
        await db.delete(providerLinks).where(eq(providerLinks.subscriptionId, successor.id));
        await db
            .update(subscriptions)
            .set({ succeededById: null })
            .where(eq(subscriptions.id, successor.predecessorId));
        await db.delete(subscriptions).where(eq(subscriptions.id, successor.id));
    }
    resetSeededReconciliationInventory();
    await retireS17();
    await retireCommittedOrphanRows();
});
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())('TEST:B8b:13 S31 provider half', () => {
    it('(k) enqueues the requested notice before cancelling the live successor authorization', async () => {
        const seeded = await seedS17({ successorStatus: 'PENDING_AUTHORIZATION' });
        const db = getServiceTestDb();
        const cut = await db.transaction(async (tx) =>
            createSuccessorCutter(successorCutPorts(tx)).cutSuccessor({
                predecessorSubscriptionId: seeded.predecessorId,
                tx
            })
        );
        const observedProvider = new Proxy(seeded.provider, {
            get(target, property, receiver) {
                if (property === 'cancel')
                    return async (input: { readonly authorizationId: string }) => {
                        const queued = await db
                            .select()
                            .from(emailOutbox)
                            .where(eq(emailOutbox.recipientUserId, seeded.userId));
                        expect(queued).toHaveLength(1);
                        expect(queued[0]?.template).toBe('billing.successor-cut-cancel');
                        seeded.calls.push(input.authorizationId);
                        return seeded.fake.cancel(input);
                    };
                const value: unknown = Reflect.get(target, property, receiver);
                return typeof value === 'function' ? value.bind(target) : value;
            }
        });
        const result = await completeSuccessorCut(
            cut,
            s17Ports(observedProvider, { deliver: true })
        );
        const notices = await db
            .select()
            .from(emailOutbox)
            .where(eq(emailOutbox.recipientUserId, seeded.userId));
        const authorization = await seeded.fake.readAuthorization({
            authorizationId: seeded.successorAuthorizationId
        });

        expect(result.providerCall).toBe('CONFIRMED');
        expect(notices).toHaveLength(1);
        expect(notices[0]).toMatchObject({
            template: 'billing.successor-cut-cancel',
            status: 'sent'
        });
        expect(authorization.snapshot.status).toBe('cancelled');
        expect(seeded.calls).toEqual([seeded.successorAuthorizationId]);
    });

    it('(l) cancels an active successor after its notice has been delivered', async () => {
        const seeded = await seedS17({ successorStatus: 'ACTIVE' });
        const db = getServiceTestDb();
        const cut = await db.transaction(async (tx) =>
            createSuccessorCutter(successorCutPorts(tx)).cutSuccessor({
                predecessorSubscriptionId: seeded.predecessorId,
                tx
            })
        );

        const result = await completeSuccessorCut(
            cut,
            s17Ports(seeded.provider, { deliver: true })
        );
        const [successor] = await db
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.successorId));

        expect(result.providerCall).toBe('CONFIRMED');
        expect(successor?.status).toBe('CANCELLED');
        expect(seeded.calls).toEqual([seeded.successorAuthorizationId]);
    });

    it('(m) skips provider cancellation when the fresh read already reports cancelled', async () => {
        const seeded = await seedS17({ successorStatus: 'ACTIVE' });
        await seeded.fake.cancel({ authorizationId: seeded.successorAuthorizationId });
        const db = getServiceTestDb();
        const cut = await db.transaction(async (tx) =>
            createSuccessorCutter(successorCutPorts(tx)).cutSuccessor({
                predecessorSubscriptionId: seeded.predecessorId,
                tx
            })
        );

        const result = await completeSuccessorCut(
            cut,
            s17Ports(seeded.provider, { deliver: true })
        );

        expect(result.providerCall).toBe('ALREADY_CANCELLED');
        expect(seeded.calls).toEqual([]);
        expect(
            await db
                .select()
                .from(emailOutbox)
                .where(eq(emailOutbox.recipientUserId, seeded.userId))
        ).toHaveLength(0);
    });

    it('(o) skips provider and notice work for a manual payer', async () => {
        const seeded = await seedS17({ successorStatus: 'PENDING_AUTHORIZATION' });
        const db = getServiceTestDb();
        await db
            .update(subscriptions)
            .set({ paymentMethod: 'MANUAL' })
            .where(eq(subscriptions.id, seeded.successorId));
        const cut = await db.transaction(async (tx) =>
            createSuccessorCutter(successorCutPorts(tx)).cutSuccessor({
                predecessorSubscriptionId: seeded.predecessorId,
                tx
            })
        );

        const result = await completeSuccessorCut(
            cut,
            s17Ports(seeded.provider, { deliver: true })
        );

        expect(result.providerCall).toBe('NONE');
        expect(seeded.calls).toEqual([]);
        expect(
            await db
                .select()
                .from(emailOutbox)
                .where(eq(emailOutbox.recipientUserId, seeded.userId))
        ).toHaveLength(0);
    });

    it('(p) reevaluates a retained payment for SUSPENDED and leaves CANCELLED to the sweep', async () => {
        const db = getServiceTestDb();
        const suspended = await seedS17({
            predecessorStatus: 'SUSPENDED',
            successorStatus: 'PENDING_AUTHORIZATION'
        });
        const [suspendedPayment] = await db
            .insert(payments)
            .values({
                subscriptionId: suspended.predecessorId,
                amount: 250000,
                currency: 'ARS',
                status: 'SUCCEEDED',
                provider: 'fake',
                providerFactId: `s31-retained-${crypto.randomUUID()}`,
                factAt: s17Now
            })
            .returning({ id: payments.id });
        if (!suspendedPayment) throw new Error('S31 retained payment was not seeded');
        seededPaymentIds.push(suspendedPayment.id);
        await retainInOwnTransaction({
            subscriptionId: suspended.predecessorId,
            paymentId: suspendedPayment.id,
            unpaidSince: s17Now,
            now: s17Now
        });
        const suspendedCut = await db.transaction(async (tx) =>
            createSuccessorCutter(successorCutPorts(tx)).cutSuccessor({
                predecessorSubscriptionId: suspended.predecessorId,
                tx
            })
        );
        const reevaluated = await completeSuccessorCut(
            suspendedCut,
            s17Ports(suspended.provider, { deliver: true })
        );
        const [closedRetention] = await db
            .select()
            .from(successionRetainedPayments)
            .where(eq(successionRetainedPayments.paymentId, suspendedPayment.id));

        expect(reevaluated.retainedReevaluated).toBe(1);
        expect(closedRetention).toMatchObject({
            releasedAt: expect.any(Date),
            releaseReason: 'REEVALUATED'
        });

        const cancelled = await seedS17({
            predecessorStatus: 'CANCELLED',
            predecessorCancelled: true,
            successorStatus: 'PENDING_AUTHORIZATION'
        });
        const [cancelledPayment] = await db
            .insert(payments)
            .values({
                subscriptionId: cancelled.predecessorId,
                amount: 250000,
                currency: 'ARS',
                status: 'SUCCEEDED',
                provider: 'fake',
                providerFactId: `s31-retained-${crypto.randomUUID()}`,
                factAt: s17Now
            })
            .returning({ id: payments.id });
        if (!cancelledPayment) throw new Error('S31 retained payment was not seeded');
        seededPaymentIds.push(cancelledPayment.id);
        await retainInOwnTransaction({
            subscriptionId: cancelled.predecessorId,
            paymentId: cancelledPayment.id,
            unpaidSince: s17Now,
            now: s17Now
        });
        const cancelledCut = await db.transaction(async (tx) =>
            createSuccessorCutter(successorCutPorts(tx)).cutSuccessor({
                predecessorSubscriptionId: cancelled.predecessorId,
                tx
            })
        );
        const deferredToSweep = await completeSuccessorCut(
            cancelledCut,
            s17Ports(cancelled.provider, { deliver: true })
        );
        const [openRetention] = await db
            .select()
            .from(successionRetainedPayments)
            .where(eq(successionRetainedPayments.paymentId, cancelledPayment.id));

        expect(deferredToSweep.retainedReevaluated).toBe(0);
        expect(openRetention).toMatchObject({ releasedAt: null, releaseReason: null });
    });

    it('(p) logs a failed retained payment reevaluation without undoing the S31 cut', async () => {
        const seeded = await seedS17({ successorStatus: 'PENDING_AUTHORIZATION' });
        const db = getServiceTestDb();
        const cut = await db.transaction(async (tx) =>
            createSuccessorCutter(successorCutPorts(tx)).cutSuccessor({
                predecessorSubscriptionId: seeded.predecessorId,
                tx
            })
        );
        vi.spyOn(authorizationWindows, 'reevaluateRetainedPayments').mockRejectedValue(
            new Error('S7 temporarily unavailable')
        );

        const result = await completeSuccessorCut(
            cut,
            s17Ports(seeded.provider, { deliver: true })
        );
        const [successor] = await db
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.successorId));

        expect(result.retainedReevaluated).toBe(0);
        expect(successor?.status).toBe('ABANDONED');
    });

    it('(n) defers a pending notice, then the real sweep retries S31 with SUCCESSOR_CUT', async () => {
        const seeded = await seedS17({ successorStatus: 'PENDING_AUTHORIZATION' });
        const db = getServiceTestDb();
        const cut = await db.transaction(async (tx) =>
            createSuccessorCutter(successorCutPorts(tx)).cutSuccessor({
                predecessorSubscriptionId: seeded.predecessorId,
                tx
            })
        );
        trackSeededReconciliationRow(seeded.successorId);
        const deferred = await completeSuccessorCut(cut, s17Ports(seeded.provider));
        const [abandoned] = await db
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.successorId));
        expect(deferred).toMatchObject({
            providerCall: 'DEFERRED_TO_SWEEP',
            reason: 'NOTICE_PENDING'
        });
        expect(abandoned?.status).toBe('ABANDONED');
        expect(seeded.calls).toEqual([]);

        const noticeCalls: { subscriptionId: string; userId: string | null; kind: string }[] = [];
        const notice = outboxBeforeCancelNotice({ deliver: true });
        const clock = { now: () => s17Now };
        const fake = seeded.fake as FakePaymentProvider;
        const summary = await withSeededReconciliationInventory(() =>
            withSeededCancellationRetryInventory(() =>
                runReconciliationSweep(
                    { mode: 'single', correlationId: crypto.randomUUID() },
                    {
                        provider: seeded.provider,
                        clock,
                        cancellationRetry: {
                            beforeCancelNotice: {
                                beforeCancel: async (input) => {
                                    noticeCalls.push(input);
                                    return notice.beforeCancel(input);
                                }
                            }
                        }
                    }
                )
            )
        );

        expect(summary.cancellationRetry?.confirmed).toBe(1);
        expect(noticeCalls).toEqual([
            {
                subscriptionId: seeded.successorId,
                userId: seeded.userId,
                kind: 'SUCCESSOR_CUT'
            }
        ]);
        expect(seeded.calls).toEqual([seeded.successorAuthorizationId]);
        expect(
            (await fake.readAuthorization({ authorizationId: seeded.successorAuthorizationId }))
                .snapshot.status
        ).toBe('cancelled');
    });

    it('(n) still cancels when the outbox has definitively failed the notice', async () => {
        const seeded = await seedS17({ successorStatus: 'PENDING_AUTHORIZATION' });
        const db = getServiceTestDb();
        const cut = await db.transaction(async (tx) =>
            createSuccessorCutter(successorCutPorts(tx)).cutSuccessor({
                predecessorSubscriptionId: seeded.predecessorId,
                tx
            })
        );

        const result = await completeSuccessorCut(
            cut,
            s17Ports(seeded.provider, { failWith: 'undeliverable:hard_bounce' })
        );

        expect(result).toMatchObject({ providerCall: 'CONFIRMED', noticeUndeliverable: true });
        expect(seeded.calls).toEqual([seeded.successorAuthorizationId]);
        expect(
            (
                await seeded.fake.readAuthorization({
                    authorizationId: seeded.successorAuthorizationId
                })
            ).snapshot.status
        ).toBe('cancelled');
    });

    it('(q) cancels an A5 orphaned complement authorization after commit', async () => {
        const clock = { now: () => s17Now };
        const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
        const orphan = await seedCommittedOrphans({ fake });
        const authorization = await fake.authorize({
            reference: `s31-successor-${crypto.randomUUID()}`,
            amount: { amountMinor: 250000, currency: 'ARS' },
            cadence: { everyMonths: 1 },
            reason: 'S31 provider fixture',
            returnUrl: 'https://example.test/return',
            payerEmail: `s31-${crypto.randomUUID()}@example.test`
        });
        await fake.approve({ authorizationId: authorization.authorizationId });
        const db = getServiceTestDb();
        const [predecessor] = await db
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, orphan.principalId));
        if (!predecessor) throw new Error('S31 orphan predecessor missing');
        const [successor] = await db
            .insert(subscriptions)
            .values({
                userId: orphan.userId,
                vertical: ORPHAN_VERTICAL,
                planVersionId: predecessor.planVersionId,
                billingOptionId: predecessor.billingOptionId,
                paymentMethod: 'CARD',
                class: 'PRINCIPAL',
                status: 'PENDING_AUTHORIZATION',
                succeedsId: predecessor.id
            })
            .returning({ id: subscriptions.id });
        if (!successor) throw new Error('S31 successor missing');
        cutSuccessors.push({ id: successor.id, predecessorId: predecessor.id });
        await db
            .update(subscriptions)
            .set({ succeededById: successor.id })
            .where(eq(subscriptions.id, predecessor.id));
        await db.insert(providerLinks).values({
            subscriptionId: successor.id,
            provider: 'MERCADO_PAGO',
            providerId: authorization.authorizationId
        });
        const cut = await db.transaction(async (tx) =>
            createSuccessorCutter(successorCutPorts(tx)).cutSuccessor({
                predecessorSubscriptionId: predecessor.id,
                tx
            })
        );

        const result = await completeSuccessorCut(cut, {
            provider: fake,
            clock,
            beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true })
        });
        const addon = orphan.addons[0];
        if (!addon) throw new Error('S31 orphan complement fixture missing');
        const complement = await fake.readAuthorization({ authorizationId: addon.authorizationId });

        expect(result.providerCall).toBe('CONFIRMED');
        expect(cut).toMatchObject({
            outcome: 'CUT',
            cancelledAddons: [{ instanceId: addon.instanceId }]
        });
        expect(complement.snapshot.status).toBe('cancelled');
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
});
