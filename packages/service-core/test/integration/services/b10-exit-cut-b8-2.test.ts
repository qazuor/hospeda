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
    subscriptions
} from '@repo/db';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { cancelActiveSubscription } from '../../../src/services/billing/subscription/cancel-active-subscription.service';
import { endScheduledServices } from '../../../src/services/billing/subscription/end-scheduled-services.service';
import { closeServiceTestPool, getServiceTestDb } from './helpers';
import { seedComplementCharge } from './support/addon-orphan-fixtures';
import {
    cachedExitAddonPolicy,
    listingExitFixture,
    retireExitFixtures
} from './support/b10-exit-fixtures';

const chargeIds: string[] = [];
const actor = (id: string) => ({ id, roles: [], permissions: [] });

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

describe('TEST:B10:10 AC:B10:9 LISTA:B10 cut clause 15 re-run on A1 rows (B8a)', () => {
    /**
     * Real path: S1/S2 start the principal, A1/A2 activate the LISTING addon,
     * S11 schedules both rows, and S12/S21 handle the service end.
     * INJECTED: the shared 15 October end and last paid period are seeded.
     * The listing port is a simulator for the listing's live state.
     */
    it('LISTA:B10 clause 15 con la principal y su destaque en `CANCEL_SCHEDULED` hasta el 15/10 y el último cobro del destaque pagado hasta el 20/10, el 15/10 el destaque termina `CANCELLED` por `S21` con la marca 14 abierta y ese cobro colgado —si termina por su propio `S12`, sin marca, el orden está al revés— (FASE 9 vuelta 2, owner 2026-09-27, `R1-c`) (S21 before S12)', async () => {
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
        // INJECTED: shared service end after S11 scheduled both rows.
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
    /**
     * Real path: S1/S2 start the principal, A1/A2 activate the LISTING addon,
     * and S11 schedules both rows before the S12 service end attempt.
     * INJECTED: the shared 15 October end and a catalog failure isolate the
     * failed principal; the listing port simulates the listing's live state.
     */
    it('LISTA:B10 clause 15 con la principal y su destaque en `CANCEL_SCHEDULED` hasta el 15/10 y el último cobro del destaque pagado hasta el 20/10, el 15/10 el destaque termina `CANCELLED` por `S21` con la marca 14 abierta y ese cobro colgado —si termina por su propio `S12`, sin marca, el orden está al revés— (FASE 9 vuelta 2, owner 2026-09-27, `R1-c`) (principal S12 failure)', async () => {
        const h = await listingExitFixture('ACTIVE');
        if (!h.complementId) throw new Error('Listing complement missing');
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
        // INJECTED: shared service end after S11 scheduled both rows.
        await db
            .update(subscriptions)
            .set({ serviceEndsAt: serviceEnd })
            .where(inArray(subscriptions.id, [principal.id, h.complementId]));
        h.f.advanceTo(serviceEnd);
        const result = await endScheduledServices(
            { limit: 100, db },
            {
                clock: h.f.ports.clock,
                provider: h.f.fake,
                beforeCancelNotice: { beforeCancel: async () => 'SENT' as const },
                coverageNotices: { emitCoverageChanged: async () => undefined },
                addonPolicy: async () => {
                    throw new Error('catalog unavailable');
                },
                listing: h.f.ports.listing,
                liveAnchors: h.f.ports.liveAnchors
            }
        );
        expect(result.rows.find((row) => row.subscriptionId === principal.id)).toMatchObject({
            phase: 'PRINCIPAL',
            outcome: 'FAILED'
        });
        expect(result.rows.filter((row) => row.subscriptionId === h.complementId)).toEqual([]);
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
        expect(principalAfter).toEqual({ status: 'CANCEL_SCHEDULED' });
        expect(complementAfter).toEqual({ status: 'CANCEL_SCHEDULED' });
        expect(instanceAfter).toEqual({ status: 'ACTIVE' });
    });
});
