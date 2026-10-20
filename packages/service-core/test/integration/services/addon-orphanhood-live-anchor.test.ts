import { addonInstances, eq, subscriptions } from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { VerticalEnum } from '@repo/schemas';
import { afterAll, describe, expect, it } from 'vitest';
import { runOrphanhood } from '../../../src/services/billing/addon/addon-instance-a5';
import { grantPermanentGrant } from '../../../src/services/billing/grant/permanent-grant.service.js';
import { hasLivePermanentGrantAnchor } from '../../../src/services/billing/grant/permanent-grant-live-anchors';
import {
    closeServiceTestPool,
    getServiceTestDb,
    isServiceTestDbAvailable,
    withServiceTestTransaction
} from './helpers';
import {
    expectOrphaned,
    expectUntouched,
    orphanNow,
    readDecisions,
    readInstance,
    seedOrphanInstance,
    seedOrphanOwner,
    seedPrincipal,
    seedVerticalAddon
} from './support/addon-orphan-fixtures';
import { addonPolicyFromTx } from './support/coverage-fixtures';
import {
    currentFloorPolicy,
    retirePermanentGrantRows,
    seedGrantPlan,
    seedPermanentGrant
} from './support/permanent-grant-fixtures';
import { grantSignerActor } from './support/permanent-grant-fixtures.js';

afterAll(closeServiceTestPool);

const V = VerticalEnum.ACCOMMODATION;
const W = VerticalEnum.GASTRONOMY;
const listing = async () => ({
    vertical: V,
    ownerId: '00000000-0000-4000-8000-000000000001',
    acceptsFeature: false
});

describe.skipIf(!isServiceTestDbAvailable())(
    'HOS-1582 Coord-362 — A5 reads the real live anchor (AC:B5:25, third half)',
    () => {
        it('(a) a live matching anchor protects a VERTICAL_SUBSCRIPTION instance', async () => {
            await withServiceTestTransaction(async (tx) => {
                const { userId } = await seedOrphanOwner(tx);
                const { userId: adminId } = await seedOrphanOwner(tx);
                const { subscriptionId } = await seedPrincipal(tx, {
                    userId,
                    vertical: V,
                    status: 'CANCELLED'
                });
                await seedPermanentGrant(tx, {
                    beneficiaryUserId: userId,
                    grantedBy: adminId,
                    anchors: [{ vertical: V }]
                });
                const seeded = await seedVerticalAddon(tx, { userId, targetId: subscriptionId });
                const result = await runOrphanhood(
                    { tx, subscriptionId, now: orphanNow },
                    { addonPolicy: addonPolicyFromTx(tx), listing }
                );
                expect(result.cancelled).toEqual([]);
                await expectUntouched(tx, seeded);
            });
        });

        it('(b) a live V anchor protects a LISTING addon when no live principal remains', async () => {
            await withServiceTestTransaction(async (tx) => {
                const { userId } = await seedOrphanOwner(tx);
                const { userId: adminId } = await seedOrphanOwner(tx);
                const { subscriptionId } = await seedPrincipal(tx, {
                    userId,
                    vertical: V,
                    status: 'CANCELLED'
                });
                await seedPermanentGrant(tx, {
                    beneficiaryUserId: userId,
                    grantedBy: adminId,
                    anchors: [{ vertical: V }]
                });
                const seeded = await seedOrphanInstance(tx, {
                    ownerId: userId,
                    scopeType: 'LISTING',
                    compatibleVerticals: [V],
                    status: 'ACTIVE',
                    targetId: subscriptionId
                });
                const result = await runOrphanhood(
                    { tx, subscriptionId, now: orphanNow },
                    {
                        addonPolicy: addonPolicyFromTx(tx),
                        listing: async () => ({
                            vertical: V,
                            ownerId: userId,
                            acceptsFeature: false
                        })
                    }
                );
                expect(result.cancelled).toEqual([]);
                expect(
                    (
                        await tx
                            .select({ status: addonInstances.status })
                            .from(addonInstances)
                            .where(eq(addonInstances.id, seeded.instanceId))
                    )[0]?.status
                ).toBe('ACTIVE');
            });
        });

        it('(c) a V anchor does not protect a USER addon made orphan by leaving W', async () => {
            await withServiceTestTransaction(async (tx) => {
                const { userId } = await seedOrphanOwner(tx);
                const { userId: adminId } = await seedOrphanOwner(tx);
                const { subscriptionId } = await seedPrincipal(tx, {
                    userId,
                    vertical: W,
                    status: 'CANCELLED'
                });
                await seedPermanentGrant(tx, {
                    beneficiaryUserId: userId,
                    grantedBy: adminId,
                    anchors: [{ vertical: V }]
                });
                const seeded = await seedOrphanInstance(tx, {
                    ownerId: userId,
                    scopeType: 'USER',
                    compatibleVerticals: [V, W],
                    status: 'ACTIVE'
                });
                const result = await runOrphanhood(
                    { tx, subscriptionId, now: orphanNow },
                    { addonPolicy: addonPolicyFromTx(tx), listing }
                );
                expect(result.cancelled).toEqual([]);
                expect((await readInstance(tx, seeded.instanceId)).status).toBe('ACTIVE');
            });
        });

        it.each([
            ['(d) revoked grant', [{ vertical: V }], true, 'same'],
            ['(e) anchor only in W', [{ vertical: W }], false, 'same'],
            ['(f) grant belongs to another user', [{ vertical: V }], false, 'other']
        ] as const)('%s does not protect the instance', async (_label, anchors, revoked, beneficiary) => {
            await withServiceTestTransaction(async (tx) => {
                const { userId } = await seedOrphanOwner(tx);
                const { userId: adminId } = await seedOrphanOwner(tx);
                const { userId: otherId } = await seedOrphanOwner(tx);
                const { subscriptionId } = await seedPrincipal(tx, {
                    userId,
                    vertical: V,
                    status: 'CANCELLED'
                });
                await seedPermanentGrant(tx, {
                    beneficiaryUserId: beneficiary === 'same' ? userId : otherId,
                    grantedBy: adminId,
                    anchors,
                    revoked
                });
                const seeded = await seedVerticalAddon(tx, { userId, targetId: subscriptionId });
                const result = await runOrphanhood(
                    { tx, subscriptionId, now: orphanNow },
                    { addonPolicy: addonPolicyFromTx(tx), listing }
                );
                expect(result.cancelled).toHaveLength(1);
                await expectOrphaned(tx, seeded);
            });
        });

        it('(g) reads the caller transaction and does not see its uncommitted anchor globally', async () => {
            await withServiceTestTransaction(async (tx) => {
                const { userId } = await seedOrphanOwner(tx);
                const { userId: adminId } = await seedOrphanOwner(tx);
                await seedPermanentGrant(tx, {
                    beneficiaryUserId: userId,
                    grantedBy: adminId,
                    anchors: [{ vertical: V }]
                });
                expect(await hasLivePermanentGrantAnchor({ userId, vertical: V, tx })).toBe(true);
                expect(
                    await hasLivePermanentGrantAnchor({
                        userId,
                        vertical: V,
                        tx: getServiceTestDb()
                    })
                ).toBe(false);
            });
        });

        it('(h) rejects a non-UUID user id instead of returning false', async () => {
            await withServiceTestTransaction(async (tx) => {
                await expect(
                    hasLivePermanentGrantAnchor({ userId: 'invalid', vertical: V, tx })
                ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
            });
        });
    }
);

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B9a:1 — S13 keeps an addon protected by the new live anchor (AC:B9a:1)',
    () => {
        it('i — the grant act cancels the principal while A5 leaves its anchored addon and complement active', async () => {
            const seeded = await getServiceTestDb().transaction(async (tx) => {
                const { userId } = await seedOrphanOwner(tx);
                const { userId: adminId } = await seedOrphanOwner(tx);
                const { subscriptionId } = await seedPrincipal(tx, {
                    userId,
                    vertical: V,
                    status: 'ACTIVE'
                });
                const addon = await seedVerticalAddon(tx, { userId, targetId: subscriptionId });
                const plan = await seedGrantPlan(tx, V);
                return { userId, adminId, subscriptionId, addon, plan };
            });
            try {
                const result = await grantPermanentGrant(
                    {
                        beneficiaryUserId: seeded.userId,
                        actor: grantSignerActor(seeded.adminId),
                        reason: 'live anchor orphanhood case',
                        includesAddons: false,
                        anchors: [{ vertical: V, ...seeded.plan }]
                    },
                    {
                        planPolicy: currentFloorPolicy,
                        clock: { now: () => orphanNow },
                        provider: new FakePaymentProvider({
                            idNamespace: crypto.randomUUID(),
                            clock: { now: () => orphanNow }
                        }),
                        beforeCancelNotice: { beforeCancel: async () => 'SENT' as const },
                        coverageNotices: { emitCoverageChanged: async () => undefined },
                        orphanhood: {
                            addonPolicy: addonPolicyFromTx(getServiceTestDb()),
                            listing: async () => {
                                throw new Error('no listing addon');
                            }
                        }
                    }
                );
                const [principal] = await getServiceTestDb()
                    .select()
                    .from(subscriptions)
                    .where(eq(subscriptions.id, seeded.subscriptionId));
                expect(principal?.status).toBe('CANCELLED');
                await expectUntouched(getServiceTestDb(), seeded.addon);
                expect(
                    await readDecisions(getServiceTestDb(), seeded.addon.complementId)
                ).toHaveLength(0);
                expect(result.cancelledSubscriptionIds).toEqual([seeded.subscriptionId]);
            } finally {
                await retirePermanentGrantRows([seeded.userId, seeded.adminId]);
            }
        });
    }
);
