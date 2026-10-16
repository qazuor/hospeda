import { addonInstances, domainEventModel, eq, subscriptions } from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { cancelActiveSubscription } from '../../../src/services/billing/subscription/cancel-active-subscription.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    cancelActiveNow,
    retireCancelActiveRows,
    seedCancelActive
} from './support/cancel-active-fixtures.js';
import {
    providerHarness,
    retireComplementRows,
    seedCommittedComplement
} from './support/complement-fixtures.js';
import { outboxBeforeCancelNotice } from './support/outbox-before-cancel-notice.js';

const clock = { now: () => cancelActiveNow };
const owner = (id: string) => ({ id, roles: [], permissions: [] });
afterEach(async () => {
    await retireComplementRows();
    await retireCancelActiveRows();
});
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())('TEST:B8a:3 / TEST:1568:5 S11 complements', () => {
    it('TEST:B8a:3 (a,h): schedules seeded vertical/listing rows, leaves instances serving, and excludes USER with another live title', async () => {
        const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
        const principal = await seedCancelActive({ fake, payment: 'payment' });
        const seeded = await seedCommittedComplement({
            fake,
            principal: { userId: principal.userId, principalId: principal.subscriptionId },
            principalStatus: 'ACTIVE',
            otherStatus: 'ACTIVE',
            scopeTypes: ['VERTICAL_SUBSCRIPTION', 'LISTING', 'USER']
        });
        const inactive = await seedCommittedComplement({
            fake,
            principal: { userId: principal.userId, principalId: principal.subscriptionId },
            principalStatus: 'ACTIVE',
            scopeType: 'VERTICAL_SUBSCRIPTION',
            complementStatus: 'PAUSED'
        });
        const cancel = vi.spyOn(fake, 'cancel');
        const read = vi.spyOn(fake, 'readAuthorization');
        const notice = outboxBeforeCancelNotice({ deliver: true });
        const sendNotice = vi.spyOn(notice, 'beforeCancel');
        const result = await cancelActiveSubscription(
            { actor: owner(principal.userId), subscriptionId: principal.subscriptionId },
            {
                provider: fake,
                clock,
                beforeCancelNotice: notice,
                coverageNotices: { emitCoverageChanged: async () => undefined },
                complements: seeded.policy
            }
        );
        expect(result.outcome).toBe('SCHEDULED');
        if (result.outcome !== 'SCHEDULED') throw new Error('expected scheduled result');
        expect(result.complements.decided).toBe(2);
        expect(result.complements.calls).toHaveLength(2);
        expect(cancel).toHaveBeenCalledTimes(3);
        expect(read).toHaveBeenCalledTimes(6);
        expect(sendNotice).toHaveBeenCalledTimes(3);
        const [principalRow] = await getServiceTestDb()
            .select({ serviceEndsAt: subscriptions.serviceEndsAt })
            .from(subscriptions)
            .where(eq(subscriptions.id, principal.subscriptionId));
        for (const addon of seeded.addons.slice(0, 2)) {
            const [row] = await getServiceTestDb()
                .select({
                    status: subscriptions.status,
                    serviceEndsAt: subscriptions.serviceEndsAt
                })
                .from(subscriptions)
                .where(eq(subscriptions.id, addon.complementId));
            expect(row).toEqual({
                status: 'CANCEL_SCHEDULED',
                serviceEndsAt: principalRow?.serviceEndsAt
            });
            const [instance] = await getServiceTestDb()
                .select({ status: addonInstances.status })
                .from(addonInstances)
                .where(eq(addonInstances.id, addon.instanceId));
            expect(instance?.status).toBe('ACTIVE');
            const events = await domainEventModel.findByEntity({
                entityType: 'subscription',
                entityId: addon.complementId
            });
            expect(
                events.some(
                    (event) =>
                        event.eventType === 'subscription.provider_cancellation_decided' &&
                        event.reason === 'S11'
                )
            ).toBe(true);
        }
        const [userAddon] = await getServiceTestDb()
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.addons[2]!.complementId));
        const [inactiveRow] = await getServiceTestDb()
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, inactive.complementId));
        expect(userAddon?.status).toBe('ACTIVE');
        expect(inactiveRow?.status).toBe('PAUSED');
        expect(result.serviceEndsAt.getTime()).toBeGreaterThan(cancelActiveNow.getTime());
    });

    it('TEST:B8a:3 (b): USER enters when the other compatible title is scheduled, uses its later end, and anchor blocks entry', async () => {
        const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
        const principal = await seedCancelActive({ fake, payment: 'payment' });
        const seeded = await seedCommittedComplement({
            fake,
            principal: { userId: principal.userId, principalId: principal.subscriptionId },
            principalStatus: 'ACTIVE',
            otherStatus: 'ACTIVE',
            scopeType: 'USER'
        });
        if (!seeded.otherPrincipalId) throw new Error('other principal missing');
        const later = new Date('2027-02-01T00:00:00.000Z');
        await getServiceTestDb()
            .update(subscriptions)
            .set({ status: 'CANCEL_SCHEDULED', serviceEndsAt: later })
            .where(eq(subscriptions.id, seeded.otherPrincipalId));
        const result = await cancelActiveSubscription(
            { actor: owner(principal.userId), subscriptionId: principal.subscriptionId },
            {
                provider: fake,
                clock,
                beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }),
                coverageNotices: { emitCoverageChanged: async () => undefined },
                complements: seeded.policy
            }
        );
        expect(result).toMatchObject({ outcome: 'SCHEDULED', complements: { decided: 1 } });
        const [row] = await getServiceTestDb()
            .select({ status: subscriptions.status, serviceEndsAt: subscriptions.serviceEndsAt })
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.complementId));
        expect(row).toEqual({ status: 'CANCEL_SCHEDULED', serviceEndsAt: later });

        const earlierFake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
        const earlierPrincipal = await seedCancelActive({ fake: earlierFake, payment: 'payment' });
        const earlier = await seedCommittedComplement({
            fake: earlierFake,
            principal: {
                userId: earlierPrincipal.userId,
                principalId: earlierPrincipal.subscriptionId
            },
            principalStatus: 'ACTIVE',
            otherStatus: 'ACTIVE',
            scopeType: 'USER'
        });
        if (!earlier.otherPrincipalId) throw new Error('earlier other principal missing');
        await getServiceTestDb()
            .update(subscriptions)
            .set({
                status: 'CANCEL_SCHEDULED',
                serviceEndsAt: new Date('2026-10-20T00:00:00.000Z')
            })
            .where(eq(subscriptions.id, earlier.otherPrincipalId));
        const earlierResult = await cancelActiveSubscription(
            {
                actor: owner(earlierPrincipal.userId),
                subscriptionId: earlierPrincipal.subscriptionId
            },
            {
                provider: earlierFake,
                clock,
                beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }),
                coverageNotices: { emitCoverageChanged: async () => undefined },
                complements: earlier.policy
            }
        );
        if (earlierResult.outcome !== 'SCHEDULED') throw new Error('expected scheduled result');
        const [earlierRow] = await getServiceTestDb()
            .select({ serviceEndsAt: subscriptions.serviceEndsAt })
            .from(subscriptions)
            .where(eq(subscriptions.id, earlier.complementId));
        expect(earlierRow?.serviceEndsAt).toEqual(earlierResult.serviceEndsAt);

        const anchoredFake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
        const anchoredPrincipal = await seedCancelActive({
            fake: anchoredFake,
            payment: 'payment'
        });
        const anchored = await seedCommittedComplement({
            fake: anchoredFake,
            principal: {
                userId: anchoredPrincipal.userId,
                principalId: anchoredPrincipal.subscriptionId
            },
            principalStatus: 'ACTIVE',
            otherStatus: 'ACTIVE',
            scopeType: 'USER'
        });
        if (!anchored.otherPrincipalId) throw new Error('anchored other principal missing');
        await getServiceTestDb()
            .update(subscriptions)
            .set({ status: 'CANCEL_SCHEDULED', serviceEndsAt: later })
            .where(eq(subscriptions.id, anchored.otherPrincipalId));
        const anchoredResult = await cancelActiveSubscription(
            {
                actor: owner(anchoredPrincipal.userId),
                subscriptionId: anchoredPrincipal.subscriptionId
            },
            {
                provider: anchoredFake,
                clock,
                beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }),
                coverageNotices: { emitCoverageChanged: async () => undefined },
                complements: {
                    ...anchored.policy,
                    liveAnchors: { hasLiveAnchor: async () => true }
                }
            }
        );
        expect(anchoredResult).toMatchObject({ outcome: 'SCHEDULED', complements: { decided: 0 } });
        const [stillActive] = await getServiceTestDb()
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, anchored.complementId));
        expect(stillActive?.status).toBe('ACTIVE');
    });

    it('TEST:1568:5 (c): policy failures roll back S11 before any provider call', async () => {
        const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
        const principal = await seedCancelActive({ fake, payment: 'payment' });
        const seeded = await seedCommittedComplement({
            fake,
            principal: { userId: principal.userId, principalId: principal.subscriptionId },
            principalStatus: 'ACTIVE',
            scopeType: 'VERTICAL_SUBSCRIPTION'
        });
        const cancel = vi.spyOn(fake, 'cancel');
        await expect(
            cancelActiveSubscription(
                { actor: owner(principal.userId), subscriptionId: principal.subscriptionId },
                {
                    provider: fake,
                    clock,
                    beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }),
                    coverageNotices: { emitCoverageChanged: async () => undefined },
                    complements: {
                        ...seeded.policy,
                        addonPolicy: async () => {
                            throw new Error('policy failed');
                        }
                    }
                }
            )
        ).rejects.toThrow('policy failed');
        const [row] = await getServiceTestDb()
            .select({ status: subscriptions.status, serviceEndsAt: subscriptions.serviceEndsAt })
            .from(subscriptions)
            .where(eq(subscriptions.id, principal.subscriptionId));
        expect(row).toEqual({ status: 'ACTIVE', serviceEndsAt: null });
        expect(cancel).not.toHaveBeenCalled();
        const events = await domainEventModel.findByEntity({
            entityType: 'subscription',
            entityId: principal.subscriptionId
        });
        expect(
            events.some(
                (event) =>
                    event.eventType === 'subscription.provider_cancellation_decided' &&
                    event.reason === 'S11'
            )
        ).toBe(false);
    });

    it('TEST:B8a:3 (d,e,f): defers pending notices, isolates provider failures, and makes repeated S11 idempotent', async () => {
        const harness = providerHarness();
        const principal = await seedCancelActive({ fake: harness.fake, payment: 'payment' });
        const seeded = await seedCommittedComplement({
            fake: harness.fake,
            principal: { userId: principal.userId, principalId: principal.subscriptionId },
            principalStatus: 'ACTIVE',
            scopeTypes: ['VERTICAL_SUBSCRIPTION', 'LISTING']
        });
        const cancel = vi.spyOn(harness.fake, 'cancel');
        const pending = await cancelActiveSubscription(
            { actor: owner(principal.userId), subscriptionId: principal.subscriptionId },
            {
                provider: harness.provider,
                clock,
                beforeCancelNotice: outboxBeforeCancelNotice(),
                coverageNotices: { emitCoverageChanged: async () => undefined },
                complements: seeded.policy
            }
        );
        expect(pending).toMatchObject({ outcome: 'SCHEDULED', complements: { decided: 2 } });
        if (pending.outcome !== 'SCHEDULED') throw new Error('expected scheduled result');
        expect(pending.cancelCall).toBe('NOTICE_PENDING');
        expect(cancel).not.toHaveBeenCalled();
        expect(
            pending.complements.calls.every((call) => call.cancelCall === 'NOTICE_PENDING')
        ).toBe(true);
        const decisions = await Promise.all(
            seeded.addons.map(async (addon) =>
                domainEventModel.findByEntity({
                    entityType: 'subscription',
                    entityId: addon.complementId
                })
            )
        );
        expect(
            decisions
                .flat()
                .filter(
                    (event) =>
                        event.eventType === 'subscription.provider_cancellation_decided' &&
                        event.reason === 'S11'
                )
        ).toHaveLength(2);
        const cancelCallsBeforeRepeat = harness.calls.length;
        await getServiceTestDb()
            .update(subscriptions)
            .set({ status: 'ACTIVE', serviceEndsAt: null })
            .where(eq(subscriptions.id, seeded.complementId));
        const repeated = await cancelActiveSubscription(
            { actor: owner(principal.userId), subscriptionId: principal.subscriptionId },
            {
                provider: harness.provider,
                clock,
                beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }),
                coverageNotices: { emitCoverageChanged: async () => undefined },
                complements: seeded.policy
            }
        );
        expect(repeated.outcome).toBe('ALREADY_SCHEDULED');
        expect(repeated).toMatchObject({ complements: { decided: 0, calls: [] } });
        expect(cancel).not.toHaveBeenCalled();
        expect(harness.calls).toHaveLength(cancelCallsBeforeRepeat);
        const [row] = await getServiceTestDb()
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.complementId));
        expect(row?.status).toBe('ACTIVE');
        const decisionsAfterRepeat = await domainEventModel.findByEntity({
            entityType: 'subscription',
            entityId: seeded.complementId
        });
        expect(
            decisionsAfterRepeat.filter(
                (event) =>
                    event.eventType === 'subscription.provider_cancellation_decided' &&
                    event.reason === 'S11'
            )
        ).toHaveLength(1);

        const failedHarness = providerHarness({ readThrows: true });
        const failedPrincipal = await seedCancelActive({
            fake: failedHarness.fake,
            payment: 'payment'
        });
        const failedSeed = await seedCommittedComplement({
            fake: failedHarness.fake,
            principal: {
                userId: failedPrincipal.userId,
                principalId: failedPrincipal.subscriptionId
            },
            principalStatus: 'ACTIVE',
            scopeType: 'VERTICAL_SUBSCRIPTION'
        });
        const failed = await cancelActiveSubscription(
            {
                actor: owner(failedPrincipal.userId),
                subscriptionId: failedPrincipal.subscriptionId
            },
            {
                provider: failedHarness.provider,
                clock,
                beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }),
                coverageNotices: { emitCoverageChanged: async () => undefined },
                complements: failedSeed.policy
            }
        );
        expect(failed).toMatchObject({ outcome: 'SCHEDULED', complements: { decided: 1 } });
        if (failed.outcome !== 'SCHEDULED') throw new Error('expected scheduled result');
        expect(failed.complements.calls).toEqual([
            { subscriptionId: failedSeed.complementId, cancelCall: 'FAILED' }
        ]);
        const [stillScheduled] = await getServiceTestDb()
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, failedSeed.complementId));
        expect(stillScheduled?.status).toBe('CANCEL_SCHEDULED');
    });

    it('TEST:B8a:3 (g): cancels card complements for a manual principal without calling its provider', async () => {
        const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
        const principal = await seedCancelActive({
            fake,
            payment: 'payment',
            paymentMethod: 'MANUAL'
        });
        const seeded = await seedCommittedComplement({
            fake,
            principal: { userId: principal.userId, principalId: principal.subscriptionId },
            principalStatus: 'ACTIVE',
            scopeType: 'VERTICAL_SUBSCRIPTION'
        });
        const cancel = vi.spyOn(fake, 'cancel');
        const result = await cancelActiveSubscription(
            { actor: owner(principal.userId), subscriptionId: principal.subscriptionId },
            {
                provider: fake,
                clock,
                beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }),
                coverageNotices: { emitCoverageChanged: async () => undefined },
                complements: seeded.policy
            }
        );
        expect(result).toMatchObject({
            outcome: 'SCHEDULED',
            cancelCall: 'NOT_APPLICABLE',
            complements: { decided: 1 }
        });
        expect(cancel).toHaveBeenCalledTimes(1);
    });
});
