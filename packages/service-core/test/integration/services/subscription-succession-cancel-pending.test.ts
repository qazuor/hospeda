import { courtesyGrants, domainEventModel, eq, providerLinks, subscriptions } from '@repo/db';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cancelPendingAttempt } from '../../../src/services/billing/subscription/cancel-pending-attempt.service';
import { startSuccession } from '../../../src/services/billing/subscription/start-succession.service';
import { closeServiceTestPool, getServiceTestDb } from './helpers';
import {
    ensureBillingDeadlineVersion1,
    seedPredecessor,
    seedSuccessionChoice,
    successionPorts,
    successionReturnUrl
} from './support/succession-fixtures';

afterAll(closeServiceTestPool);
beforeAll(ensureBillingDeadlineVersion1);
afterEach(() => vi.restoreAllMocks());

async function row(id: string) {
    const [found] = await getServiceTestDb()
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, id));
    if (!found) throw new Error(`Subscription ${id} is missing`);
    return found;
}

async function linkOf(subscriptionId: string) {
    const [link] = await getServiceTestDb()
        .select()
        .from(providerLinks)
        .where(eq(providerLinks.subscriptionId, subscriptionId));
    if (!link) throw new Error(`Subscription ${subscriptionId} has no provider link`);
    return link;
}

async function seedPendingSuccession(input: {
    readonly status: 'ACTIVE' | 'SUSPENDED';
    readonly providerState?: 'cancelled';
}) {
    const choice = await seedSuccessionChoice();
    const seeded = await seedPredecessor({
        userId: choice.user.id,
        planVersionId: choice.planVersionId,
        billingOptionId: choice.predecessorBillingOptionId,
        status: input.status,
        ...(input.providerState ? { providerState: input.providerState } : {}),
        honestAboutM1: true
    });
    const beforeCancel = vi.fn(async () => 'SENT' as const);
    const ports = { ...successionPorts(seeded.provider), beforeCancelNotice: { beforeCancel } };
    const request = {
        userId: choice.user.id,
        predecessorSubscriptionId: seeded.predecessor.id,
        billingOptionId: choice.targetBillingOptionId,
        returnUrl: successionReturnUrl,
        payerEmail: 'payer@example.test'
    };
    const successor = await startSuccession(request, ports);
    expect(successor.checkoutUrl).toBeTruthy();
    return { choice, seeded, ports, request, beforeCancel, successorId: successor.subscriptionId };
}

describe('HOS-2344: S40 cancels a pending successor and releases its predecessor', () => {
    it('abandons the successor, clears succeeded_by_id, cancels the authorization and allows a new plan change', async () => {
        const { choice, seeded, ports, request, beforeCancel, successorId } =
            await seedPendingSuccession({ status: 'ACTIVE' });
        const successorLink = await linkOf(successorId);

        const result = await cancelPendingAttempt(
            { subscriptionId: successorId, userId: choice.user.id },
            ports
        );

        expect(result).toEqual({ subscriptionId: successorId, outcome: 'ABANDONED' });
        const successor = await row(successorId);
        const predecessor = await row(seeded.predecessor.id);
        expect(successor.status).toBe('ABANDONED');
        expect(successor.succeedsId).toBe(seeded.predecessor.id);
        expect(predecessor.status).toBe('ACTIVE');
        expect(predecessor.succeededById).toBeNull();
        expect((await linkOf(successorId)).providerId).toBe(successorLink.providerId);
        const authorization = await seeded.fake.readAuthorization({
            authorizationId: successorLink.providerId
        });
        expect(authorization.snapshot.status).toBe('cancelled');
        expect(beforeCancel).toHaveBeenCalledWith(
            expect.objectContaining({ subscriptionId: successorId, kind: 'ATTEMPT_CANCELLED' })
        );
        const events = await domainEventModel.findByEntity({
            entityType: 'subscription',
            entityId: successorId
        });
        expect(events).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    eventType: 'subscription.provider_cancellation_decided',
                    reason: 'S40',
                    actorType: 'owner'
                })
            ])
        );

        const next = await startSuccession(request, ports);
        expect(next.subscriptionId).not.toBe(successorId);
        expect((await row(seeded.predecessor.id)).succeededById).toBe(next.subscriptionId);
    });

    it('keeps the predecessor deferred courtesy open', async () => {
        const { choice, seeded, ports, successorId } = await seedPendingSuccession({
            status: 'ACTIVE'
        });
        await getServiceTestDb()
            .insert(courtesyGrants)
            .values({
                beneficiaryUserId: choice.user.id,
                grantedBy: choice.user.id,
                subscriptionId: seeded.predecessor.id,
                months: 2,
                startsAt: new Date('2026-10-01T12:00:00.000Z'),
                endsAt: new Date('2027-01-01T12:00:00.000Z'),
                reason: 'fixture',
                balanceMonths: 2
            });

        await cancelPendingAttempt({ subscriptionId: successorId, userId: choice.user.id }, ports);

        const [grant] = await getServiceTestDb()
            .select()
            .from(courtesyGrants)
            .where(eq(courtesyGrants.subscriptionId, seeded.predecessor.id));
        expect(grant?.balanceMonths).toBe(2);
        expect(grant?.balanceClosedAt).toBeNull();
    });

    it('cancels a successor of a suspended predecessor whose authorization MP already cancelled', async () => {
        const { choice, seeded, ports, successorId } = await seedPendingSuccession({
            status: 'SUSPENDED',
            providerState: 'cancelled'
        });

        const result = await cancelPendingAttempt(
            { subscriptionId: successorId, userId: choice.user.id },
            ports
        );

        expect(result.outcome).toBe('ABANDONED');
        expect((await row(successorId)).status).toBe('ABANDONED');
        const predecessor = await row(seeded.predecessor.id);
        expect(predecessor.status).toBe('SUSPENDED');
        expect(predecessor.succeededById).toBeNull();
    });

    it('does not cancel a successor the payer already authorized and keeps the pointer', async () => {
        const { choice, seeded, ports, successorId } = await seedPendingSuccession({
            status: 'ACTIVE'
        });
        await seeded.fake.approve({ authorizationId: (await linkOf(successorId)).providerId });

        await expect(
            cancelPendingAttempt({ subscriptionId: successorId, userId: choice.user.id }, ports)
        ).rejects.toMatchObject({ reason: 'COMMITMENT_TAKEN' });

        expect((await row(successorId)).status).toBe('PENDING_AUTHORIZATION');
        expect((await row(seeded.predecessor.id)).succeededById).toBe(successorId);
    });

    it('answers NOT_FOUND to another person', async () => {
        const { ports, successorId } = await seedPendingSuccession({ status: 'ACTIVE' });

        await expect(
            cancelPendingAttempt(
                { subscriptionId: successorId, userId: crypto.randomUUID() },
                ports
            )
        ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
});
