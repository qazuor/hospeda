/**
 * HOS-1883: the ending and conversion facts through their REAL producers, not hand-built
 * endings: S12 phase 1 (ORPHANED) and phase 2 with the S12 override (AC-10, AC-11), A6 on a
 * purged listing (AC-11), a grant revocation of a free instance (§5.3: nothing), S20 on a
 * pending add-on (AC-20) and A3 activating a purchase the provider authorized (AC-3).
 */
import { eq, providerLinks } from '@repo/db';
import { VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { cancelPurgedListingAddon } from '../../../src/services/billing/addon/addon-instance-a6';
import { chooseFreeAddon } from '../../../src/services/billing/addon/choose-free-addon.service';
import { expireAddonAuthorizationWindows } from '../../../src/services/billing/addon/expire-addon-authorization-windows.service';
import { purchaseAddon } from '../../../src/services/billing/addon/purchase-addon.service';
import { grantPermanentGrant } from '../../../src/services/billing/grant/permanent-grant.service';
import { endScheduledServices } from '../../../src/services/billing/subscription/end-scheduled-services.service';
import {
    closeServiceTestPool,
    getServiceTestDb,
    isServiceTestDbAvailable,
    withServiceTestTransaction
} from './helpers';
import { payingPrincipal } from './support/addon-a2-fixtures';
import { createA6Fixture, retireA6Fixtures } from './support/addon-a6-fixtures';
import {
    addonFactSpy,
    addonFactSubjectOf,
    lifetimeDaysBetween,
    secondsBetween
} from './support/addon-fact-subject';
import { freeChoiceFixture, retireFreeChoiceFixtures } from './support/addon-free-choice-fixtures';
import { seedOrphanInstance, seedOrphanOwner } from './support/addon-orphan-fixtures';
import { purchaseFixture, retirePurchaseFixtures } from './support/addon-purchase-fixtures';
import { seedCoveragePayment, seedCoverageUser } from './support/coverage-fixtures';
import { outboxBeforeCancelNotice } from './support/outbox-before-cancel-notice';
import {
    currentFloorPolicy,
    grantSignerActor,
    retirePermanentGrantRows,
    seedGrantPlan
} from './support/permanent-grant-fixtures';
import {
    fakePreapproval,
    seedServiceEndComplement,
    seedServiceEndPrincipal,
    serviceEndHarness,
    serviceEndPast,
    serviceEndPorts
} from './support/service-end-fixtures';

const V = VerticalEnum.ACCOMMODATION;
const W = VerticalEnum.VENUE;
const HOUR = 3_600_000;
const grantUsers: string[] = [];

afterEach(async () => {
    vi.restoreAllMocks();
    await retireA6Fixtures();
    await retireFreeChoiceFixtures();
    await retirePurchaseFixtures();
    await retirePermanentGrantRows(grantUsers.splice(0));
});
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())('HOS-1883 add-on facts: real ending producers', () => {
    it('S12: phase 1 orphanhood emits ORPHANED, phase 2 emits SERVICE_END with was_scheduled (AC-10, AC-11)', async () => {
        await withServiceTestTransaction(async (tx) => {
            // Arrange: a scheduled principal; a LISTING complement it orphans (phase 1) and a
            // USER complement still live through another paying principal (phase 2).
            const h = serviceEndHarness();
            const F = serviceEndPast;
            const { userId: U } = await seedOrphanOwner(tx);
            await seedServiceEndPrincipal(tx, {
                userId: U,
                vertical: V,
                status: 'CANCEL_SCHEDULED',
                serviceEndsAt: F
            });
            const { ports, setListing } = serviceEndPorts(tx, h);
            const listingId = crypto.randomUUID();
            setListing(listingId, { vertical: V, ownerId: U, acceptsFeature: true });
            const { subscriptionId: CL } = await seedServiceEndComplement(tx, {
                userId: U,
                vertical: V,
                status: 'CANCEL_SCHEDULED',
                serviceEndsAt: F,
                authorizationId: await fakePreapproval(h.fake, { cancelled: true })
            });
            await seedCoveragePayment(tx, { subscriptionId: CL, status: 'SUCCEEDED' });
            const { instanceId: listingInstance } = await seedOrphanInstance(tx, {
                ownerId: U,
                scopeType: 'LISTING',
                compatibleVerticals: [V],
                status: 'ACTIVE',
                targetId: listingId,
                complementSubscriptionId: CL
            });
            const { subscriptionId: CU } = await seedServiceEndComplement(tx, {
                userId: U,
                vertical: V,
                status: 'CANCEL_SCHEDULED',
                serviceEndsAt: F,
                authorizationId: await fakePreapproval(h.fake, { cancelled: true })
            });
            const { instanceId: userInstance } = await seedOrphanInstance(tx, {
                ownerId: U,
                scopeType: 'USER',
                compatibleVerticals: [V, W],
                status: 'ACTIVE',
                complementSubscriptionId: CU
            });
            const { subscriptionId: PW } = await seedServiceEndPrincipal(tx, {
                userId: U,
                vertical: W,
                status: 'ACTIVE'
            });
            await seedCoveragePayment(tx, { subscriptionId: PW, status: 'SUCCEEDED' });
            const listingBefore = await addonFactSubjectOf({ instanceId: listingInstance, db: tx });
            const userBefore = await addonFactSubjectOf({ instanceId: userInstance, db: tx });
            const spy = addonFactSpy();

            // Act
            await endScheduledServices(
                { limit: 100, db: tx },
                { ...ports, billingFacts: spy.sink }
            );

            // Assert
            const now = h.clock.now();
            const startsOf = (startsAt: Date | null) => {
                if (!startsAt) throw new Error('startsAt missing');
                return startsAt;
            };
            expect(spy.addonFacts()).toEqual([
                {
                    kind: 'ADDON_CANCELLED',
                    ...listingBefore.subject,
                    actorKind: 'SYSTEM',
                    occurredAt: now,
                    path: 'ORPHANED',
                    wasScheduled: true,
                    lifetimeDays: lifetimeDaysBetween(
                        startsOf(listingBefore.instance.startsAt),
                        now
                    )
                },
                {
                    kind: 'ADDON_CANCELLED',
                    ...userBefore.subject,
                    actorKind: 'SYSTEM',
                    occurredAt: now,
                    path: 'SERVICE_END',
                    wasScheduled: true,
                    lifetimeDays: lifetimeDaysBetween(startsOf(userBefore.instance.startsAt), now)
                }
            ]);
        });
    });

    it('A6 on a purged listing emits addon_cancelled LISTING_PURGED (AC-11)', async () => {
        // Arrange
        const h = await createA6Fixture({ status: 'ACTIVE' });
        await h.verticals.purgeListing({ listingId: h.listingId });
        const before = await addonFactSubjectOf({ instanceId: h.instanceId });
        const startsAt = before.instance.startsAt;
        if (!startsAt) throw new Error('startsAt missing');
        const spy = addonFactSpy();
        const emit = vi.fn(spy.sink.emit);
        const cancel = vi.spyOn(h.f.fake, 'cancel');

        // Act
        const result = await cancelPurgedListingAddon(
            { instanceId: h.instanceId, correlationId: crypto.randomUUID() },
            { ...h.ports, billingFacts: { emit } }
        );

        // Assert: the provider call happened before the analytics fact.
        expect(result.outcome).toBe('CANCELLED');
        expect(cancel).toHaveBeenCalledTimes(1);
        expect(cancel.mock.invocationCallOrder[0]).toBeLessThan(
            emit.mock.invocationCallOrder[0] ?? 0
        );
        const now = h.f.ports.clock.now();
        expect(spy.addonFacts()).toEqual([
            {
                kind: 'ADDON_CANCELLED',
                ...before.subject,
                actorKind: 'SYSTEM',
                occurredAt: now,
                path: 'LISTING_PURGED',
                wasScheduled: false,
                lifetimeDays: lifetimeDaysBetween(startsAt, now)
            }
        ]);
    });

    it('revoking the grant of a free add-on emits nothing, not even GRANT_REVOKED (§5.3, AC-11)', async () => {
        // Arrange
        const f = await freeChoiceFixture();
        const chosen = await chooseFreeAddon(f.freeInput(), f.freePorts);
        if (chosen.outcome !== 'CREATED') throw new Error('Free choice missing');
        const spy = addonFactSpy();

        // Act
        const revoked = await f.revoke(spy.sink);

        // Assert
        expect(revoked.cancelledAddonInstanceIds).toContain(chosen.instanceId);
        expect(spy.addonFacts()).toEqual([]);
    });

    it('S20 on a pending add-on emits abandoned CLOSED_BY_SYSTEM, never granted_free (AC-20)', async () => {
        // Arrange
        const f = await purchaseFixture({ chargeKind: 'PERIODICO' });
        await payingPrincipal(f);
        const bought = await purchaseAddon(f.input(), f.ports);
        if (bought.outcome !== 'CREATED') throw new Error('Purchase missing');
        const pending = await addonFactSubjectOf({ instanceId: bought.instanceId });
        const admin = await seedCoverageUser(getServiceTestDb());
        grantUsers.push(f.ownerId, admin.userId);
        const plan = await seedGrantPlan(getServiceTestDb(), 'accommodation');
        const spy = addonFactSpy();

        // Act
        await grantPermanentGrant(
            {
                beneficiaryUserId: f.ownerId,
                actor: grantSignerActor(admin.userId),
                reason: 'S20 pending analytics integration test',
                includesAddons: true,
                anchors: [{ vertical: 'accommodation', ...plan }]
            },
            {
                planPolicy: currentFloorPolicy,
                clock: f.ports.clock,
                provider: f.fake,
                billingFacts: spy.sink,
                beforeCancelNotice: { beforeCancel: async () => 'SENT' as const },
                coverageNotices: { emitCoverageChanged: async () => {} },
                orphanhood: { addonPolicy: f.ports.addonPolicy, listing: f.ports.listing }
            }
        );

        // Assert
        const now = f.ports.clock.now();
        expect(spy.addonFacts()).toEqual([
            {
                kind: 'ADDON_CHECKOUT_ABANDONED',
                ...pending.subject,
                actorKind: 'SYSTEM',
                occurredAt: now,
                reason: 'CLOSED_BY_SYSTEM',
                secondsInPending: secondsBetween(pending.instance.createdAt, now)
            }
        ]);
    });

    it('A3 activating a purchase the provider authorized emits addon_activated once (AC-3)', async () => {
        // Arrange
        const f = await purchaseFixture({ chargeKind: 'PERIODICO' });
        await payingPrincipal(f);
        const bought = await purchaseAddon(f.input(), f.ports);
        if (bought.outcome !== 'CREATED') throw new Error('Purchase missing');
        const pending = await addonFactSubjectOf({ instanceId: bought.instanceId });
        const complementId = pending.instance.complementSubscriptionId;
        if (!complementId) throw new Error('Complement missing');
        const [link] = await getServiceTestDb()
            .select()
            .from(providerLinks)
            .where(eq(providerLinks.subscriptionId, complementId));
        if (!link) throw new Error('Addon preapproval missing');
        await f.fake.approve({ authorizationId: link.providerId });
        f.advanceTo(new Date(pending.instance.createdAt.getTime() + 73 * HOUR));
        const spy = addonFactSpy();
        const ports = {
            ...f.ports,
            beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }),
            coverageNotices: { emitCoverageChanged: async () => {} },
            billingFacts: spy.sink
        };

        // Act
        const first = await expireAddonAuthorizationWindows(100, ports);
        const second = await expireAddonAuthorizationWindows(100, ports);

        // Assert
        expect(first.activated).toBeGreaterThanOrEqual(1);
        expect(second.activated).toBe(0);
        const active = await addonFactSubjectOf({ instanceId: bought.instanceId });
        const startsAt = active.instance.startsAt;
        if (!startsAt) throw new Error('startsAt missing');
        expect(
            spy
                .addonFacts()
                .filter(
                    (fact) =>
                        'addonInstanceId' in fact && fact.addonInstanceId === bought.instanceId
                )
        ).toEqual([
            {
                kind: 'ADDON_ACTIVATED',
                ...active.subject,
                actorKind: 'SYSTEM',
                occurredAt: startsAt,
                amountMinor: active.price,
                currency: 'ARS',
                cycle: 'monthly',
                secondsInPending: secondsBetween(active.instance.createdAt, startsAt)
            }
        ]);
    });
});
