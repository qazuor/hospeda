import {
    addonInstances,
    and,
    coveredPeriods,
    domainEventModel,
    eq,
    inArray,
    payments,
    reconciliationMarkPayments,
    reconciliationMarks,
    subscriptionPauses,
    subscriptions
} from '@repo/db';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { cancelActiveSubscription } from '../../../src/services/billing/subscription/cancel-active-subscription.service';
import { pauseComplementsS32 } from '../../../src/services/billing/subscription/complement-pause-s32';
import { resumeComplementsS33 } from '../../../src/services/billing/subscription/complement-resume-s33';
import { endScheduledServices } from '../../../src/services/billing/subscription/end-scheduled-services.service';
import { closeServiceTestPool, getServiceTestDb } from './helpers';
import { seedComplementCharge } from './support/addon-orphan-fixtures';
import {
    activeRecurringExitFixture,
    cachedExitAddonPolicy,
    listingExitFixture,
    retireExitFixtures
} from './support/b10-exit-fixtures';
import { payingVenueExitPrincipal } from './support/b10-exit-fixtures-2';

type ExitFixture = Awaited<ReturnType<typeof activeRecurringExitFixture>>;
const chargeIds: string[] = [];
const actor = (id: string) => ({ id, roles: [], permissions: [] });
const policy = async (h: ExitFixture) => ({
    addonPolicy: await cachedExitAddonPolicy(h.f.versionId),
    listing: h.f.ports.listing,
    liveAnchors: h.f.ports.liveAnchors
});
const ports = async (h: ExitFixture) => ({
    provider: h.f.fake,
    clock: h.f.ports.clock,
    beforeCancelNotice: { beforeCancel: async () => 'SENT' as const },
    coverageNotices: { emitCoverageChanged: async () => undefined },
    complements: await policy(h)
});
const readRows = async (h: ExitFixture) => {
    return getServiceTestDb()
        .select({
            id: subscriptions.id,
            status: subscriptions.status,
            end: subscriptions.serviceEndsAt
        })
        .from(subscriptions)
        .where(and(eq(subscriptions.userId, h.f.ownerId)));
};

// Catalog addon, addon_version, product, plan/version/option and provider payment facts are seeded.
// Both principal subscriptions start through S1/S2; each addon starts through A1/A2.
afterEach(async () => {
    await retireExitFixtures();
    const ids = chargeIds.splice(0);
    if (ids.length > 0) {
        await getServiceTestDb()
            .delete(coveredPeriods)
            .where(inArray(coveredPeriods.paymentId, ids));
        await getServiceTestDb().delete(payments).where(inArray(payments.id, ids));
    }
    vi.restoreAllMocks();
});
afterAll(closeServiceTestPool);

describe('TEST:B10:10 AC:B10:9 LISTA:B10 cut clauses re-run on A1 rows (B7, B8a)', () => {
    it('LISTA:B10 clause 1 S11 cancels the dependent A1 preapproval immediately while its instance keeps serving', async () => {
        const h = await activeRecurringExitFixture('VERTICAL_SUBSCRIPTION');
        const cancel = vi.spyOn(h.f.fake, 'cancel');
        const result = await cancelActiveSubscription(
            { actor: actor(h.f.ownerId), subscriptionId: h.principalId },
            await ports(h)
        );
        expect(result.outcome).toBe('SCHEDULED');
        const rows = await readRows(h);
        const principal = rows.find((r) => r.id === h.principalId);
        const complement = rows.find((r) => r.id === h.complementId);
        expect(principal).toMatchObject({ status: 'CANCEL_SCHEDULED', end: expect.any(Date) });
        expect(complement).toMatchObject({ status: 'CANCEL_SCHEDULED', end: principal?.end });
        const [instance] = await getServiceTestDb()
            .select({ status: addonInstances.status })
            .from(addonInstances)
            .where(eq(addonInstances.id, h.instanceId));
        expect(instance).toEqual({ status: 'ACTIVE' });
        const authorization = await h.f.fake.readAuthorization({
            authorizationId: h.authorizationId
        });
        expect(authorization.snapshot.status).toBe('cancelled');
        expect(
            cancel.mock.calls.filter(([call]) => call.authorizationId === h.authorizationId)
        ).toHaveLength(1);
        const events = await domainEventModel.findByEntity({
            entityType: 'subscription',
            entityId: h.complementId
        });
        expect(
            events
                .filter((e) => e.eventType === 'subscription.provider_cancellation_decided')
                .map((e) => e.reason)
        ).toEqual(['S11']);
    });

    it('LISTA:B10 clause 2 a USER A1 preapproval survives the first vertical S11 and cancels on the second without another cycle', async () => {
        const h = await activeRecurringExitFixture('USER', ['accommodation', 'venue']);
        const venueId = await payingVenueExitPrincipal(h.f);
        const cancel = vi.spyOn(h.f.fake, 'cancel');
        const first = await cancelActiveSubscription(
            { actor: actor(h.f.ownerId), subscriptionId: h.principalId },
            await ports(h)
        );
        expect(first.outcome).toBe('SCHEDULED');
        let rows = await readRows(h);
        expect(rows.find((r) => r.id === h.complementId)?.status).toBe('ACTIVE');
        expect(
            (await h.f.fake.readAuthorization({ authorizationId: h.authorizationId })).snapshot
                .status
        ).toBe('active');
        expect(
            cancel.mock.calls.filter(([call]) => call.authorizationId === h.authorizationId)
        ).toHaveLength(0);
        const second = await cancelActiveSubscription(
            { actor: actor(h.f.ownerId), subscriptionId: venueId },
            await ports(h)
        );
        expect(second.outcome).toBe('SCHEDULED');
        rows = await readRows(h);
        const firstEnd = rows.find((r) => r.id === h.principalId)?.end;
        const secondEnd = rows.find((r) => r.id === venueId)?.end;
        const expectedEnd = new Date(Math.max(firstEnd?.getTime() ?? 0, secondEnd?.getTime() ?? 0));
        expect(rows.find((r) => r.id === h.complementId)).toMatchObject({
            status: 'CANCEL_SCHEDULED',
            end: expectedEnd
        });
        expect(
            (await h.f.fake.readAuthorization({ authorizationId: h.authorizationId })).snapshot
                .status
        ).toBe('cancelled');
        expect(
            cancel.mock.calls.filter(([call]) => call.authorizationId === h.authorizationId)
        ).toHaveLength(1);
        const again = await cancelActiveSubscription(
            { actor: actor(h.f.ownerId), subscriptionId: venueId },
            await ports(h)
        );
        expect(again.outcome).toBe('ALREADY_SCHEDULED');
        expect(
            cancel.mock.calls.filter(([call]) => call.authorizationId === h.authorizationId)
        ).toHaveLength(1);
    });

    it.each([
        'PAUSED',
        'ACTIVE'
    ] as const)('LISTA:B10 clause 3 a USER A1 addon with the other vertical %s pauses on title death only when unsupported and resumes by S33', async (otherStatus) => {
        const h = await activeRecurringExitFixture('USER', ['accommodation', 'venue']);
        const venueId = await payingVenueExitPrincipal(h.f);
        await getServiceTestDb()
            .update(subscriptions)
            .set({ status: otherStatus })
            .where(eq(subscriptions.id, venueId));
        // The title death and other-vertical pause are seeded states after real starts.
        await getServiceTestDb()
            .update(subscriptions)
            .set({ status: 'CANCELLED' })
            .where(eq(subscriptions.id, h.principalId));
        const paused = await pauseComplementsS32(
            { principalSubscriptionId: h.principalId, trigger: 'PRINCIPAL_LEFT_LIVE_ROWS' },
            { provider: h.f.fake, clock: h.f.ports.clock, policy: await policy(h) }
        );
        const [row] = await getServiceTestDb()
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, h.complementId));
        if (otherStatus === 'PAUSED') {
            expect(paused.results).toMatchObject([
                { complementSubscriptionId: h.complementId, outcome: 'PAUSED' }
            ]);
            expect(row).toEqual({ status: 'PAUSED' });
            expect(
                (await h.f.fake.readAuthorization({ authorizationId: h.authorizationId })).snapshot
                    .status
            ).toBe('paused');
            await getServiceTestDb()
                .update(subscriptions)
                .set({ status: 'ACTIVE' })
                .where(eq(subscriptions.id, venueId));
            const resumed = await resumeComplementsS33(
                { principalSubscriptionId: venueId, trigger: 'PRINCIPAL_ACTIVE' },
                { provider: h.f.fake, clock: h.f.ports.clock, policy: await policy(h) }
            );
            expect(resumed.results).toMatchObject([
                { complementSubscriptionId: h.complementId, outcome: 'REACTIVATED' }
            ]);
            expect(
                (await h.f.fake.readAuthorization({ authorizationId: h.authorizationId })).snapshot
                    .status
            ).toBe('active');
        } else {
            expect(paused).toEqual({ results: [] });
            expect(row).toEqual({ status: 'ACTIVE' });
        }
    });

    it.each([
        'ACTIVE',
        'PAUSED'
    ] as const)('LISTA:B10 clause 11 4a a customer pause shields the vertical addon and USER only when the other compatible title is %s', async (otherStatus) => {
        const vertical = await activeRecurringExitFixture('VERTICAL_SUBSCRIPTION');
        const user = await activeRecurringExitFixture('USER', ['accommodation', 'venue']);
        const venueId = await payingVenueExitPrincipal(user.f);
        await getServiceTestDb()
            .update(subscriptions)
            .set({ status: otherStatus })
            .where(eq(subscriptions.id, venueId));
        const now = vertical.f.ports.clock.now();
        // Customer pause rows are seeded because this case isolates the S32/S33 addon rule.
        for (const id of [vertical.principalId, user.principalId]) {
            await getServiceTestDb()
                .update(subscriptions)
                .set({ status: 'PAUSED' })
                .where(eq(subscriptions.id, id));
            await getServiceTestDb()
                .insert(subscriptionPauses)
                .values({
                    subscriptionId: id,
                    reason: 'CUSTOMER_REQUEST',
                    requestedMonths: 1,
                    startsAt: now,
                    expectedEndAt: new Date('2026-11-13T12:00:00.000Z')
                });
        }
        const verticalPause = await pauseComplementsS32(
            { principalSubscriptionId: vertical.principalId, trigger: 'PRINCIPAL_PAUSED' },
            {
                provider: vertical.f.fake,
                clock: vertical.f.ports.clock,
                policy: await policy(vertical)
            }
        );
        const userPause = await pauseComplementsS32(
            { principalSubscriptionId: user.principalId, trigger: 'PRINCIPAL_PAUSED' },
            { provider: user.f.fake, clock: user.f.ports.clock, policy: await policy(user) }
        );
        expect(verticalPause.results).toMatchObject([
            { complementSubscriptionId: vertical.complementId, outcome: 'PAUSED' }
        ]);
        expect(
            (await vertical.f.fake.readAuthorization({ authorizationId: vertical.authorizationId }))
                .snapshot.status
        ).toBe('paused');
        const [verticalRow] = await getServiceTestDb()
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, vertical.complementId));
        expect(verticalRow).toEqual({ status: 'PAUSED' });
        const [userRow] = await getServiceTestDb()
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, user.complementId));
        if (otherStatus === 'ACTIVE') {
            expect(userPause).toEqual({ results: [] });
            expect(userRow).toEqual({ status: 'ACTIVE' });
        } else {
            expect(userPause.results).toMatchObject([
                { complementSubscriptionId: user.complementId, outcome: 'PAUSED' }
            ]);
            expect(userRow).toEqual({ status: 'PAUSED' });
        }
        await getServiceTestDb()
            .update(subscriptions)
            .set({ status: 'ACTIVE' })
            .where(eq(subscriptions.id, vertical.principalId));
        const resumed = await resumeComplementsS33(
            { principalSubscriptionId: vertical.principalId, trigger: 'PRINCIPAL_ACTIVE' },
            {
                provider: vertical.f.fake,
                clock: vertical.f.ports.clock,
                policy: await policy(vertical)
            }
        );
        expect(resumed.results).toMatchObject([
            { complementSubscriptionId: vertical.complementId, outcome: 'REACTIVATED' }
        ]);
    });
    it('LISTA:B10 clause 15 the 15 October service end applies S21 before the A1 listing complement S12 and hangs the last charge on mark 14', async () => {
        const h = await listingExitFixture('ACTIVE');
        if (!h.complementId || !h.authorizationId) throw new Error('Listing complement missing');
        const db = getServiceTestDb();
        const [principal] = await db
            .select({ id: subscriptions.id })
            .from(subscriptions)
            .where(
                and(eq(subscriptions.userId, h.f.ownerId), eq(subscriptions.class, 'PRINCIPAL'))
            );
        if (!principal) throw new Error('Listing principal missing');
        const cancelled = await cancelActiveSubscription(
            { actor: actor(h.f.ownerId), subscriptionId: principal.id },
            {
                provider: h.f.fake,
                clock: h.f.ports.clock,
                beforeCancelNotice: { beforeCancel: async () => 'SENT' as const },
                coverageNotices: { emitCoverageChanged: async () => undefined },
                complements: {
                    addonPolicy: await cachedExitAddonPolicy(h.f.versionId),
                    listing: h.f.ports.listing,
                    liveAnchors: h.f.ports.liveAnchors
                }
            }
        );
        expect(cancelled.outcome).toBe('SCHEDULED');
        const serviceEnd = new Date('2026-10-15T00:00:00.000Z');
        // The principal and complement were scheduled by S11; only their test end date is seeded.
        await db
            .update(subscriptions)
            .set({ serviceEndsAt: serviceEnd })
            .where(inArray(subscriptions.id, [principal.id, h.complementId]));
        const { paymentId } = await db.transaction((tx) =>
            seedComplementCharge(tx, {
                subscriptionId: h.complementId as string,
                factAt: h.f.ports.clock.now(),
                coveredPeriodStart: new Date('2026-09-20T00:00:00.000Z')
            })
        );
        chargeIds.push(paymentId);
        h.f.advanceTo(serviceEnd);
        const result = await endScheduledServices(
            { limit: 100, db },
            {
                clock: h.f.ports.clock,
                provider: h.f.fake,
                beforeCancelNotice: { beforeCancel: async () => 'SENT' as const },
                coverageNotices: { emitCoverageChanged: async () => undefined },
                addonPolicy: await cachedExitAddonPolicy(h.f.versionId),
                listing: h.f.ports.listing,
                liveAnchors: h.f.ports.liveAnchors
            }
        );
        const [principalAfter] = await db
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, principal.id));
        const [complementAfter] = await db
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, h.complementId));
        const [instanceAfter] = await db
            .select({ status: addonInstances.status })
            .from(addonInstances)
            .where(eq(addonInstances.id, h.instanceId));
        expect(principalAfter).toEqual({ status: 'CANCELLED' });
        expect(complementAfter).toEqual({ status: 'CANCELLED' });
        expect(instanceAfter).toEqual({ status: 'CANCELLED' });
        expect(result.rows.find((r) => r.subscriptionId === principal.id)).toMatchObject({
            phase: 'PRINCIPAL',
            orphaned: [h.instanceId]
        });
        expect(result.rows.filter((r) => r.subscriptionId === h.complementId)).toEqual([]);
        const marks = await db
            .select({ id: reconciliationMarks.id, reason: reconciliationMarks.reason })
            .from(reconciliationMarks)
            .where(eq(reconciliationMarks.subscriptionId, h.complementId));
        expect(marks).toHaveLength(1);
        expect(marks[0]?.reason).toBe('COMPLEMENTO_CON_PERIODO_COBRADO_POR_OTRA_CAUSA');
        const hung = await db
            .select({ paymentId: reconciliationMarkPayments.paymentId })
            .from(reconciliationMarkPayments)
            .where(eq(reconciliationMarkPayments.markId, marks[0]!.id));
        expect(hung).toEqual([{ paymentId }]);
        const events = await domainEventModel.findByEntity({
            entityType: 'subscription',
            entityId: h.complementId
        });
        expect(
            events
                .filter((e) => e.eventType === 'subscription.provider_cancellation_decided')
                .map((e) => e.reason)
        ).toEqual(['S11', 'A5']);
    });
});
