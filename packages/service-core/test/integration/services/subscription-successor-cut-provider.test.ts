import { emailOutbox, eq, subscriptions } from '@repo/db';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { completeSuccessorCut } from '../../../src/services/billing/subscription/successor-cut-after-commit';
import { createSuccessorCutter } from '../../../src/services/billing/subscription/successor-cutter';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers';
import { retireS17, s17Ports, seedS17 } from './support/succession-s17-fixtures';
import { successorCutPorts } from './support/successor-cut-fixtures';

afterEach(retireS17);
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
});
