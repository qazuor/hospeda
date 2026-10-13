/**
 * TEST:B5:13 (integration with DB), the local half of AC:B5:25 (HOS-1545): the orphanhood of
 * B/16 §4.2 over the four candidate groups of §4.3, A5 from its two live states, S21 on the
 * complement in the same act and the decision `A5` on the complement. Every case runs inside a
 * rolled-back transaction and asserts only on the rows it seeded, by id.
 */
import type { CoverageChangedEvent } from '@repo/billing-verticals-contract';
import type { DrizzleClient } from '@repo/db';
import { VerticalEnum } from '@repo/schemas';
import { afterAll, describe, expect, it } from 'vitest';
import {
    applyA5,
    type CancelledAddon,
    emitAddonCoverageRemoved,
    runOrphanhood
} from '../../../src/services/billing/addon/addon-instance-a5';
import { findOrphanhoodCandidates } from '../../../src/services/billing/addon/addon-orphanhood';
import {
    closeServiceTestPool,
    isServiceTestDbAvailable,
    withServiceTestTransaction
} from './helpers';
import {
    orphanNow as now,
    orphanPorts,
    readDecisions,
    readInstance,
    readSubscription,
    seedComplement,
    seedOrphanInstance,
    seedOrphanOwner,
    seedPrincipal
} from './support/addon-orphan-fixtures';
import { seedCoveragePayment } from './support/coverage-fixtures';

afterAll(closeServiceTestPool);

const V = VerticalEnum.ACCOMMODATION;
const W = VerticalEnum.GASTRONOMY;

/** A VERTICAL_SUBSCRIPTION instance on `targetId`, with a card complement linked to MP. */
async function seedVerticalAddon(
    tx: DrizzleClient,
    input: {
        readonly userId: string;
        readonly targetId: string;
        readonly instanceStatus?: string;
        readonly complementStatus?: string;
    }
) {
    const complement = await seedComplement(tx, {
        userId: input.userId,
        vertical: V,
        status: input.complementStatus ?? 'ACTIVE'
    });
    const { instanceId } = await seedOrphanInstance(tx, {
        ownerId: input.userId,
        scopeType: 'VERTICAL_SUBSCRIPTION',
        compatibleVerticals: [V],
        status: input.instanceStatus ?? 'ACTIVE',
        targetId: input.targetId,
        complementSubscriptionId: complement.subscriptionId
    });
    return { instanceId, complementId: complement.subscriptionId, complement };
}

async function expectUntouched(
    tx: DrizzleClient,
    seeded: { readonly instanceId: string; readonly complementId: string },
    instanceStatus = 'ACTIVE'
) {
    expect((await readInstance(tx, seeded.instanceId)).status).toBe(instanceStatus);
    expect((await readSubscription(tx, seeded.complementId)).status).toBe('ACTIVE');
    expect(await readDecisions(tx, seeded.complementId)).toHaveLength(0);
}

async function expectOrphaned(
    tx: DrizzleClient,
    seeded: { readonly instanceId: string; readonly complementId: string }
) {
    expect((await readInstance(tx, seeded.instanceId)).status).toBe('CANCELLED');
    expect((await readSubscription(tx, seeded.complementId)).status).toBe('CANCELLED');
    const decisions = await readDecisions(tx, seeded.complementId);
    expect(decisions).toHaveLength(1);
    expect(decisions[0]?.reason).toBe('A5');
}

describe.skipIf(!isServiceTestDbAvailable())(
    'HOS-1545 TEST:B5:13 AC:B5:25 A5 cancels only the effectively orphaned instance',
    () => {
        it('(a) VERTICAL_SUBSCRIPTION, principal CANCELLED without succession or anchor: instance and complement CANCELLED, decision A5', async () => {
            await withServiceTestTransaction(async (tx) => {
                // Arrange
                const { userId } = await seedOrphanOwner(tx);
                const { subscriptionId } = await seedPrincipal(tx, {
                    userId,
                    vertical: V,
                    status: 'CANCELLED'
                });
                const seeded = await seedVerticalAddon(tx, { userId, targetId: subscriptionId });
                const { ports } = orphanPorts(tx);

                // Act
                const { cancelled } = await runOrphanhood({ tx, subscriptionId, now }, ports);

                // Assert
                await expectOrphaned(tx, seeded);
                expect(cancelled).toEqual([
                    {
                        instanceId: seeded.instanceId,
                        ownerId: userId,
                        clause: 'ORPHANED',
                        coverageVerticals: [V],
                        complementSubscriptionId: seeded.complementId,
                        providerCancellation: {
                            subscriptionId: seeded.complementId,
                            userId,
                            authorizationId: seeded.complement.authorizationId
                        }
                    }
                ]);
            });
        });

        it('(b) the same from PENDING_AUTHORIZATION of the instance', async () => {
            await withServiceTestTransaction(async (tx) => {
                const { userId } = await seedOrphanOwner(tx);
                const { subscriptionId } = await seedPrincipal(tx, {
                    userId,
                    vertical: V,
                    status: 'CANCELLED'
                });
                const seeded = await seedVerticalAddon(tx, {
                    userId,
                    targetId: subscriptionId,
                    instanceStatus: 'PENDING_AUTHORIZATION',
                    complementStatus: 'PENDING_AUTHORIZATION'
                });

                const { cancelled } = await runOrphanhood(
                    { tx, subscriptionId, now },
                    orphanPorts(tx).ports
                );

                await expectOrphaned(tx, seeded);
                // A pending instance emitted no ADDON source: nothing to notify (I-7).
                expect(cancelled[0]?.coverageVerticals).toEqual([]);
            });
        });

        it('(c) principal CANCELLED with a LIVE successor pointing at it: nothing changes', async () => {
            await withServiceTestTransaction(async (tx) => {
                const { userId } = await seedOrphanOwner(tx);
                const { subscriptionId } = await seedPrincipal(tx, {
                    userId,
                    vertical: V,
                    status: 'CANCELLED'
                });
                await seedPrincipal(tx, {
                    userId,
                    vertical: V,
                    status: 'PENDING_AUTHORIZATION',
                    succeedsId: subscriptionId
                });
                const seeded = await seedVerticalAddon(tx, { userId, targetId: subscriptionId });

                const { cancelled } = await runOrphanhood(
                    { tx, subscriptionId, now },
                    orphanPorts(tx).ports
                );

                expect(cancelled).toEqual([]);
                await expectUntouched(tx, seeded);
            });
        });

        it('(d) principal CANCELLED with succeeded_by_id written: nothing changes', async () => {
            await withServiceTestTransaction(async (tx) => {
                const { userId } = await seedOrphanOwner(tx);
                const { subscriptionId: closedSuccessor } = await seedPrincipal(tx, {
                    userId,
                    vertical: V,
                    status: 'CANCELLED'
                });
                const { subscriptionId } = await seedPrincipal(tx, {
                    userId,
                    vertical: V,
                    status: 'CANCELLED',
                    succeededById: closedSuccessor
                });
                const seeded = await seedVerticalAddon(tx, { userId, targetId: subscriptionId });

                const { cancelled } = await runOrphanhood(
                    { tx, subscriptionId, now },
                    orphanPorts(tx).ports
                );

                expect(cancelled).toEqual([]);
                await expectUntouched(tx, seeded);
            });
        });

        it('(e) principal CANCELLED with an ABANDONED successor pointing at it: orphaned', async () => {
            await withServiceTestTransaction(async (tx) => {
                const { userId } = await seedOrphanOwner(tx);
                const { subscriptionId } = await seedPrincipal(tx, {
                    userId,
                    vertical: V,
                    status: 'CANCELLED'
                });
                await seedPrincipal(tx, {
                    userId,
                    vertical: V,
                    status: 'ABANDONED',
                    succeedsId: subscriptionId
                });
                const seeded = await seedVerticalAddon(tx, { userId, targetId: subscriptionId });

                await runOrphanhood({ tx, subscriptionId, now }, orphanPorts(tx).ports);

                await expectOrphaned(tx, seeded);
            });
        });

        it('(f) a live anchor in (owner, vertical): nothing changes', async () => {
            await withServiceTestTransaction(async (tx) => {
                const { userId } = await seedOrphanOwner(tx);
                const { subscriptionId } = await seedPrincipal(tx, {
                    userId,
                    vertical: V,
                    status: 'CANCELLED'
                });
                const seeded = await seedVerticalAddon(tx, { userId, targetId: subscriptionId });
                const { ports, anchor } = orphanPorts(tx);
                anchor(userId, V);

                const { cancelled } = await runOrphanhood({ tx, subscriptionId, now }, ports);

                expect(cancelled).toEqual([]);
                await expectUntouched(tx, seeded);
            });
        });

        it('(g) group 2: the SUCCESSOR leaves (ABANDONED), its predecessor died unclosed, the complement hangs from the predecessor: orphaned', async () => {
            await withServiceTestTransaction(async (tx) => {
                const { userId } = await seedOrphanOwner(tx);
                const { subscriptionId: predecessorId } = await seedPrincipal(tx, {
                    userId,
                    vertical: V,
                    status: 'CANCELLED'
                });
                const { subscriptionId: successorId } = await seedPrincipal(tx, {
                    userId,
                    vertical: V,
                    status: 'ABANDONED',
                    succeedsId: predecessorId
                });
                const seeded = await seedVerticalAddon(tx, { userId, targetId: predecessorId });

                await runOrphanhood(
                    { tx, subscriptionId: successorId, now },
                    orphanPorts(tx).ports
                );

                await expectOrphaned(tx, seeded);
            });
        });

        it('(h) LISTING: another live principal of the user + vertical relieves it; none orphans it; a listing of another vertical is no candidate', async () => {
            await withServiceTestTransaction(async (tx) => {
                const { ports, setListing } = orphanPorts(tx);
                const listingFor = async (input: {
                    readonly userId: string;
                    readonly vertical: string;
                }) => {
                    const listingId = crypto.randomUUID();
                    setListing(listingId, {
                        vertical: input.vertical as VerticalEnum,
                        ownerId: input.userId,
                        acceptsFeature: true
                    });
                    const complement = await seedComplement(tx, {
                        userId: input.userId,
                        vertical: input.vertical,
                        status: 'ACTIVE'
                    });
                    const { instanceId } = await seedOrphanInstance(tx, {
                        ownerId: input.userId,
                        scopeType: 'LISTING',
                        compatibleVerticals: [V, W],
                        status: 'ACTIVE',
                        targetId: listingId,
                        complementSubscriptionId: complement.subscriptionId
                    });
                    return { instanceId, complementId: complement.subscriptionId };
                };

                // relieved: another principal of the same user + vertical is live
                const relievedOwner = (await seedOrphanOwner(tx)).userId;
                const relievedLeft = await seedPrincipal(tx, {
                    userId: relievedOwner,
                    vertical: V,
                    status: 'CANCELLED'
                });
                await seedPrincipal(tx, { userId: relievedOwner, vertical: V, status: 'ACTIVE' });
                const relieved = await listingFor({ userId: relievedOwner, vertical: V });
                await runOrphanhood(
                    { tx, subscriptionId: relievedLeft.subscriptionId, now },
                    ports
                );
                await expectUntouched(tx, relieved);

                // orphaned: no principal of the user + vertical is live
                const orphanOwner = (await seedOrphanOwner(tx)).userId;
                const orphanLeft = await seedPrincipal(tx, {
                    userId: orphanOwner,
                    vertical: V,
                    status: 'CANCELLED'
                });
                const orphan = await listingFor({ userId: orphanOwner, vertical: V });
                await runOrphanhood({ tx, subscriptionId: orphanLeft.subscriptionId, now }, ports);
                await expectOrphaned(tx, orphan);

                // a listing of another vertical is not a candidate
                const otherOwner = (await seedOrphanOwner(tx)).userId;
                const otherLeft = await seedPrincipal(tx, {
                    userId: otherOwner,
                    vertical: V,
                    status: 'CANCELLED'
                });
                const other = await listingFor({ userId: otherOwner, vertical: W });
                const { candidates } = await findOrphanhoodCandidates(
                    {
                        tx,
                        leftRow: {
                            id: otherLeft.subscriptionId,
                            userId: otherOwner,
                            vertical: V,
                            predecessorId: null
                        }
                    },
                    ports
                );
                expect(candidates.map((c) => c.id)).not.toContain(other.instanceId);
                await runOrphanhood({ tx, subscriptionId: otherLeft.subscriptionId, now }, ports);
                await expectUntouched(tx, other);
            });
        });

        it('(i) USER/GLOBAL compatible with V and W: only a live AND paying principal (or anchor) relieves it', async () => {
            await withServiceTestTransaction(async (tx) => {
                const { ports } = orphanPorts(tx);
                const scenario = async (input: {
                    readonly scopeType: 'USER' | 'GLOBAL';
                    readonly compatibleVerticals: readonly string[];
                    readonly arrangeW: (userId: string) => Promise<void>;
                }) => {
                    const { userId } = await seedOrphanOwner(tx);
                    const left = await seedPrincipal(tx, {
                        userId,
                        vertical: V,
                        status: 'CANCELLED'
                    });
                    await input.arrangeW(userId);
                    const complement = await seedComplement(tx, {
                        userId,
                        vertical: V,
                        status: 'ACTIVE'
                    });
                    const { instanceId } = await seedOrphanInstance(tx, {
                        ownerId: userId,
                        scopeType: input.scopeType,
                        compatibleVerticals: input.compatibleVerticals,
                        status: 'ACTIVE',
                        complementSubscriptionId: complement.subscriptionId
                    });
                    await runOrphanhood({ tx, subscriptionId: left.subscriptionId, now }, ports);
                    return { instanceId, complementId: complement.subscriptionId };
                };

                // W ACTIVE with a credited payment: relieved
                const paid = await scenario({
                    scopeType: 'USER',
                    compatibleVerticals: [V, W],
                    arrangeW: async (userId) => {
                        const w = await seedPrincipal(tx, {
                            userId,
                            vertical: W,
                            status: 'ACTIVE'
                        });
                        await seedCoveragePayment(tx, {
                            subscriptionId: w.subscriptionId,
                            status: 'SUCCEEDED'
                        });
                    }
                });
                await expectUntouched(tx, paid);

                // W ACTIVE without payment and without a paying predecessor: orphaned
                const unpaid = await scenario({
                    scopeType: 'GLOBAL',
                    compatibleVerticals: [V, W],
                    arrangeW: async (userId) => {
                        await seedPrincipal(tx, { userId, vertical: W, status: 'ACTIVE' });
                    }
                });
                await expectOrphaned(tx, unpaid);

                // W successor of a predecessor that was paying: relieved
                const inherited = await scenario({
                    scopeType: 'USER',
                    compatibleVerticals: [V, W],
                    arrangeW: async (userId) => {
                        const predecessor = await seedPrincipal(tx, {
                            userId,
                            vertical: W,
                            status: 'CANCELLED'
                        });
                        await seedCoveragePayment(tx, {
                            subscriptionId: predecessor.subscriptionId,
                            status: 'SUCCEEDED'
                        });
                        await seedPrincipal(tx, {
                            userId,
                            vertical: W,
                            status: 'ACTIVE',
                            succeedsId: predecessor.subscriptionId
                        });
                    }
                });
                await expectUntouched(tx, inherited);

                // W PAUSED with a payment: a live row, relieved
                const paused = await scenario({
                    scopeType: 'GLOBAL',
                    compatibleVerticals: [V, W],
                    arrangeW: async (userId) => {
                        const w = await seedPrincipal(tx, {
                            userId,
                            vertical: W,
                            status: 'PAUSED'
                        });
                        await seedCoveragePayment(tx, {
                            subscriptionId: w.subscriptionId,
                            status: 'SUCCEEDED'
                        });
                    }
                });
                await expectUntouched(tx, paused);

                // a product not compatible with V is not a candidate
                const incompatible = await scenario({
                    scopeType: 'USER',
                    compatibleVerticals: [W],
                    arrangeW: async () => {}
                });
                await expectUntouched(tx, incompatible);
            });
        });

        it('(j) the evaluated row is still live (CANCEL_SCHEDULED): { cancelled: [] } and nothing written', async () => {
            await withServiceTestTransaction(async (tx) => {
                const { userId } = await seedOrphanOwner(tx);
                const { subscriptionId } = await seedPrincipal(tx, {
                    userId,
                    vertical: V,
                    status: 'CANCEL_SCHEDULED'
                });
                const complement = await seedComplement(tx, {
                    userId,
                    vertical: V,
                    status: 'ACTIVE'
                });
                const { instanceId } = await seedOrphanInstance(tx, {
                    ownerId: userId,
                    scopeType: 'USER',
                    compatibleVerticals: [V],
                    status: 'ACTIVE',
                    complementSubscriptionId: complement.subscriptionId
                });

                const result = await runOrphanhood(
                    { tx, subscriptionId, now },
                    orphanPorts(tx).ports
                );

                expect(result).toEqual({ cancelled: [] });
                await expectUntouched(tx, { instanceId, complementId: complement.subscriptionId });
            });
        });

        it.each([
            'EXPIRED',
            'ABANDONED',
            'CANCELLED'
        ])('(k) an instance in %s is left intact', async (status) => {
            await withServiceTestTransaction(async (tx) => {
                const { userId } = await seedOrphanOwner(tx);
                const { subscriptionId } = await seedPrincipal(tx, {
                    userId,
                    vertical: V,
                    status: 'CANCELLED'
                });
                const seeded = await seedVerticalAddon(tx, {
                    userId,
                    targetId: subscriptionId,
                    instanceStatus: status
                });
                const { ports } = orphanPorts(tx);
                const before = await readInstance(tx, seeded.instanceId);

                const run = await runOrphanhood({ tx, subscriptionId, now }, ports);
                const direct = await applyA5(
                    { tx, instanceId: seeded.instanceId, clause: 'ORPHANED', now },
                    ports
                );

                expect(run.cancelled).toEqual([]);
                expect(direct).toEqual({ outcome: 'NOT_APPLICABLE' });
                expect(await readInstance(tx, seeded.instanceId)).toEqual(before);
                await expectUntouched(tx, seeded, status);
            });
        });

        it('(l) a UNA_VEZ instance without complement: CANCELLED, no S21 and no decision', async () => {
            await withServiceTestTransaction(async (tx) => {
                const { userId } = await seedOrphanOwner(tx);
                const { subscriptionId } = await seedPrincipal(tx, {
                    userId,
                    vertical: V,
                    status: 'CANCELLED'
                });
                const { instanceId } = await seedOrphanInstance(tx, {
                    ownerId: userId,
                    scopeType: 'VERTICAL_SUBSCRIPTION',
                    compatibleVerticals: [V],
                    status: 'ACTIVE',
                    targetId: subscriptionId,
                    chargeKind: 'UNA_VEZ'
                });

                const { cancelled } = await runOrphanhood(
                    { tx, subscriptionId, now },
                    orphanPorts(tx).ports
                );

                expect((await readInstance(tx, instanceId)).status).toBe('CANCELLED');
                expect(cancelled).toHaveLength(1);
                expect(cancelled[0]?.complementSubscriptionId).toBeNull();
                expect(cancelled[0]?.providerCancellation).toBeNull();
            });
        });

        it.each([
            { label: 'without provider link', paymentMethod: 'CARD' as const, withLink: false },
            { label: 'MANUAL', paymentMethod: 'MANUAL' as const, withLink: true }
        ])('(m) a complement $label: CANCELLED without decision', async (variant) => {
            await withServiceTestTransaction(async (tx) => {
                const { userId } = await seedOrphanOwner(tx);
                const { subscriptionId } = await seedPrincipal(tx, {
                    userId,
                    vertical: V,
                    status: 'CANCELLED'
                });
                const complement = await seedComplement(tx, {
                    userId,
                    vertical: V,
                    status: 'ACTIVE',
                    paymentMethod: variant.paymentMethod,
                    withLink: variant.withLink
                });
                const { instanceId } = await seedOrphanInstance(tx, {
                    ownerId: userId,
                    scopeType: 'VERTICAL_SUBSCRIPTION',
                    compatibleVerticals: [V],
                    status: 'ACTIVE',
                    targetId: subscriptionId,
                    complementSubscriptionId: complement.subscriptionId
                });

                const { cancelled } = await runOrphanhood(
                    { tx, subscriptionId, now },
                    orphanPorts(tx).ports
                );

                expect((await readInstance(tx, instanceId)).status).toBe('CANCELLED');
                expect((await readSubscription(tx, complement.subscriptionId)).status).toBe(
                    'CANCELLED'
                );
                expect(await readDecisions(tx, complement.subscriptionId)).toHaveLength(0);
                expect(cancelled[0]?.providerCancellation).toBeNull();
            });
        });

        it('(n) applyA5 with WITHDRAWN on a live instance: CANCELLED + S21', async () => {
            await withServiceTestTransaction(async (tx) => {
                const { userId } = await seedOrphanOwner(tx);
                const { subscriptionId } = await seedPrincipal(tx, {
                    userId,
                    vertical: V,
                    status: 'ACTIVE'
                });
                const seeded = await seedVerticalAddon(tx, { userId, targetId: subscriptionId });

                const result = await applyA5(
                    { tx, instanceId: seeded.instanceId, clause: 'WITHDRAWN', now },
                    orphanPorts(tx).ports
                );

                expect(result.outcome).toBe('CANCELLED');
                if (result.outcome === 'CANCELLED') expect(result.addon.clause).toBe('WITHDRAWN');
                await expectOrphaned(tx, seeded);
                expect((await readSubscription(tx, subscriptionId)).status).toBe('ACTIVE');
            });
        });

        it('(o) emitAddonCoverageRemoved: one REMOVED ADDON per (owner, vertical); a port error is not propagated', async () => {
            // Arrange
            const owner = crypto.randomUUID();
            const other = crypto.randomUUID();
            const addon = (input: {
                readonly ownerId: string;
                readonly coverageVerticals: readonly string[];
            }): CancelledAddon => ({
                instanceId: crypto.randomUUID(),
                ownerId: input.ownerId,
                clause: 'ORPHANED',
                coverageVerticals: input.coverageVerticals,
                complementSubscriptionId: null,
                providerCancellation: null
            });
            const cancelled = [
                addon({ ownerId: owner, coverageVerticals: [V, W] }),
                addon({ ownerId: owner, coverageVerticals: [V] }),
                addon({ ownerId: other, coverageVerticals: [V] }),
                addon({ ownerId: other, coverageVerticals: [] })
            ];
            const events: CoverageChangedEvent[] = [];

            // Act
            await emitAddonCoverageRemoved({
                cancelled,
                coverageNotices: {
                    async emitCoverageChanged(event) {
                        events.push(event);
                    }
                }
            });
            const failing = emitAddonCoverageRemoved({
                cancelled,
                coverageNotices: {
                    async emitCoverageChanged() {
                        throw new Error('listener down');
                    }
                }
            });

            // Assert
            expect(events).toEqual([
                { userId: owner, vertical: V, sourceType: 'ADDON', change: 'REMOVED' },
                { userId: owner, vertical: W, sourceType: 'ADDON', change: 'REMOVED' },
                { userId: other, vertical: V, sourceType: 'ADDON', change: 'REMOVED' }
            ]);
            await expect(failing).resolves.toBeUndefined();
        });

        it("(p) runOrphanhood writes nothing outside the caller's transaction: rolled back, no row changed", async () => {
            await withServiceTestTransaction(async (tx) => {
                const { userId } = await seedOrphanOwner(tx);
                const { subscriptionId } = await seedPrincipal(tx, {
                    userId,
                    vertical: V,
                    status: 'CANCELLED'
                });
                const seeded = await seedVerticalAddon(tx, { userId, targetId: subscriptionId });
                const { ports } = orphanPorts(tx);
                const rollback = new Error('caller rolls back');

                const inner = tx.transaction(async (caller) => {
                    const callerTx = caller as unknown as DrizzleClient;
                    const { cancelled } = await runOrphanhood(
                        { tx: callerTx, subscriptionId, now },
                        ports
                    );
                    // Not vacuous: inside the caller's transaction it did cancel.
                    expect(cancelled).toHaveLength(1);
                    expect((await readInstance(callerTx, seeded.instanceId)).status).toBe(
                        'CANCELLED'
                    );
                    throw rollback;
                });

                await expect(inner).rejects.toBe(rollback);
                await expectUntouched(tx, seeded);
            });
        });
    }
);
