import {
    addonInstances,
    and,
    domainEventModel,
    eq,
    subscriptionPauses,
    subscriptions
} from '@repo/db';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { cancelActiveSubscription } from '../../../src/services/billing/subscription/cancel-active-subscription.service';
import { pauseComplementsS32 } from '../../../src/services/billing/subscription/complement-pause-s32';
import { resumeComplementsS33 } from '../../../src/services/billing/subscription/complement-resume-s33';
import { closeServiceTestPool, getServiceTestDb } from './helpers';
import {
    activeRecurringExitFixture,
    cachedExitAddonPolicy,
    retireExitFixtures
} from './support/b10-exit-fixtures';
import { payingVenueExitPrincipal } from './support/b10-exit-fixtures-2';

type ExitFixture = Awaited<ReturnType<typeof activeRecurringExitFixture>>;
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
    vi.restoreAllMocks();
});
afterAll(closeServiceTestPool);

describe('TEST:B10:10 AC:B10:9 LISTA:B10 cut clauses re-run on A1 rows (B7, B8a)', () => {
    it('LISTA:B10 clause 1 darse de baja (`S11`) cancela en el acto el preapproval de cada addon recurrente que depende de la principal —la selección de `S32`, CON `CANCEL_SCHEDULED` en la exclusión (FASE 9 vuelta 2, verificación, owner 2026-09-27, `V2-c`)— y el addon se sigue viendo hasta el fin de servicio (FASE 9 vuelta 2, owner 2026-09-27, `R1-a`)', async () => {
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

    it('LISTA:B10 clause 2 un `USER` compatible con dos verticales, dado de baja primero en una y después en la otra, se cancela en la segunda baja y no cobra un ciclo de más (`V2-c`)', async () => {
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

    /**
     * Real path: S1/S2 start both principals; A1/A2 create and activate the USER addon.
     * INJECTED: the other principal is set to PAUSED, SUSPENDED, or ACTIVE, and
     * the first principal to CANCELLED, to isolate S32 after title death. Its
     * later ACTIVE state is also injected before the real S33 call.
     */
    it.each([
        'PAUSED',
        'SUSPENDED',
        'ACTIVE'
    ] as const)('LISTA:B10 clause 3 un `USER` compatible con dos verticales, cuya principal de una muere por una de las once con la de la otra `PAUSED` o `SUSPENDED`, queda pausado por `S32` en ese acto y vuelve por `S33` cuando la otra se reanuda; si sigue cobrando, falta ese disparador (`V2-e`) (%s)', async (otherStatus) => {
        const h = await activeRecurringExitFixture('USER', ['accommodation', 'venue']);
        const venueId = await payingVenueExitPrincipal(h.f);
        await getServiceTestDb()
            .update(subscriptions)
            .set({ status: otherStatus })
            .where(eq(subscriptions.id, venueId));
        // INJECTED: title death after the real starts.
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
        if (otherStatus === 'PAUSED' || otherStatus === 'SUSPENDED') {
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

    /**
     * Real path: S1/S2 start the principals, A1/A2 activate both addons,
     * and S32/S33 perform the complement transitions.
     * INJECTED: customer pause rows and the other vertical's status are set
     * directly to isolate S32/S33; principal reactivation is also injected.
     */
    it.each([
        'ACTIVE',
        'PAUSED'
    ] as const)('LISTA:B10 clause 11 4a una pausa pedida por el cliente no deja ningún addon recurrente de esa vertical cobrando —se pausa con ella por `S32` y vuelve por `S33`, y un `USER`/`GLOBAL` sólo si no le queda título en otra vertical compatible— (4a) (%s)', async (otherStatus) => {
        const vertical = await activeRecurringExitFixture('VERTICAL_SUBSCRIPTION');
        const user = await activeRecurringExitFixture('USER', ['accommodation', 'venue']);
        const venueId = await payingVenueExitPrincipal(user.f);
        await getServiceTestDb()
            .update(subscriptions)
            .set({ status: otherStatus })
            .where(eq(subscriptions.id, venueId));
        const now = vertical.f.ports.clock.now();
        // INJECTED: customer pause rows for the S32/S33 addon rule.
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
            expect(
                (await user.f.fake.readAuthorization({ authorizationId: user.authorizationId }))
                    .snapshot.status
            ).toBe('paused');
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
        await getServiceTestDb()
            .update(subscriptions)
            .set({ status: 'ACTIVE' })
            .where(eq(subscriptions.id, user.principalId));
        const userResumed = await resumeComplementsS33(
            { principalSubscriptionId: user.principalId, trigger: 'PRINCIPAL_ACTIVE' },
            { provider: user.f.fake, clock: user.f.ports.clock, policy: await policy(user) }
        );
        expect(userResumed.results).toEqual(
            otherStatus === 'PAUSED'
                ? [
                      {
                          complementSubscriptionId: user.complementId,
                          instanceId: user.instanceId,
                          outcome: 'REACTIVATED'
                      }
                  ]
                : []
        );
        const [userAfter] = await getServiceTestDb()
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, user.complementId));
        expect(userAfter).toEqual({ status: 'ACTIVE' });
        expect(
            (await user.f.fake.readAuthorization({ authorizationId: user.authorizationId }))
                .snapshot.status
        ).toBe('active');
    });
});
