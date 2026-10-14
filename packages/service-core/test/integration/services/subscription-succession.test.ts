import { eq, getDb, idempotencyKeys, providerLinks, subscriptions } from '@repo/db';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { startSuccession } from '../../../src/services/billing/subscription/start-succession.service';
import { closeServiceTestPool, getServiceTestDb } from './helpers';
import {
    ensureBillingDeadlineVersion1,
    seedPredecessor,
    seedSuccessionChoice,
    successionClock,
    successionPorts,
    successionReturnUrl
} from './support/succession-fixtures';

afterAll(closeServiceTestPool);
beforeAll(ensureBillingDeadlineVersion1);

describe('TEST:B3:39 S1 succession branch, seeded rows, no route', () => {
    it('creates an authorized ACTIVE successor with its key committed before authorize', async () => {
        const choice = await seedSuccessionChoice();
        const seeded = await seedPredecessor({
            userId: choice.user.id,
            planVersionId: choice.planVersionId,
            billingOptionId: choice.predecessorBillingOptionId,
            status: 'ACTIVE',
            providerState: 'active',
            honestAboutM1: true
        });
        const originalAuthorize = seeded.fake.authorize.bind(seeded.fake);
        const authorize = vi.spyOn(seeded.fake, 'authorize').mockImplementation(async (input) => {
            const [row] = await getDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, input.reference));
            expect(row?.status).toBe('PENDING_AUTHORIZATION');
            const [key] = await getDb()
                .select()
                .from(idempotencyKeys)
                .where(eq(idempotencyKeys.subjectId, input.reference));
            expect(key?.operation).toBe('PREAPPROVAL_CREATE');
            expect(key?.completedAt).toBeNull();
            expect(input.reference).toBe(row?.id);
            expect(input.firstChargeAt).toBeTruthy();
            expect(row?.firstChargeAt?.getTime()).toBeGreaterThan(
                row?.authorizationWindowEndsAt?.getTime() ?? Number.POSITIVE_INFINITY
            );
            return originalAuthorize(input);
        });
        const result = await startSuccession(
            {
                userId: choice.user.id,
                predecessorSubscriptionId: seeded.predecessor.id,
                billingOptionId: choice.targetBillingOptionId,
                returnUrl: successionReturnUrl
            },
            successionPorts(seeded.provider)
        );
        const [successor] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, result.subscriptionId));
        const [key] = await getServiceTestDb()
            .select()
            .from(idempotencyKeys)
            .where(eq(idempotencyKeys.subjectId, result.subscriptionId));
        const [link] = await getServiceTestDb()
            .select()
            .from(providerLinks)
            .where(eq(providerLinks.subscriptionId, result.subscriptionId));
        const confirmed = await seeded.provider.readAuthorization({
            authorizationId: result.authorizationId
        });
        expect(successor).toMatchObject({
            status: 'PENDING_AUTHORIZATION',
            class: 'PRINCIPAL',
            paymentMethod: 'CARD',
            succeedsId: seeded.predecessor.id
        });
        expect(successor?.firstChargeAt?.getTime()).toBe(
            (successor?.authorizationWindowEndsAt?.getTime() ?? 0) + 24 * 60 * 60 * 1000
        );
        expect(successor?.firstChargeAt?.toISOString()).toBe(confirmed.snapshot.firstChargeAt);
        expect(key?.completedAt).not.toBeNull();
        expect(link?.providerId).toBe(result.authorizationId);
        expect(authorize).toHaveBeenCalledWith(
            expect.objectContaining({
                reference: result.subscriptionId,
                firstChargeAt: successor?.firstChargeAt?.toISOString()
            })
        );
        expect(result).toMatchObject({
            predecessorId: seeded.predecessor.id,
            basis: 'ACTIVE_CARD_AUTHORIZED'
        });
        const [predecessor] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.predecessor.id));
        expect(predecessor?.status).toBe('ACTIVE');
        expect(predecessor?.succeededById).toBe(result.subscriptionId);
    });

    it('creates over CANCEL_SCHEDULED without reading its preapproval in the gate', async () => {
        const choice = await seedSuccessionChoice();
        const seeded = await seedPredecessor({
            userId: choice.user.id,
            planVersionId: choice.planVersionId,
            billingOptionId: choice.predecessorBillingOptionId,
            status: 'CANCEL_SCHEDULED',
            providerState: 'cancelled',
            honestAboutM1: true
        });
        const [predecessorLink] = await getServiceTestDb()
            .select()
            .from(providerLinks)
            .where(eq(providerLinks.subscriptionId, seeded.predecessor.id));
        if (!predecessorLink) throw new Error('Predecessor provider link is missing');
        const read = vi.spyOn(seeded.fake, 'readAuthorization');
        const result = await startSuccession(
            {
                userId: choice.user.id,
                predecessorSubscriptionId: seeded.predecessor.id,
                billingOptionId: choice.targetBillingOptionId,
                returnUrl: successionReturnUrl
            },
            successionPorts(seeded.provider)
        );
        expect(result.basis).toBe('CANCEL_SCHEDULED');
        expect(
            read.mock.calls.filter(
                ([input]) => input.authorizationId === predecessorLink.providerId
            )
        ).toHaveLength(0);
        const [successor] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, result.subscriptionId));
        expect(successor?.succeedsId).toBe(seeded.predecessor.id);
        expect(successor?.firstChargeAt?.getTime()).toBeGreaterThan(
            successor?.authorizationWindowEndsAt?.getTime() ?? Number.POSITIVE_INFINITY
        );
    });

    it('creates over cancelled SUSPENDED and omits firstChargeAt from authorize', async () => {
        const choice = await seedSuccessionChoice();
        const seeded = await seedPredecessor({
            userId: choice.user.id,
            planVersionId: choice.planVersionId,
            billingOptionId: choice.predecessorBillingOptionId,
            status: 'SUSPENDED',
            providerState: 'cancelled',
            honestAboutM1: true
        });
        const originalAuthorize = seeded.fake.authorize.bind(seeded.fake);
        const authorize = vi.spyOn(seeded.fake, 'authorize').mockImplementation(async (input) => {
            expect(input.firstChargeAt).toBeUndefined();
            return originalAuthorize(input);
        });
        const result = await startSuccession(
            {
                userId: choice.user.id,
                predecessorSubscriptionId: seeded.predecessor.id,
                billingOptionId: choice.targetBillingOptionId,
                returnUrl: successionReturnUrl
            },
            successionPorts(seeded.provider)
        );
        const [successor] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, result.subscriptionId));
        expect(result.basis).toBe('CARD_SUSPENDED_CONFIRMED_CANCELLED');
        expect(successor?.firstChargeAt?.getTime()).toBe(successionClock.now().getTime());
        expect(authorize).toHaveBeenCalledOnce();
    });

    it('rejects paused with the arrears mirror and keeps the refusal when the default delegate throws', async () => {
        const choice = await seedSuccessionChoice();
        const seeded = await seedPredecessor({
            userId: choice.user.id,
            planVersionId: choice.planVersionId,
            billingOptionId: choice.predecessorBillingOptionId,
            status: 'ACTIVE',
            providerState: 'paused',
            honestAboutM1: true
        });
        const delegate = vi.fn(async () => {});
        const authorize = vi.spyOn(seeded.fake, 'authorize');
        const countBefore = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.userId, choice.user.id));
        const run = (mirror?: { delegate: typeof delegate }) =>
            startSuccession(
                {
                    userId: choice.user.id,
                    predecessorSubscriptionId: seeded.predecessor.id,
                    billingOptionId: choice.targetBillingOptionId,
                    returnUrl: successionReturnUrl
                },
                successionPorts(seeded.provider, mirror)
            );
        await expect(run({ delegate })).rejects.toMatchObject({
            reason: 'LAST_CHARGE_NOT_ENTERED'
        });
        expect(delegate).toHaveBeenCalledExactlyOnceWith({
            pair: 'PROVIDER_PAUSE_IS_ARREARS',
            subscriptionId: seeded.predecessor.id,
            readAt: successionClock.now(),
            cancelledSeenAt: null
        });
        await expect(run()).rejects.toMatchObject({ reason: 'LAST_CHARGE_NOT_ENTERED' });
        expect(authorize).not.toHaveBeenCalled();
        const rowsAfter = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.userId, choice.user.id));
        expect(rowsAfter).toHaveLength(countBefore.length);
        expect(rowsAfter.find((row) => row.id === seeded.predecessor.id)?.status).toBe('ACTIVE');
    });

    it('leaves an M1 creation unapplied and pending without returning a checkout link', async () => {
        const choice = await seedSuccessionChoice();
        const seeded = await seedPredecessor({
            userId: choice.user.id,
            planVersionId: choice.planVersionId,
            billingOptionId: choice.predecessorBillingOptionId,
            status: 'CANCEL_SCHEDULED',
            providerState: 'cancelled'
        });
        await expect(
            startSuccession(
                {
                    userId: choice.user.id,
                    predecessorSubscriptionId: seeded.predecessor.id,
                    billingOptionId: choice.targetBillingOptionId,
                    returnUrl: successionReturnUrl
                },
                successionPorts(seeded.provider)
            )
        ).rejects.toMatchObject({ reason: 'CREATION_NOT_APPLIED' });
        const rows = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.userId, choice.user.id));
        const successor = rows.find((row) => row.id !== seeded.predecessor.id);
        expect(successor).toMatchObject({
            status: 'PENDING_AUTHORIZATION',
            succeedsId: seeded.predecessor.id
        });
        expect(successor?.firstChargeAt?.getTime()).toBeGreaterThan(
            successor?.authorizationWindowEndsAt?.getTime() ?? Number.POSITIVE_INFINITY
        );
    });
});
