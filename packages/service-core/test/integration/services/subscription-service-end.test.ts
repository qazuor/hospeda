/**
 * TEST:B8a:5 (AC:B8a:5): S12 by the end-of-service date, idempotent (HOS-1569, B8a.2).
 *
 * The run (`endScheduledServices`) reads the GLOBAL population of the shared database, so every
 * run here passes the test transaction as `db` (its per-row transactions become savepoints) and
 * reads "now" in 2001 with end dates seeded in 2001 (notas I-5): it neither sees nor locks the
 * committed `CANCEL_SCHEDULED` rows other suites leave behind, and nothing here is committed.
 */
import { domainEventModel, reconciliationInventoryModel } from '@repo/db';
import { VerticalEnum } from '@repo/schemas';
import { afterAll, describe, expect, it } from 'vitest';
import { recordProviderCancellationDecided } from '../../../src/services/billing/reconciliation/provider-cancellation-decision';
import { endScheduledServices } from '../../../src/services/billing/subscription/end-scheduled-services.service';
import { applyS12ToPrincipal } from '../../../src/services/billing/subscription/service-end-s12';
import {
    closeServiceTestPool,
    isServiceTestDbAvailable,
    withServiceTestTransaction
} from './helpers';
import {
    readDecisions,
    readInstance,
    readSubscription,
    seedOrphanInstance,
    seedOrphanOwner
} from './support/addon-orphan-fixtures';
import {
    failingSuccessionCloser,
    fakePreapproval,
    serviceEndNow as now,
    readCoverageLoss,
    readRowVersion,
    recordingSuccessionCloser,
    seededUpdatedAt,
    seedServiceEndComplement,
    seedServiceEndPrincipal,
    serviceEndFuture,
    serviceEndHarness,
    serviceEndPast,
    serviceEndPorts
} from './support/service-end-fixtures';

afterAll(closeServiceTestPool);

const V = VerticalEnum.ACCOMMODATION;

describe.skipIf(!isServiceTestDbAvailable())(
    'HOS-1569 TEST:B8a:5 AC:B8a:5 S12 by the end-of-service date: the first run cancels, the second writes nothing',
    () => {
        it('(a) a due principal: CANCELLED, end date kept, grace clock off, coverage loss at the end date, one REMOVED, no decision, no provider call; (b) the second run writes nothing', async () => {
            await withServiceTestTransaction(async (tx) => {
                // Arrange
                const h = serviceEndHarness();
                const facts: import('../../../src/services/billing/facts/billing-fact-sink').BillingFact[] =
                    [];
                const { userId } = await seedOrphanOwner(tx);
                const { subscriptionId } = await seedServiceEndPrincipal(tx, {
                    userId,
                    vertical: V,
                    status: 'CANCEL_SCHEDULED',
                    serviceEndsAt: serviceEndPast,
                    grace: true
                });
                const { ports } = serviceEndPorts(tx, h);
                const portsWithFacts = {
                    ...ports,
                    billingFacts: { emit: (fact: (typeof facts)[number]) => facts.push(fact) }
                };

                // Act
                const first = await endScheduledServices({ limit: 100, db: tx }, portsWithFacts);

                // Assert
                const row = await readSubscription(tx, subscriptionId);
                expect(row.status).toBe('CANCELLED');
                expect(facts).toHaveLength(1);
                expect(facts[0]).toMatchObject({
                    kind: 'SUBSCRIPTION_CANCELLED',
                    userId,
                    subscriptionId,
                    subscriptionClass: 'PRINCIPAL',
                    actorKind: 'SYSTEM',
                    cancelledBy: 'SYSTEM',
                    path: 'SERVICE_END',
                    wasScheduled: true
                });
                expect(row.serviceEndsAt).toEqual(serviceEndPast);
                expect(row.graceStartedAt).toBeNull();
                expect(row.graceEndsAt).toBeNull();
                // updated_at is stamped by the set_updated_at trigger (extras 002), not by `now`
                expect(row.updatedAt).not.toEqual(seededUpdatedAt);
                const loss = await readCoverageLoss(tx, { userId, vertical: V });
                expect(loss?.lostAt).toEqual(serviceEndPast);
                expect(h.events).toStrictEqual([
                    { userId, vertical: V, sourceType: 'SUBSCRIPTION', change: 'REMOVED' }
                ]);
                expect(await readDecisions(tx, subscriptionId)).toHaveLength(0);
                expect(h.cancel).not.toHaveBeenCalled();
                expect(first.principals).toStrictEqual({ cancelled: 1, failed: 0 });
                expect(first.complements).toStrictEqual({ cancelled: 0, failed: 0 });
                expect(first.rows).toStrictEqual([
                    {
                        subscriptionId,
                        phase: 'PRINCIPAL',
                        outcome: 'CANCELLED',
                        orphaned: [],
                        withdrawn: null
                    }
                ]);

                const versionAfterFirst = await readRowVersion(tx, subscriptionId);

                // Act (b): the second run over the same rows
                const second = await endScheduledServices({ limit: 100, db: tx }, portsWithFacts);

                // Assert (b)
                const again = await readSubscription(tx, subscriptionId);
                expect(again.updatedAt).toEqual(row.updatedAt);
                expect(await readRowVersion(tx, subscriptionId)).toBe(versionAfterFirst);
                expect(again.status).toBe('CANCELLED');
                expect((await readCoverageLoss(tx, { userId, vertical: V }))?.lostAt).toEqual(
                    serviceEndPast
                );
                expect(h.events).toHaveLength(1);
                expect(facts).toHaveLength(1);
                expect(second).toStrictEqual({
                    principals: { cancelled: 0, failed: 0 },
                    complements: { cancelled: 0, failed: 0 },
                    rows: []
                });
            });
        });

        it('(c) a CANCEL_SCHEDULED with a future end date and one without end date stay untouched', async () => {
            await withServiceTestTransaction(async (tx) => {
                // Arrange
                const h = serviceEndHarness();
                const facts: import('../../../src/services/billing/facts/billing-fact-sink').BillingFact[] =
                    [];
                const future = await seedServiceEndPrincipal(tx, {
                    userId: (await seedOrphanOwner(tx)).userId,
                    vertical: V,
                    status: 'CANCEL_SCHEDULED',
                    serviceEndsAt: serviceEndFuture
                });
                const undated = await seedServiceEndPrincipal(tx, {
                    userId: (await seedOrphanOwner(tx)).userId,
                    vertical: V,
                    status: 'CANCEL_SCHEDULED',
                    serviceEndsAt: null
                });
                const { ports } = serviceEndPorts(tx, h);
                const portsWithFacts = {
                    ...ports,
                    billingFacts: { emit: (fact: (typeof facts)[number]) => facts.push(fact) }
                };

                // Act
                const result = await endScheduledServices({ limit: 100, db: tx }, portsWithFacts);
                const direct = await applyS12ToPrincipal(
                    { tx, subscriptionId: future.subscriptionId, now },
                    { orphanhood: ports, clock: h.clock }
                );

                // Assert
                for (const { subscriptionId } of [future, undated]) {
                    const row = await readSubscription(tx, subscriptionId);
                    expect(row.status).toBe('CANCEL_SCHEDULED');
                    expect(row.updatedAt).toEqual(seededUpdatedAt);
                }
                expect(direct).toStrictEqual({
                    outcome: 'NOT_DUE',
                    subscriptionId: future.subscriptionId
                });
                expect(result.rows).toStrictEqual([]);
                expect(h.events).toHaveLength(0);
                expect(facts).toHaveLength(0);
            });
        });

        it('(d) a MANUAL payer in a due CANCEL_SCHEDULED (as S7 leaves it) is cancelled too', async () => {
            await withServiceTestTransaction(async (tx) => {
                // Arrange
                const h = serviceEndHarness();
                const { userId } = await seedOrphanOwner(tx);
                const { subscriptionId } = await seedServiceEndPrincipal(tx, {
                    userId,
                    vertical: V,
                    status: 'CANCEL_SCHEDULED',
                    serviceEndsAt: serviceEndPast,
                    paymentMethod: 'MANUAL'
                });

                // Act
                const result = await endScheduledServices(
                    { limit: 100, db: tx },
                    serviceEndPorts(tx, h).ports
                );

                // Assert
                expect((await readSubscription(tx, subscriptionId)).status).toBe('CANCELLED');
                expect(result.principals.cancelled).toBe(1);
                expect(h.cancel).not.toHaveBeenCalled();
            });
        });

        it('(e) applyS12ToPrincipal: CANCELLED is ALREADY_CANCELLED without writing; ACTIVE and a COMPLEMENTO are NOT_APPLICABLE', async () => {
            await withServiceTestTransaction(async (tx) => {
                // Arrange
                const h = serviceEndHarness();
                const { ports } = serviceEndPorts(tx, h);
                const s12Ports = { orphanhood: ports, clock: h.clock };
                const cancelled = await seedServiceEndPrincipal(tx, {
                    userId: (await seedOrphanOwner(tx)).userId,
                    vertical: V,
                    status: 'CANCELLED',
                    serviceEndsAt: serviceEndPast
                });
                const active = await seedServiceEndPrincipal(tx, {
                    userId: (await seedOrphanOwner(tx)).userId,
                    vertical: V,
                    status: 'ACTIVE'
                });
                const complement = await seedServiceEndComplement(tx, {
                    userId: (await seedOrphanOwner(tx)).userId,
                    vertical: V,
                    status: 'CANCEL_SCHEDULED',
                    serviceEndsAt: serviceEndPast
                });

                // Act
                const results = [];
                for (const { subscriptionId } of [cancelled, active, complement])
                    results.push(await applyS12ToPrincipal({ tx, subscriptionId, now }, s12Ports));

                // Assert
                expect(results.map(({ outcome }) => outcome)).toStrictEqual([
                    'ALREADY_CANCELLED',
                    'NOT_APPLICABLE',
                    'NOT_APPLICABLE'
                ]);
                expect((await readSubscription(tx, cancelled.subscriptionId)).updatedAt).toEqual(
                    seededUpdatedAt
                );
                expect((await readSubscription(tx, active.subscriptionId)).status).toBe('ACTIVE');
                expect((await readSubscription(tx, complement.subscriptionId)).status).toBe(
                    'CANCEL_SCHEDULED'
                );
            });
        });

        it('(f) with a live successor pointing at it, the closer is called ONCE with its id, in the same transaction, before the orphanhood', async () => {
            await withServiceTestTransaction(async (tx) => {
                // Arrange
                const h = serviceEndHarness();
                const { userId } = await seedOrphanOwner(tx);
                const { subscriptionId } = await seedServiceEndPrincipal(tx, {
                    userId,
                    vertical: V,
                    status: 'CANCEL_SCHEDULED',
                    serviceEndsAt: serviceEndPast
                });
                await seedServiceEndPrincipal(tx, {
                    userId,
                    vertical: V,
                    status: 'ACTIVE',
                    predecessorId: subscriptionId
                });
                await seedOrphanInstance(tx, {
                    ownerId: userId,
                    scopeType: 'VERTICAL_SUBSCRIPTION',
                    compatibleVerticals: [V],
                    status: 'ACTIVE',
                    targetId: subscriptionId
                });
                const closer = recordingSuccessionCloser(h.log);
                const { ports } = serviceEndPorts(tx, h);

                // Act
                const result = await applyS12ToPrincipal(
                    { tx, subscriptionId, now },
                    { orphanhood: ports, clock: h.clock, successionCloser: closer.successionCloser }
                );

                // Assert
                expect(closer.calls).toHaveLength(1);
                expect(closer.calls[0]?.predecessorSubscriptionId).toBe(subscriptionId);
                expect(closer.calls[0]?.tx).toBe(tx);
                expect(h.log[0]).toBe('closer');
                expect(h.log).toContain('addonPolicy');
                expect(result).toMatchObject({ outcome: 'CANCELLED', successionClosed: true });
            });
        });

        it('(g) a closer that throws rolls that principal back and its notice never leaves; another owner is cancelled; phase 2 skips the failed owner', async () => {
            await withServiceTestTransaction(async (tx) => {
                // Arrange
                const h = serviceEndHarness();
                const failedOwner = (await seedOrphanOwner(tx)).userId;
                const failed = await seedServiceEndPrincipal(tx, {
                    userId: failedOwner,
                    vertical: V,
                    status: 'CANCEL_SCHEDULED',
                    serviceEndsAt: serviceEndPast
                });
                await seedServiceEndPrincipal(tx, {
                    userId: failedOwner,
                    vertical: V,
                    status: 'ACTIVE',
                    predecessorId: failed.subscriptionId
                });
                const failedComplement = await seedServiceEndComplement(tx, {
                    userId: failedOwner,
                    vertical: V,
                    status: 'CANCEL_SCHEDULED',
                    serviceEndsAt: serviceEndPast
                });
                const okOwner = (await seedOrphanOwner(tx)).userId;
                const ok = await seedServiceEndPrincipal(tx, {
                    userId: okOwner,
                    vertical: V,
                    status: 'CANCEL_SCHEDULED',
                    serviceEndsAt: serviceEndPast
                });
                const okComplement = await seedServiceEndComplement(tx, {
                    userId: okOwner,
                    vertical: V,
                    status: 'CANCEL_SCHEDULED',
                    serviceEndsAt: serviceEndPast
                });
                const { ports } = serviceEndPorts(tx, h, {
                    successionCloser: failingSuccessionCloser()
                });

                // Act
                const result = await endScheduledServices({ limit: 100, db: tx }, ports);

                // Assert
                const failedRow = await readSubscription(tx, failed.subscriptionId);
                expect(failedRow.status).toBe('CANCEL_SCHEDULED');
                expect(failedRow.updatedAt).toEqual(seededUpdatedAt);
                expect(await readCoverageLoss(tx, { userId: failedOwner, vertical: V })).toBeNull();
                expect((await readSubscription(tx, ok.subscriptionId)).status).toBe('CANCELLED');
                expect(h.events).toStrictEqual([
                    { userId: okOwner, vertical: V, sourceType: 'SUBSCRIPTION', change: 'REMOVED' }
                ]);
                expect((await readSubscription(tx, failedComplement.subscriptionId)).status).toBe(
                    'CANCEL_SCHEDULED'
                );
                expect((await readSubscription(tx, okComplement.subscriptionId)).status).toBe(
                    'CANCELLED'
                );
                expect(result.principals).toStrictEqual({ cancelled: 1, failed: 1 });
                expect(result.complements).toStrictEqual({ cancelled: 1, failed: 0 });
                const failedEntry = result.rows.find(
                    ({ subscriptionId }) => subscriptionId === failed.subscriptionId
                );
                expect(failedEntry).toMatchObject({ phase: 'PRINCIPAL', outcome: 'FAILED' });
                expect(failedEntry?.error).toContain('succession closer down');
            });
        });

        it('(h) with an S11 decision on the principal, after S12 the latest decision is still S11 and there is no S12', async () => {
            await withServiceTestTransaction(async (tx) => {
                // Arrange
                const h = serviceEndHarness();
                const { userId } = await seedOrphanOwner(tx);
                const { subscriptionId } = await seedServiceEndPrincipal(tx, {
                    userId,
                    vertical: V,
                    status: 'CANCEL_SCHEDULED',
                    serviceEndsAt: serviceEndPast
                });
                await recordProviderCancellationDecided({
                    subscriptionId,
                    transition: 'S11',
                    decidedAt: new Date('2001-05-01T10:00:00.000Z'),
                    actor: { type: 'job' },
                    correlationId: crypto.randomUUID(),
                    tx
                });

                // Act
                await endScheduledServices({ limit: 100, db: tx }, serviceEndPorts(tx, h).ports);

                // Assert
                expect((await readSubscription(tx, subscriptionId)).status).toBe('CANCELLED');
                const latest = await reconciliationInventoryModel.findCancellationDecision({
                    subscriptionId,
                    tx
                });
                expect(latest?.transition).toBe('S11');
                const decisions = await readDecisions(tx, subscriptionId);
                expect(decisions.map(({ reason }) => reason)).toStrictEqual(['S11']);
                const events = await domainEventModel.findByEntity({
                    entityType: 'subscription',
                    entityId: subscriptionId,
                    tx
                });
                expect(events.filter(({ reason }) => reason === 'S12')).toHaveLength(0);
            });
        });

        it('(i) the orphanhood of a due principal cancels its VERTICAL_SUBSCRIPTION addon (decision A5) and A5 calls the provider ONCE after the commit', async () => {
            await withServiceTestTransaction(async (tx) => {
                // Arrange
                const h = serviceEndHarness();
                const { userId } = await seedOrphanOwner(tx);
                const { subscriptionId } = await seedServiceEndPrincipal(tx, {
                    userId,
                    vertical: V,
                    status: 'CANCEL_SCHEDULED',
                    serviceEndsAt: serviceEndPast
                });
                const authorizationId = await fakePreapproval(h.fake, { cancelled: false });
                const complement = await seedServiceEndComplement(tx, {
                    userId,
                    vertical: V,
                    status: 'ACTIVE',
                    authorizationId
                });
                const { instanceId } = await seedOrphanInstance(tx, {
                    ownerId: userId,
                    scopeType: 'VERTICAL_SUBSCRIPTION',
                    compatibleVerticals: [V],
                    status: 'ACTIVE',
                    targetId: subscriptionId,
                    complementSubscriptionId: complement.subscriptionId
                });

                // Act
                const result = await endScheduledServices(
                    { limit: 100, db: tx },
                    serviceEndPorts(tx, h).ports
                );

                // Assert
                expect((await readInstance(tx, instanceId)).status).toBe('CANCELLED');
                expect((await readSubscription(tx, complement.subscriptionId)).status).toBe(
                    'CANCELLED'
                );
                const decisions = await readDecisions(tx, complement.subscriptionId);
                expect(decisions.map(({ reason }) => reason)).toStrictEqual(['A5']);
                expect(h.cancel).toHaveBeenCalledTimes(1);
                expect(h.cancel).toHaveBeenCalledWith(expect.objectContaining({ authorizationId }));
                expect(h.beforeCancelCalls.map(({ kind }) => kind)).toStrictEqual([
                    'ADDON_CANCELLED'
                ]);
                expect((await h.fake.readAuthorization({ authorizationId })).snapshot.status).toBe(
                    'cancelled'
                );
                expect(result.rows).toStrictEqual([
                    {
                        subscriptionId,
                        phase: 'PRINCIPAL',
                        outcome: 'CANCELLED',
                        orphaned: [instanceId],
                        withdrawn: null
                    }
                ]);
            });
        });
    }
);
