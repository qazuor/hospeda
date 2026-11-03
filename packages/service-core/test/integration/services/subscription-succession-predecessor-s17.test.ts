import { emailOutbox, eq, subscriptionPauses, subscriptions } from '@repo/db';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { cancelSuccessionPredecessor } from '../../../src/services/billing/subscription/cancel-succession-predecessor.service.js';
import { reevaluateSuccessionPredecessors } from '../../../src/services/billing/subscription/reevaluate-succession-predecessors.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { retireS17, s17Now, s17Ports, seedS17 } from './support/succession-s17-fixtures.js';

afterEach(retireS17);
afterAll(closeServiceTestPool);

async function rows(predecessorId: string, successorId: string) {
    const db = getServiceTestDb();
    const [predecessor] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, predecessorId));
    const [successor] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, successorId));
    if (!predecessor || !successor) throw new Error('S17 fixture rows missing');
    return { predecessor, successor };
}

async function notices(predecessorId: string, userId: string) {
    const all = await getServiceTestDb()
        .select()
        .from(emailOutbox)
        .where(eq(emailOutbox.recipientUserId, userId));
    return all.filter(
        (row) => (row.payload as { subscriptionId?: string }).subscriptionId === predecessorId
    );
}

describe.skipIf(!isServiceTestDbAvailable())('TEST:B8b:9 S17 predecessor cancellation', () => {
    it('(a) waits for a pending notice, then reevaluates the same succession', async () => {
        const seeded = await seedS17({});
        const ports = s17Ports(seeded.provider);
        const first = await cancelSuccessionPredecessor(
            { successorSubscriptionId: seeded.successorId },
            ports
        );
        const before = await rows(seeded.predecessorId, seeded.successorId);
        const providerBefore = await seeded.fake.readAuthorization({
            authorizationId: seeded.predecessorAuthorizationId
        });
        expect(first).toEqual({ outcome: 'DEFERRED', reason: 'NOTICE_PENDING' });
        expect(before.predecessor.status).toBe('ACTIVE');
        expect(before.successor.succeedsId).toBe(seeded.predecessorId);
        expect(providerBefore.snapshot.status).toBe('active');
        expect(seeded.calls).toHaveLength(0);
        const pending = await notices(seeded.predecessorId, seeded.userId);
        expect(pending).toHaveLength(1);
        await getServiceTestDb()
            .update(emailOutbox)
            .set({ status: 'sent' })
            .where(eq(emailOutbox.id, pending[0]!.id));
        const second = await reevaluateSuccessionPredecessors({ limit: 200 }, ports);
        const after = await rows(seeded.predecessorId, seeded.successorId);
        expect(second.cancelled).toBe(1);
        expect(after.predecessor.status).toBe('CANCELLED');
        expect(after.successor.succeedsId).toBeNull();
        expect(seeded.calls).toEqual([seeded.predecessorAuthorizationId]);
        expect(await notices(seeded.predecessorId, seeded.userId)).toHaveLength(1);
    });

    it('(b) cancels after definitive outbox failure and reports an undeliverable notice', async () => {
        const seeded = await seedS17({});
        const result = await cancelSuccessionPredecessor(
            { successorSubscriptionId: seeded.successorId },
            s17Ports(seeded.provider, { failWith: 'delivery exhausted' })
        );
        const provider = await seeded.fake.readAuthorization({
            authorizationId: seeded.predecessorAuthorizationId
        });
        expect(result).toEqual({
            outcome: 'CANCELLED',
            providerCall: 'CONFIRMED',
            pauseClosed: false,
            noticeUndeliverable: true
        });
        expect(provider.snapshot.status).toBe('cancelled');
        expect(seeded.calls).toEqual([seeded.predecessorAuthorizationId]);
        expect((await notices(seeded.predecessorId, seeded.userId))[0]?.status).toBe('failed');
    });

    it('(c) skips both call and notice when the predecessor authorization is already cancelled', async () => {
        const seeded = await seedS17({ predecessorCancelled: true });
        const result = await cancelSuccessionPredecessor(
            { successorSubscriptionId: seeded.successorId },
            s17Ports(seeded.provider, { deliver: true })
        );
        expect(result).toEqual({
            outcome: 'CANCELLED',
            providerCall: 'ALREADY_CANCELLED',
            pauseClosed: false,
            noticeUndeliverable: false
        });
        expect(seeded.calls).toHaveLength(0);
        expect(await notices(seeded.predecessorId, seeded.userId)).toHaveLength(0);
    });

    it('(d) requests the succession template before the provider call and closes S18 in one commit', async () => {
        const seeded = await seedS17({});
        let noticesAtCancel = -1;
        const provider = new Proxy(seeded.provider, {
            get(target, property, receiver) {
                if (property === 'cancel')
                    return async (args: { readonly authorizationId: string }) => {
                        noticesAtCancel = (await notices(seeded.predecessorId, seeded.userId))
                            .length;
                        return target.cancel(args);
                    };
                const value: unknown = Reflect.get(target, property, receiver);
                return typeof value === 'function' ? value.bind(target) : value;
            }
        });
        const result = await cancelSuccessionPredecessor(
            { successorSubscriptionId: seeded.successorId },
            s17Ports(provider, { deliver: true })
        );
        const written = await rows(seeded.predecessorId, seeded.successorId);
        expect(result).toEqual({
            outcome: 'CANCELLED',
            providerCall: 'CONFIRMED',
            pauseClosed: false,
            noticeUndeliverable: false
        });
        expect(noticesAtCancel).toBe(1);
        expect(await notices(seeded.predecessorId, seeded.userId)).toMatchObject([
            { template: 'billing.succession-predecessor-cancel' }
        ]);
        expect(written.predecessor.status).toBe('CANCELLED');
        expect(written.predecessor.serviceEndsAt).toEqual(s17Now);
        expect(written.predecessor.succeededById).toBe(seeded.successorId);
        expect(written.successor.succeedsId).toBeNull();
    });

    it('(e) closes the real customer pause when cancelling a PAUSED predecessor', async () => {
        const seeded = await seedS17({ predecessorStatus: 'PAUSED' });
        const result = await cancelSuccessionPredecessor(
            { successorSubscriptionId: seeded.successorId },
            s17Ports(seeded.provider, { deliver: true })
        );
        const [pause] = await getServiceTestDb()
            .select()
            .from(subscriptionPauses)
            .where(eq(subscriptionPauses.subscriptionId, seeded.predecessorId));
        expect(result).toMatchObject({ outcome: 'CANCELLED', pauseClosed: true });
        expect(pause?.reason).toBe('CUSTOMER_REQUEST');
        expect(pause?.actualEndAt).toEqual(s17Now);
    });

    it.each([
        'GRACE_PERIOD',
        'CANCEL_SCHEDULED',
        'SUSPENDED'
    ] as const)('(f) cancels a %s predecessor with its real authorization state', async (status) => {
        const seeded = await seedS17({ predecessorStatus: status });
        const result = await cancelSuccessionPredecessor(
            { successorSubscriptionId: seeded.successorId },
            s17Ports(seeded.provider, { deliver: true })
        );
        expect(result).toMatchObject({
            outcome: 'CANCELLED',
            providerCall: status === 'SUSPENDED' ? 'ALREADY_CANCELLED' : 'CONFIRMED'
        });
        expect((await rows(seeded.predecessorId, seeded.successorId)).predecessor.status).toBe(
            'CANCELLED'
        );
    });

    it('(g) preserves D7 while the successor is still pending', async () => {
        const seeded = await seedS17({ successorStatus: 'PENDING_AUTHORIZATION' });
        const result = await cancelSuccessionPredecessor(
            { successorSubscriptionId: seeded.successorId },
            s17Ports(seeded.provider, { deliver: true })
        );
        const current = await rows(seeded.predecessorId, seeded.successorId);
        const provider = await seeded.fake.readAuthorization({
            authorizationId: seeded.predecessorAuthorizationId
        });
        expect(result).toEqual({ outcome: 'NOT_APPLICABLE', reason: 'SUCCESSOR_NOT_AUTHORIZED' });
        expect(current.predecessor.status).toBe('ACTIVE');
        expect(current.successor.status).toBe('PENDING_AUTHORIZATION');
        expect(provider.snapshot.status).toBe('active');
        expect(seeded.calls).toHaveLength(0);
    });

    it('(h) rejects a successor whose provider authorization is not active', async () => {
        const seeded = await seedS17({});
        await seeded.fake.cancel({ authorizationId: seeded.successorAuthorizationId });
        const result = await cancelSuccessionPredecessor(
            { successorSubscriptionId: seeded.successorId },
            s17Ports(seeded.provider, { deliver: true })
        );
        expect(result).toEqual({ outcome: 'NOT_APPLICABLE', reason: 'SUCCESSOR_NOT_CONFIRMED' });
        expect((await rows(seeded.predecessorId, seeded.successorId)).predecessor.status).toBe(
            'ACTIVE'
        );
        expect(seeded.calls).toHaveLength(0);
    });

    it('(i) defers when the provider refuses the predecessor cancellation', async () => {
        const seeded = await seedS17({});
        const provider = new Proxy(seeded.provider, {
            get(target, property, receiver) {
                if (property === 'cancel')
                    return async () => {
                        throw new Error('refused');
                    };
                const value: unknown = Reflect.get(target, property, receiver);
                return typeof value === 'function' ? value.bind(target) : value;
            }
        });
        const result = await cancelSuccessionPredecessor(
            { successorSubscriptionId: seeded.successorId },
            s17Ports(provider, { deliver: true })
        );
        expect(result).toEqual({ outcome: 'DEFERRED', reason: 'CALL_FAILED' });
        expect((await rows(seeded.predecessorId, seeded.successorId)).predecessor.status).toBe(
            'ACTIVE'
        );
        expect(
            (
                await seeded.fake.readAuthorization({
                    authorizationId: seeded.predecessorAuthorizationId
                })
            ).snapshot.status
        ).toBe('active');
    });

    it('(j) loses a race when another writer ends the predecessor before S17 locks it', async () => {
        const seeded = await seedS17({});
        const provider = new Proxy(seeded.provider, {
            get(target, property, receiver) {
                if (property === 'cancel')
                    return async (args: { readonly authorizationId: string }) => {
                        await getServiceTestDb()
                            .update(subscriptions)
                            .set({ status: 'CANCELLED', serviceEndsAt: s17Now })
                            .where(eq(subscriptions.id, seeded.predecessorId));
                        return target.cancel(args);
                    };
                const value: unknown = Reflect.get(target, property, receiver);
                return typeof value === 'function' ? value.bind(target) : value;
            }
        });
        const result = await cancelSuccessionPredecessor(
            { successorSubscriptionId: seeded.successorId },
            s17Ports(provider, { deliver: true })
        );
        const current = await rows(seeded.predecessorId, seeded.successorId);
        expect(result).toEqual({ outcome: 'LOST_RACE' });
        expect(current.predecessor.status).toBe('CANCELLED');
        expect(current.predecessor.serviceEndsAt).toEqual(s17Now);
        expect(current.successor.succeedsId).toBe(seeded.predecessorId);
    });

    it('(k) closes S18 when the predecessor already ended by another path', async () => {
        const seeded = await seedS17({ predecessorStatus: 'CANCELLED' });
        const result = await cancelSuccessionPredecessor(
            { successorSubscriptionId: seeded.successorId },
            s17Ports(seeded.provider, { deliver: true })
        );
        const current = await rows(seeded.predecessorId, seeded.successorId);
        expect(result).toEqual({ outcome: 'NOT_APPLICABLE', reason: 'PREDECESSOR_NOT_LIVE' });
        expect(current.successor.succeedsId).toBeNull();
        expect(current.predecessor.succeededById).toBe(seeded.successorId);
        expect(seeded.calls).toHaveLength(0);
    });
});
