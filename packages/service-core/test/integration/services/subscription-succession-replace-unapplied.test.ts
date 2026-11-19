import {
    courtesyGrants,
    domainEventModel,
    eq,
    idempotencyKeys,
    providerLinks,
    subscriptions
} from '@repo/db';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { startSuccession } from '../../../src/services/billing/subscription/start-succession.service';
import { closeServiceTestPool, getServiceTestDb, getServiceTestPool } from './helpers';
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

describe('HOS-2218: replace unapplied successor', () => {
    it('replaces an unapplied successor on every retry and cancels the old authorization', async () => {
        const choice = await seedSuccessionChoice();
        const seeded = await seedPredecessor({
            userId: choice.user.id,
            planVersionId: choice.planVersionId,
            billingOptionId: choice.predecessorBillingOptionId,
            status: 'ACTIVE',
            providerState: 'active',
            honestAboutM1: true
        });
        seeded.fake.restoreLie({ lie: 'M1' });
        const beforeCancel = vi.fn(async () => 'SENT' as const);
        const ports = { ...successionPorts(seeded.provider), beforeCancelNotice: { beforeCancel } };
        const request = {
            userId: choice.user.id,
            predecessorSubscriptionId: seeded.predecessor.id,
            billingOptionId: choice.targetBillingOptionId,
            returnUrl: successionReturnUrl
        };

        await expect(startSuccession(request, ports)).rejects.toMatchObject({
            reason: 'CREATION_NOT_APPLIED'
        });
        const [first] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.succeedsId, seeded.predecessor.id));
        if (!first) throw new Error('First successor is missing');
        const [firstLink] = await getServiceTestDb()
            .select()
            .from(providerLinks)
            .where(eq(providerLinks.subscriptionId, first!.id));
        if (!firstLink) throw new Error('First successor has no provider link');

        await expect(startSuccession(request, ports)).rejects.toMatchObject({
            reason: 'CREATION_NOT_APPLIED'
        });
        const successors = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.succeedsId, seeded.predecessor.id));
        const old = successors.find((row) => row.id === first.id);
        const current = successors.find((row) => row.id !== first.id);
        const [oldLink] = await getServiceTestDb()
            .select()
            .from(providerLinks)
            .where(eq(providerLinks.subscriptionId, first.id));
        const oldKey = await getServiceTestDb()
            .select()
            .from(idempotencyKeys)
            .where(eq(idempotencyKeys.subjectId, first.id));
        const events = await domainEventModel.findByEntity({
            entityType: 'subscription',
            entityId: first.id
        });
        const oldAuthorization = await seeded.fake.readAuthorization({
            authorizationId: firstLink.providerId
        });
        const predecessor = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.predecessor.id));

        expect(old).toMatchObject({ status: 'ABANDONED' });
        expect(oldLink?.providerId).toBe(firstLink.providerId);
        expect(current).toMatchObject({ status: 'PENDING_AUTHORIZATION' });
        expect(current?.firstChargeAt?.getMilliseconds()).toBe(0);
        expect(successors.filter((row) => row.status === 'ABANDONED')).toHaveLength(1);
        // HOS-2351: neither S39 nor S1 writes the predecessor pointer; S18 does at close.
        expect(predecessor[0]?.succeededById).toBeNull();
        expect(current?.succeedsId).toBe(predecessor[0]?.id);
        expect(oldKey[0]?.result).toMatchObject({ applied: false });
        expect(oldAuthorization.snapshot.status).toBe('cancelled');
        expect(beforeCancel).toHaveBeenCalledWith(
            expect.objectContaining({ kind: 'ATTEMPT_REPLACED' })
        );
        expect(events).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    eventType: 'subscription.provider_cancellation_decided',
                    reason: 'S39',
                    actorType: 'owner',
                    changes: expect.arrayContaining([
                        expect.objectContaining({
                            field: 'status',
                            old: 'PENDING_AUTHORIZATION',
                            new: 'ABANDONED'
                        })
                    ])
                })
            ])
        );

        await expect(startSuccession(request, ports)).rejects.toMatchObject({
            reason: 'CREATION_NOT_APPLIED'
        });
    });

    it('returns a checkout when the replacement creation applies and keeps predecessor courtesy open', async () => {
        const choice = await seedSuccessionChoice();
        const seeded = await seedPredecessor({
            userId: choice.user.id,
            planVersionId: choice.planVersionId,
            billingOptionId: choice.predecessorBillingOptionId,
            status: 'ACTIVE',
            providerState: 'active',
            honestAboutM1: true
        });
        const startsAt = new Date('2026-10-01T12:00:00.000Z');
        await getServiceTestDb()
            .insert(courtesyGrants)
            .values({
                beneficiaryUserId: choice.user.id,
                grantedBy: choice.user.id,
                subscriptionId: seeded.predecessor.id,
                months: 2,
                startsAt,
                endsAt: new Date('2027-01-01T12:00:00.000Z'),
                reason: 'fixture',
                balanceMonths: 2
            });
        let createdAuthorizationId: string | undefined;
        let forcedUnapplied = false;
        const realAuthorize = seeded.fake.authorize.bind(seeded.fake);
        vi.spyOn(seeded.fake, 'authorize').mockImplementation(async (input) => {
            const result = await realAuthorize(input);
            createdAuthorizationId = result.authorizationId;
            return result;
        });
        const realRead = seeded.fake.readAuthorization.bind(seeded.fake);
        vi.spyOn(seeded.fake, 'readAuthorization').mockImplementation(async (input) => {
            const result = await realRead(input);
            if (input.authorizationId !== createdAuthorizationId || forcedUnapplied) return result;
            forcedUnapplied = true;
            return {
                ...result,
                snapshot: { ...result.snapshot, cadence: { everyMonths: 12 } }
            };
        });
        const request = {
            userId: choice.user.id,
            predecessorSubscriptionId: seeded.predecessor.id,
            billingOptionId: choice.targetBillingOptionId,
            returnUrl: successionReturnUrl
        };
        const ports = successionPorts(seeded.provider);
        await expect(startSuccession(request, ports)).rejects.toMatchObject({
            reason: 'CREATION_NOT_APPLIED'
        });
        const [old] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.succeedsId, seeded.predecessor.id));
        const [oldLink] = await getServiceTestDb()
            .select()
            .from(providerLinks)
            .where(eq(providerLinks.subscriptionId, old!.id));
        if (!oldLink) throw new Error('Old successor provider link is missing');

        const result = await startSuccession(request, ports);
        expect(result.checkoutUrl).toBeDefined();
        const [abandoned] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, old!.id));
        const [key] = await getServiceTestDb()
            .select()
            .from(idempotencyKeys)
            .where(eq(idempotencyKeys.subjectId, result.subscriptionId));
        const [grant] = await getServiceTestDb()
            .select()
            .from(courtesyGrants)
            .where(eq(courtesyGrants.subscriptionId, seeded.predecessor.id));
        const oldAuthorization = await seeded.fake.readAuthorization({
            authorizationId: oldLink.providerId
        });
        expect(abandoned?.status).toBe('ABANDONED');
        expect(key?.result).toMatchObject({ applied: true });
        expect(oldAuthorization.snapshot.status).toBe('cancelled');
        expect(grant?.balanceMonths).toBe(2);
        expect(grant?.balanceClosedAt).toBeNull();
    });

    it('does not replace when the provider reread reports an authorized successor', async () => {
        const choice = await seedSuccessionChoice();
        const seeded = await seedPredecessor({
            userId: choice.user.id,
            planVersionId: choice.planVersionId,
            billingOptionId: choice.predecessorBillingOptionId,
            status: 'ACTIVE',
            providerState: 'active',
            honestAboutM1: true
        });
        seeded.fake.restoreLie({ lie: 'M1' });
        const request = {
            userId: choice.user.id,
            predecessorSubscriptionId: seeded.predecessor.id,
            billingOptionId: choice.targetBillingOptionId,
            returnUrl: successionReturnUrl
        };
        await expect(
            startSuccession(request, successionPorts(seeded.provider))
        ).rejects.toMatchObject({
            reason: 'CREATION_NOT_APPLIED'
        });
        const [old] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.succeedsId, seeded.predecessor.id));
        const [oldLink] = await getServiceTestDb()
            .select()
            .from(providerLinks)
            .where(eq(providerLinks.subscriptionId, old!.id));
        if (!oldLink) throw new Error('Old successor provider link is missing');
        await seeded.fake.approve({ authorizationId: oldLink.providerId });
        const cancel = vi.spyOn(seeded.fake, 'cancel');
        await expect(
            startSuccession(request, successionPorts(seeded.provider))
        ).rejects.toMatchObject({
            reason: 'SUCCESSION_IN_PROGRESS'
        });
        const [unchanged] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, old!.id));
        const events = await domainEventModel.findByEntity({
            entityType: 'subscription',
            entityId: old!.id
        });
        expect(unchanged?.status).toBe('PENDING_AUTHORIZATION');
        expect(events.some((event) => event.reason === 'S39')).toBe(false);
        expect(cancel).not.toHaveBeenCalled();
    });

    it('does not replace while the latest create key is still in flight', async () => {
        const choice = await seedSuccessionChoice();
        const seeded = await seedPredecessor({
            userId: choice.user.id,
            planVersionId: choice.planVersionId,
            billingOptionId: choice.predecessorBillingOptionId,
            status: 'ACTIVE',
            providerState: 'active',
            honestAboutM1: true
        });
        seeded.fake.restoreLie({ lie: 'M1' });
        const request = {
            userId: choice.user.id,
            predecessorSubscriptionId: seeded.predecessor.id,
            billingOptionId: choice.targetBillingOptionId,
            returnUrl: successionReturnUrl
        };
        await expect(
            startSuccession(request, successionPorts(seeded.provider))
        ).rejects.toMatchObject({
            reason: 'CREATION_NOT_APPLIED'
        });
        const [old] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.succeedsId, seeded.predecessor.id));
        const [oldLink] = await getServiceTestDb()
            .select()
            .from(providerLinks)
            .where(eq(providerLinks.subscriptionId, old!.id));
        if (!oldLink) throw new Error('Old successor provider link is missing');
        await getServiceTestDb()
            .update(idempotencyKeys)
            .set({ completedAt: null, result: null })
            .where(eq(idempotencyKeys.subjectId, old!.id));
        const read = vi.spyOn(seeded.fake, 'readAuthorization');
        await expect(
            startSuccession(request, successionPorts(seeded.provider))
        ).rejects.toMatchObject({
            reason: 'SUCCESSION_IN_PROGRESS'
        });
        expect(
            read.mock.calls.some(([input]) => input.authorizationId === oldLink.providerId)
        ).toBe(false);
    });

    it('does not replace when the latest create key already applied a checkout', async () => {
        const choice = await seedSuccessionChoice();
        const seeded = await seedPredecessor({
            userId: choice.user.id,
            planVersionId: choice.planVersionId,
            billingOptionId: choice.predecessorBillingOptionId,
            status: 'ACTIVE',
            providerState: 'active',
            honestAboutM1: true
        });
        seeded.fake.restoreLie({ lie: 'M1' });
        const request = {
            userId: choice.user.id,
            predecessorSubscriptionId: seeded.predecessor.id,
            billingOptionId: choice.targetBillingOptionId,
            returnUrl: successionReturnUrl
        };
        await expect(
            startSuccession(request, successionPorts(seeded.provider))
        ).rejects.toMatchObject({
            reason: 'CREATION_NOT_APPLIED'
        });
        const [old] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.succeedsId, seeded.predecessor.id));
        const [oldLink] = await getServiceTestDb()
            .select()
            .from(providerLinks)
            .where(eq(providerLinks.subscriptionId, old!.id));
        if (!oldLink) throw new Error('Old successor provider link is missing');
        await getServiceTestDb()
            .update(idempotencyKeys)
            .set({
                result: {
                    authorizationId: oldLink.providerId,
                    applied: true,
                    checkoutUrl: 'https://checkout.example/pay'
                }
            })
            .where(eq(idempotencyKeys.subjectId, old!.id));
        const cancel = vi.spyOn(seeded.fake, 'cancel');
        await expect(
            startSuccession(request, successionPorts(seeded.provider))
        ).rejects.toMatchObject({
            reason: 'SUCCESSION_IN_PROGRESS'
        });
        const [unchanged] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, old!.id));
        const events = await domainEventModel.findByEntity({
            entityType: 'subscription',
            entityId: old!.id
        });
        expect(unchanged?.status).toBe('PENDING_AUTHORIZATION');
        expect(events.some((event) => event.reason === 'S39')).toBe(false);
        expect(cancel).not.toHaveBeenCalled();
    });

    it('does not replace once the successor authorization window has expired', async () => {
        const choice = await seedSuccessionChoice();
        const seeded = await seedPredecessor({
            userId: choice.user.id,
            planVersionId: choice.planVersionId,
            billingOptionId: choice.predecessorBillingOptionId,
            status: 'ACTIVE',
            providerState: 'active',
            honestAboutM1: true
        });
        seeded.fake.restoreLie({ lie: 'M1' });
        const request = {
            userId: choice.user.id,
            predecessorSubscriptionId: seeded.predecessor.id,
            billingOptionId: choice.targetBillingOptionId,
            returnUrl: successionReturnUrl
        };
        await expect(
            startSuccession(request, successionPorts(seeded.provider))
        ).rejects.toMatchObject({
            reason: 'CREATION_NOT_APPLIED'
        });
        const [old] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.succeedsId, seeded.predecessor.id));
        await getServiceTestDb()
            .update(subscriptions)
            .set({ authorizationWindowEndsAt: new Date('2026-10-01T00:00:00.000Z') })
            .where(eq(subscriptions.id, old!.id));
        const cancel = vi.spyOn(seeded.fake, 'cancel');
        await expect(
            startSuccession(request, successionPorts(seeded.provider))
        ).rejects.toMatchObject({
            reason: 'SUCCESSION_IN_PROGRESS'
        });
        const [unchanged] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, old!.id));
        const events = await domainEventModel.findByEntity({
            entityType: 'subscription',
            entityId: old!.id
        });
        expect(unchanged?.status).toBe('PENDING_AUTHORIZATION');
        expect(events.some((event) => event.reason === 'S39')).toBe(false);
        expect(cancel).not.toHaveBeenCalled();
    });

    it('does not replace when the provider link does not match the create key', async () => {
        const choice = await seedSuccessionChoice();
        const seeded = await seedPredecessor({
            userId: choice.user.id,
            planVersionId: choice.planVersionId,
            billingOptionId: choice.predecessorBillingOptionId,
            status: 'ACTIVE',
            providerState: 'active',
            honestAboutM1: true
        });
        seeded.fake.restoreLie({ lie: 'M1' });
        const request = {
            userId: choice.user.id,
            predecessorSubscriptionId: seeded.predecessor.id,
            billingOptionId: choice.targetBillingOptionId,
            returnUrl: successionReturnUrl
        };
        await expect(
            startSuccession(request, successionPorts(seeded.provider))
        ).rejects.toMatchObject({
            reason: 'CREATION_NOT_APPLIED'
        });
        const [old] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.succeedsId, seeded.predecessor.id));
        const [oldLink] = await getServiceTestDb()
            .select()
            .from(providerLinks)
            .where(eq(providerLinks.subscriptionId, old!.id));
        if (!oldLink) throw new Error('Old successor provider link is missing');
        await getServiceTestDb()
            .update(providerLinks)
            .set({ providerId: crypto.randomUUID() })
            .where(eq(providerLinks.subscriptionId, old!.id));
        const read = vi.spyOn(seeded.fake, 'readAuthorization');
        await expect(
            startSuccession(request, successionPorts(seeded.provider))
        ).rejects.toMatchObject({
            reason: 'SUCCESSION_IN_PROGRESS'
        });
        const [unchanged] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, old!.id));
        const events = await domainEventModel.findByEntity({
            entityType: 'subscription',
            entityId: old!.id
        });
        expect(unchanged?.status).toBe('PENDING_AUTHORIZATION');
        expect(events.some((event) => event.reason === 'S39')).toBe(false);
        expect(
            read.mock.calls.some(([input]) => input.authorizationId === oldLink.providerId)
        ).toBe(false);
    });

    it('does not replace for a different requested billing option', async () => {
        const choice = await seedSuccessionChoice();
        const alternativePlanId = (
            await getServiceTestPool().query<{ id: string }>(
                'INSERT INTO plan (vertical, slug, name) VALUES ($1, $2, $3) RETURNING id',
                ['accommodation', `succession-alt-${crypto.randomUUID()}`, 'Alternative plan']
            )
        ).rows[0]?.id;
        if (!alternativePlanId) throw new Error('Alternative plan missing');
        const alternativeVersionId = (
            await getServiceTestPool().query<{ id: string }>(
                'INSERT INTO plan_version (plan_id, vertical, rank, sellable, current, trial_days, allows_pause) VALUES ($1, $2, $3, true, true, 0, false) RETURNING id',
                [alternativePlanId, 'accommodation', Math.floor(Math.random() * 100000000) + 1]
            )
        ).rows[0]?.id;
        if (!alternativeVersionId) throw new Error('Alternative plan version missing');
        const alternativeOptionId = (
            await getServiceTestPool().query<{ id: string }>(
                "INSERT INTO billing_option (plan_version_id, cycle, amount, currency) VALUES ($1, 'quarterly', 250000, 'ARS') RETURNING id",
                [alternativeVersionId]
            )
        ).rows[0]?.id;
        if (!alternativeOptionId) throw new Error('Alternative billing option missing');
        const seeded = await seedPredecessor({
            userId: choice.user.id,
            planVersionId: choice.planVersionId,
            billingOptionId: choice.predecessorBillingOptionId,
            status: 'ACTIVE',
            providerState: 'active',
            honestAboutM1: true
        });
        seeded.fake.restoreLie({ lie: 'M1' });
        const request = {
            userId: choice.user.id,
            predecessorSubscriptionId: seeded.predecessor.id,
            billingOptionId: choice.targetBillingOptionId,
            returnUrl: successionReturnUrl
        };
        await expect(
            startSuccession(request, successionPorts(seeded.provider))
        ).rejects.toMatchObject({
            reason: 'CREATION_NOT_APPLIED'
        });
        const [old] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.succeedsId, seeded.predecessor.id));
        const [oldLink] = await getServiceTestDb()
            .select()
            .from(providerLinks)
            .where(eq(providerLinks.subscriptionId, old!.id));
        if (!oldLink) throw new Error('Old successor provider link is missing');
        const read = vi.spyOn(seeded.fake, 'readAuthorization');
        await expect(
            startSuccession(
                { ...request, billingOptionId: alternativeOptionId },
                successionPorts(seeded.provider)
            )
        ).rejects.toMatchObject({ reason: 'SUCCESSION_IN_PROGRESS' });
        expect(
            read.mock.calls.some(([input]) => input.authorizationId === oldLink.providerId)
        ).toBe(false);
        const [unchanged] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, old!.id));
        expect(unchanged?.status).toBe('PENDING_AUTHORIZATION');
    });
});
