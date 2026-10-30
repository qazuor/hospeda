/**
 * TEST:B8a:6 (AC:B8a:6): the order of S12 over the complement rows (HOS-1569, B8a.2). The
 * principal's S12 runs first and its orphanhood (A5 → S21) closes the LISTING complement; only
 * after it the complements' phase runs S12 on the USER complement still `CANCEL_SCHEDULED`, which
 * also withdraws its instance by A5.
 *
 * The run reads the GLOBAL population of the shared database, so it gets the test transaction as
 * `db` (its per-row transactions become savepoints) and reads "now" in 2001 with end dates seeded
 * in 2001 (notas I-5): it neither sees nor locks other suites' committed rows, and nothing here is
 * committed.
 */
import {
    domainEventModel,
    eq,
    reconciliationMarkPayments,
    reconciliationMarks,
    refunds
} from '@repo/db';
import { VerticalEnum } from '@repo/schemas';
import { afterAll, describe, expect, it } from 'vitest';
import { endScheduledServices } from '../../../src/services/billing/subscription/end-scheduled-services.service';
import {
    closeServiceTestPool,
    isServiceTestDbAvailable,
    withServiceTestTransaction
} from './helpers';
import {
    readDecisions,
    readInstance,
    readSubscription,
    seedComplementCharge,
    seedOrphanInstance,
    seedOrphanOwner
} from './support/addon-orphan-fixtures';
import { seedCoveragePayment } from './support/coverage-fixtures';
import {
    fakePreapproval,
    seededUpdatedAt,
    seedServiceEndComplement,
    seedServiceEndPrincipal,
    serviceEndHarness,
    serviceEndPast,
    serviceEndPorts
} from './support/service-end-fixtures';

afterAll(closeServiceTestPool);

const V = VerticalEnum.ACCOMMODATION;
const W = VerticalEnum.VENUE;

describe.skipIf(!isServiceTestDbAvailable())(
    'HOS-1569 TEST:B8a:6 AC:B8a:6 the order of S12 with the orphanhood: principals first, then the complements left',
    () => {
        it('TEST:B5:14 S12 principal runs before A5 and S21 at the shared end date', async () => {
            await withServiceTestTransaction(async (tx) => {
                const h = serviceEndHarness();
                const F = serviceEndPast;
                const { userId } = await seedOrphanOwner(tx);
                const { subscriptionId: principalId } = await seedServiceEndPrincipal(tx, {
                    userId,
                    vertical: V,
                    status: 'CANCEL_SCHEDULED',
                    serviceEndsAt: F
                });
                const { ports } = serviceEndPorts(tx, h);
                const { subscriptionId: complementId } = await seedServiceEndComplement(tx, {
                    userId,
                    vertical: V,
                    status: 'CANCEL_SCHEDULED',
                    serviceEndsAt: F,
                    authorizationId: await fakePreapproval(h.fake, { cancelled: true })
                });
                const { paymentId } = await seedComplementCharge(tx, {
                    subscriptionId: complementId,
                    factAt: new Date('2001-05-01T00:00:00.000Z'),
                    coveredPeriodStart: new Date('2001-05-15T00:00:00.000Z')
                });
                const { instanceId } = await seedOrphanInstance(tx, {
                    ownerId: userId,
                    scopeType: 'USER',
                    compatibleVerticals: [V],
                    status: 'ACTIVE',
                    complementSubscriptionId: complementId
                });

                const result = await endScheduledServices({ limit: 100, db: tx }, ports);

                expect((await readSubscription(tx, principalId)).status).toBe('CANCELLED');
                expect((await readInstance(tx, instanceId)).status).toBe('CANCELLED');
                expect((await readSubscription(tx, complementId)).status).toBe('CANCELLED');
                expect(
                    result.rows.find((row) => row.subscriptionId === principalId)?.orphaned
                ).toContain(instanceId);
                expect(result.complements.cancelled).toBe(0);
                expect(result.rows.some((row) => row.subscriptionId === complementId)).toBe(false);
                const marks = await tx
                    .select()
                    .from(reconciliationMarks)
                    .where(eq(reconciliationMarks.subscriptionId, complementId));
                expect(marks.map((mark) => mark.reason)).toEqual([
                    'COMPLEMENTO_CON_PERIODO_COBRADO_POR_OTRA_CAUSA'
                ]);
                const hung = await tx
                    .select()
                    .from(reconciliationMarkPayments)
                    .where(eq(reconciliationMarkPayments.paymentId, paymentId));
                expect(hung).toHaveLength(1);
                expect(
                    await tx.select().from(refunds).where(eq(refunds.paymentId, paymentId))
                ).toEqual([]);
                const events = await domainEventModel.findByEntity({
                    entityType: 'subscription',
                    entityId: complementId,
                    tx
                });
                expect(
                    events.filter(
                        (event) => event.eventType === 'subscription.provider_cancellation_decided'
                    )
                ).toMatchObject([{ reason: 'A5' }]);
                expect(h.cancel).not.toHaveBeenCalled();

                const { userId: endedUserId } = await seedOrphanOwner(tx);
                const { subscriptionId: endedPrincipal } = await seedServiceEndPrincipal(tx, {
                    userId: endedUserId,
                    vertical: V,
                    status: 'CANCEL_SCHEDULED',
                    serviceEndsAt: F
                });
                const { subscriptionId: endedComplement } = await seedServiceEndComplement(tx, {
                    userId: endedUserId,
                    vertical: V,
                    status: 'CANCEL_SCHEDULED',
                    serviceEndsAt: F,
                    authorizationId: await fakePreapproval(h.fake, { cancelled: true })
                });
                const { paymentId: endedPayment } = await seedComplementCharge(tx, {
                    subscriptionId: endedComplement,
                    factAt: new Date('2001-04-01T00:00:00.000Z'),
                    coveredPeriodStart: new Date('2001-04-01T00:00:00.000Z')
                });
                await seedOrphanInstance(tx, {
                    ownerId: endedUserId,
                    scopeType: 'USER',
                    compatibleVerticals: [V],
                    status: 'ACTIVE',
                    complementSubscriptionId: endedComplement
                });
                const endedResult = await endScheduledServices({ limit: 100, db: tx }, ports);
                expect((await readSubscription(tx, endedPrincipal)).status).toBe('CANCELLED');
                expect(
                    await tx
                        .select()
                        .from(reconciliationMarks)
                        .where(eq(reconciliationMarks.subscriptionId, endedComplement))
                ).toEqual([]);
                expect(
                    await tx.select().from(refunds).where(eq(refunds.paymentId, endedPayment))
                ).toEqual([]);
                expect(endedResult.rows.some((row) => row.subscriptionId === endedComplement)).toBe(
                    false
                );
                expect((await readInstance(tx, instanceId)).status).toBe('CANCELLED');
                expect(h.cancel).not.toHaveBeenCalled();
            });
        });

        it('the LISTING ends CANCELLED by S21 inside the orphanhood (decision A5); the USER ends CANCELLED by its own S12 with its instance off', async () => {
            await withServiceTestTransaction(async (tx) => {
                // Arrange
                const h = serviceEndHarness();
                const F = serviceEndPast;
                const { userId: U } = await seedOrphanOwner(tx);
                const { subscriptionId: P } = await seedServiceEndPrincipal(tx, {
                    userId: U,
                    vertical: V,
                    status: 'CANCEL_SCHEDULED',
                    serviceEndsAt: F
                });
                const { ports, setListing } = serviceEndPorts(tx, h);

                // the LISTING: a listing of V owned by U, its complement cancelled at the
                // provider by S11, same end date, with a credited payment
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

                // the USER: compatible with V and W, its complement cancelled by S11
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

                // another compatible principal, live and paying: the USER is not orphaned
                const { subscriptionId: PW } = await seedServiceEndPrincipal(tx, {
                    userId: U,
                    vertical: W,
                    status: 'ACTIVE'
                });
                await seedCoveragePayment(tx, { subscriptionId: PW, status: 'SUCCEEDED' });

                // Act
                const result = await endScheduledServices({ limit: 100, db: tx }, ports);

                // Assert: the principal
                expect((await readSubscription(tx, P)).status).toBe('CANCELLED');

                // the LISTING: closed by S21 inside the principal's orphanhood (the decision A5
                // is the evidence of the order: its own S12 would have left none)
                expect((await readInstance(tx, listingInstance)).status).toBe('CANCELLED');
                expect((await readSubscription(tx, CL)).status).toBe('CANCELLED');
                expect((await readDecisions(tx, CL)).map(({ reason }) => reason)).toStrictEqual([
                    'A5'
                ]);
                // HOS-1546 (AC:B5:29/30) adds here the assertion of the open mark 14 with the
                // LISTING's payment hanging from it: S21 does not open marks yet.

                // the USER: closed by its own S12, no decision, its instance withdrawn
                expect((await readSubscription(tx, CU)).status).toBe('CANCELLED');
                expect(await readDecisions(tx, CU)).toHaveLength(0);
                expect((await readInstance(tx, userInstance)).status).toBe('CANCELLED');

                // W untouched; the provider never called (the re-read sees both cancelled)
                const w = await readSubscription(tx, PW);
                expect(w.status).toBe('ACTIVE');
                expect(w.updatedAt).toEqual(seededUpdatedAt);
                expect(h.cancel).not.toHaveBeenCalled();
                expect(h.beforeCancelCalls).toHaveLength(0);

                // the rows: CL orphaned in phase 1 by P; CU a phase 2 row with its withdrawal
                expect(result.rows).toStrictEqual([
                    {
                        subscriptionId: P,
                        phase: 'PRINCIPAL',
                        outcome: 'CANCELLED',
                        orphaned: [listingInstance],
                        withdrawn: null
                    },
                    {
                        subscriptionId: CU,
                        phase: 'COMPLEMENTO',
                        outcome: 'CANCELLED',
                        orphaned: [],
                        withdrawn: userInstance
                    }
                ]);

                // the notices: the principal's SUBSCRIPTION, then one ADDON per (U, vertical) of
                // the LISTING (phase 1) and of the USER (phase 2), each without repeating
                expect(h.events).toStrictEqual([
                    { userId: U, vertical: V, sourceType: 'SUBSCRIPTION', change: 'REMOVED' },
                    { userId: U, vertical: V, sourceType: 'ADDON', change: 'REMOVED' },
                    { userId: U, vertical: V, sourceType: 'ADDON', change: 'REMOVED' },
                    { userId: U, vertical: W, sourceType: 'ADDON', change: 'REMOVED' }
                ]);
            });
        });
    }
);
