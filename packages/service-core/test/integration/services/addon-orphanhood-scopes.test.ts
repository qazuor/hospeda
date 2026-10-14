/**
 * TEST:B5:13 (integration with DB), the local half of AC:B5:25 (HOS-1545), cases (j)-(p): the orphanhood of
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
    readDecisions,
    readInstance,
    readSubscription,
    seedComplement,
    seedOrphanInstance,
    seedOrphanOwner,
    seedPrincipal,
    seedVerticalAddon
} from './support/addon-orphan-fixtures';

afterAll(closeServiceTestPool);

const V = VerticalEnum.ACCOMMODATION;
const W = VerticalEnum.GASTRONOMY;

describe.skipIf(!isServiceTestDbAvailable())(
    'HOS-1545 TEST:B5:13 AC:B5:25 A5 is local, from its two live states, and notifies after the commit',
    () => {
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
