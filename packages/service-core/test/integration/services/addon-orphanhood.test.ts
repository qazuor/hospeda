import { VerticalEnum } from '@repo/schemas';
import { afterAll, describe, expect, it } from 'vitest';
import { runOrphanhood } from '../../../src/services/billing/addon/addon-instance-a5';
import { findOrphanhoodCandidates } from '../../../src/services/billing/addon/addon-orphanhood';
import {
    closeServiceTestPool,
    isServiceTestDbAvailable,
    withServiceTestTransaction
} from './helpers';
import {
    expectOrphaned,
    expectUntouched,
    orphanNow as now,
    orphanPorts,
    seedComplement,
    seedOrphanInstance,
    seedOrphanOwner,
    seedPrincipal,
    seedVerticalAddon
} from './support/addon-orphan-fixtures';
import { seedCoveragePayment } from './support/coverage-fixtures';

afterAll(closeServiceTestPool);

const V = VerticalEnum.ACCOMMODATION;
const W = VerticalEnum.VENUE;

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
    }
);
