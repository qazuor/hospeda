import {
    addonInstances,
    and,
    type DrizzleClient,
    domainEventModel,
    emailOutbox,
    eq,
    inArray,
    permanentGrants,
    permanentGrantVerticals,
    providerLinks,
    subscriptions
} from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import { VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import {
    anchorPermanentGrantVertical,
    grantPermanentGrant
} from '../../../src/services/billing/grant/permanent-grant.service.js';
import { runS20InTransaction } from '../../../src/services/billing/grant/permanent-grant-s20.js';
import {
    closeServiceTestPool,
    getServiceTestDb,
    isServiceTestDbAvailable,
    withServiceTestTransaction
} from './helpers.js';
import {
    ORPHAN_VERTICAL,
    orphanNow,
    orphanPorts,
    readDecisions,
    readPauses,
    readSubscription,
    seedComplement,
    seedOrphanInstance,
    seedOrphanOwner,
    seedPrincipal
} from './support/addon-orphan-fixtures.js';
import {
    addonPolicyFromTx,
    seedCoveragePlanVersion,
    seedCoverageSubscription,
    seedCoverageUser
} from './support/coverage-fixtures.js';
import { outboxBeforeCancelNotice } from './support/outbox-before-cancel-notice.js';
import { namespaceFake } from './support/payment-provider.js';
import {
    currentFloorPolicy,
    grantSignerActor,
    retirePermanentGrantRows,
    seedGrantPlan,
    seedPermanentGrant
} from './support/permanent-grant-fixtures.js';
import { retireS20Rows, seedS20Addon } from './support/permanent-grant-s20-fixtures.js';

const now = new Date('2026-10-14T12:00:00.000Z');
const clock = { now: () => now };
const userIds: string[] = [];
const principalIds: string[] = [];
afterAll(closeServiceTestPool);
afterEach(async () => {
    await retireS20Rows();
    if (principalIds.length) {
        const ids = principalIds.splice(0);
        await getServiceTestDb()
            .delete(providerLinks)
            .where(inArray(providerLinks.subscriptionId, ids));
        await getServiceTestDb().delete(subscriptions).where(inArray(subscriptions.id, ids));
    }
    if (userIds.length)
        await getServiceTestDb()
            .delete(emailOutbox)
            .where(inArray(emailOutbox.recipientUserId, userIds));
    await retirePermanentGrantRows(userIds.splice(0));
});

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B9a:4 — S20 converts paid addons in grant order',
    () => {
        it.each([
            'PENDING_AUTHORIZATION',
            'ACTIVE',
            'GRACE_PERIOD',
            'PAUSED',
            'SUSPENDED',
            'CANCEL_SCHEDULED'
        ] as const)('b — TEST:B9a:4 six live complement states: %s cancel and ACTIVE instances receive the anchor', async (status) =>
            withServiceTestTransaction(async (tx) => {
                const { userId } = await seedOrphanOwner(tx);
                const { grantId, anchorIds } = await seedPermanentGrant(tx, {
                    beneficiaryUserId: userId,
                    grantedBy: userId,
                    anchors: [{ vertical: ORPHAN_VERTICAL }],
                    includesAddons: true
                });
                const { subscriptionId: targetId } = await seedPrincipal(tx, {
                    userId,
                    vertical: ORPHAN_VERTICAL,
                    status: 'ACTIVE'
                });
                const { subscriptionId } = await seedComplement(tx, {
                    userId,
                    vertical: ORPHAN_VERTICAL,
                    status,
                    grace: true,
                    openPause: status === 'PAUSED'
                });
                const { instanceId } = await seedOrphanInstance(tx, {
                    ownerId: userId,
                    scopeType: 'VERTICAL_SUBSCRIPTION',
                    compatibleVerticals: [ORPHAN_VERTICAL],
                    status: 'ACTIVE',
                    targetId,
                    complementSubscriptionId: subscriptionId
                });
                await runS20InTransaction(
                    {
                        tx,
                        includesAddons: true,
                        permanentGrantId: grantId,
                        beneficiaryUserId: userId,
                        anchors: [{ id: anchorIds[0]!, vertical: ORPHAN_VERTICAL }],
                        now: orphanNow,
                        actorId: userId
                    },
                    { orphanhood: orphanPorts(tx).ports }
                );
                expect((await readSubscription(tx, subscriptionId)).status).toBe('CANCELLED');
                expect((await readSubscription(tx, subscriptionId)).graceStartedAt).toBeNull();
                expect((await readSubscription(tx, subscriptionId)).graceEndsAt).toBeNull();
                const [stored] = await tx
                    .select({
                        status: addonInstances.status,
                        titleAnchorId: addonInstances.titleAnchorId
                    })
                    .from(addonInstances)
                    .where(eq(addonInstances.id, instanceId));
                expect(stored?.status).toBe('ACTIVE');
                expect(stored?.titleAnchorId).toBe(anchorIds[0]);
            }));
        it.each([
            'ABANDONED',
            'CHARGE_DECLINED',
            'CANCELLED'
        ] as const)('b — TEST:B9a:4 non-live complement status %s is left unchanged', async (status) =>
            withServiceTestTransaction(async (tx) => {
                const { userId } = await seedOrphanOwner(tx);
                const { grantId, anchorIds } = await seedPermanentGrant(tx, {
                    beneficiaryUserId: userId,
                    grantedBy: userId,
                    anchors: [{ vertical: ORPHAN_VERTICAL }],
                    includesAddons: true
                });
                const { subscriptionId: targetId } = await seedPrincipal(tx, {
                    userId,
                    vertical: ORPHAN_VERTICAL,
                    status: 'ACTIVE'
                });
                const { subscriptionId } = await seedComplement(tx, {
                    userId,
                    vertical: ORPHAN_VERTICAL,
                    status
                });
                await seedOrphanInstance(tx, {
                    ownerId: userId,
                    scopeType: 'VERTICAL_SUBSCRIPTION',
                    compatibleVerticals: [ORPHAN_VERTICAL],
                    status: 'ACTIVE',
                    targetId,
                    complementSubscriptionId: subscriptionId
                });
                const before = await readSubscription(tx, subscriptionId);
                expect(
                    (
                        await runS20InTransaction(
                            {
                                tx,
                                includesAddons: true,
                                permanentGrantId: grantId,
                                beneficiaryUserId: userId,
                                anchors: [{ id: anchorIds[0]!, vertical: ORPHAN_VERTICAL }],
                                now: orphanNow,
                                actorId: userId
                            },
                            { orphanhood: orphanPorts(tx).ports }
                        )
                    ).rows
                ).toEqual([]);
                expect(await readSubscription(tx, subscriptionId)).toEqual(before);
            }));
        it('b — TEST:B9a:4 a CANCELLED instance with a live complement is outside S20', async () =>
            withServiceTestTransaction(async (tx) => {
                const { userId } = await seedOrphanOwner(tx);
                const { grantId, anchorIds } = await seedPermanentGrant(tx, {
                    beneficiaryUserId: userId,
                    grantedBy: userId,
                    anchors: [{ vertical: ORPHAN_VERTICAL }],
                    includesAddons: true
                });
                const { subscriptionId: targetId } = await seedPrincipal(tx, {
                    userId,
                    vertical: ORPHAN_VERTICAL,
                    status: 'ACTIVE'
                });
                const { subscriptionId } = await seedComplement(tx, {
                    userId,
                    vertical: ORPHAN_VERTICAL,
                    status: 'ACTIVE'
                });
                const { instanceId } = await seedOrphanInstance(tx, {
                    ownerId: userId,
                    scopeType: 'VERTICAL_SUBSCRIPTION',
                    compatibleVerticals: [ORPHAN_VERTICAL],
                    status: 'CANCELLED',
                    targetId,
                    complementSubscriptionId: subscriptionId
                });
                const result = await runS20InTransaction(
                    {
                        tx,
                        includesAddons: true,
                        permanentGrantId: grantId,
                        beneficiaryUserId: userId,
                        anchors: [{ id: anchorIds[0]!, vertical: ORPHAN_VERTICAL }],
                        now: orphanNow,
                        actorId: userId
                    },
                    { orphanhood: orphanPorts(tx).ports }
                );
                expect(result.rows).toEqual([]);
                expect((await readSubscription(tx, subscriptionId)).status).toBe('ACTIVE');
                const [instance] = await tx
                    .select({
                        status: addonInstances.status,
                        titleAnchorId: addonInstances.titleAnchorId
                    })
                    .from(addonInstances)
                    .where(eq(addonInstances.id, instanceId));
                expect(instance).toEqual({ status: 'CANCELLED', titleAnchorId: null });
            }));
        it('h — TEST:B9a:4 a null VERTICAL_SUBSCRIPTION target is rejected by the scope trigger', async () => {
            await expect(
                withServiceTestTransaction(async (tx) => {
                    const { userId } = await seedOrphanOwner(tx);
                    const { subscriptionId } = await seedComplement(tx, {
                        userId,
                        vertical: ORPHAN_VERTICAL,
                        status: 'ACTIVE'
                    });
                    await seedOrphanInstance(tx, {
                        ownerId: userId,
                        scopeType: 'VERTICAL_SUBSCRIPTION',
                        compatibleVerticals: [ORPHAN_VERTICAL],
                        status: 'ACTIVE',
                        targetId: null,
                        complementSubscriptionId: subscriptionId
                    });
                })
            ).rejects.toThrow();
        });
        it('c — TEST:B9a:4 pending instance remains unanchored while S20 cancels its row and records the decision', async () =>
            withServiceTestTransaction(async (tx) => {
                const { userId } = await seedOrphanOwner(tx);
                const { grantId, anchorIds } = await seedPermanentGrant(tx, {
                    beneficiaryUserId: userId,
                    grantedBy: userId,
                    anchors: [{ vertical: ORPHAN_VERTICAL }],
                    includesAddons: true
                });
                const { subscriptionId } = await seedComplement(tx, {
                    userId,
                    vertical: ORPHAN_VERTICAL,
                    status: 'PENDING_AUTHORIZATION'
                });
                const { subscriptionId: targetId } = await seedPrincipal(tx, {
                    userId,
                    vertical: ORPHAN_VERTICAL,
                    status: 'ACTIVE'
                });
                const { instanceId } = await seedOrphanInstance(tx, {
                    ownerId: userId,
                    scopeType: 'VERTICAL_SUBSCRIPTION',
                    compatibleVerticals: [ORPHAN_VERTICAL],
                    status: 'PENDING_AUTHORIZATION',
                    targetId,
                    complementSubscriptionId: subscriptionId
                });
                await runS20InTransaction(
                    {
                        tx,
                        includesAddons: true,
                        permanentGrantId: grantId,
                        beneficiaryUserId: userId,
                        anchors: [{ id: anchorIds[0]!, vertical: ORPHAN_VERTICAL }],
                        now: orphanNow,
                        actorId: userId
                    },
                    { orphanhood: orphanPorts(tx).ports }
                );
                expect((await readSubscription(tx, subscriptionId)).status).toBe('CANCELLED');
                expect(
                    (await readDecisions(tx, subscriptionId)).some((e) => e.reason === 'S20')
                ).toBe(true);
                const [stored] = await tx
                    .select({
                        status: addonInstances.status,
                        titleAnchorId: addonInstances.titleAnchorId
                    })
                    .from(addonInstances)
                    .where(eq(addonInstances.id, instanceId));
                expect(stored).toEqual({ status: 'PENDING_AUTHORIZATION', titleAnchorId: null });
            }));
        it('d — TEST:B9a:4 S32 pause closes at now; PAUSED without an open pause does not throw', async () =>
            withServiceTestTransaction(async (tx) => {
                const { userId } = await seedOrphanOwner(tx);
                const { grantId, anchorIds } = await seedPermanentGrant(tx, {
                    beneficiaryUserId: userId,
                    grantedBy: userId,
                    anchors: [{ vertical: ORPHAN_VERTICAL }],
                    includesAddons: true
                });
                const { subscriptionId: targetId } = await seedPrincipal(tx, {
                    userId,
                    vertical: ORPHAN_VERTICAL,
                    status: 'ACTIVE'
                });
                const ports = { orphanhood: orphanPorts(tx).ports };
                const input = {
                    tx,
                    includesAddons: true,
                    permanentGrantId: grantId,
                    beneficiaryUserId: userId,
                    anchors: [{ id: anchorIds[0]!, vertical: ORPHAN_VERTICAL }],
                    now: orphanNow,
                    actorId: userId
                };
                const { subscriptionId } = await seedComplement(tx, {
                    userId,
                    vertical: ORPHAN_VERTICAL,
                    status: 'PAUSED',
                    openPause: true
                });
                await seedOrphanInstance(tx, {
                    ownerId: userId,
                    scopeType: 'VERTICAL_SUBSCRIPTION',
                    compatibleVerticals: [ORPHAN_VERTICAL],
                    status: 'ACTIVE',
                    targetId,
                    complementSubscriptionId: subscriptionId
                });
                await runS20InTransaction(input, ports);
                expect((await readPauses(tx, subscriptionId))[0]?.actualEndAt).toEqual(orphanNow);
                const noPause = await seedComplement(tx, {
                    userId,
                    vertical: ORPHAN_VERTICAL,
                    status: 'PAUSED'
                });
                await seedOrphanInstance(tx, {
                    ownerId: userId,
                    scopeType: 'VERTICAL_SUBSCRIPTION',
                    compatibleVerticals: [ORPHAN_VERTICAL],
                    status: 'ACTIVE',
                    targetId,
                    complementSubscriptionId: noPause.subscriptionId
                });
                expect((await runS20InTransaction(input, ports)).rows).toHaveLength(1);
                expect((await readSubscription(tx, noPause.subscriptionId)).status).toBe(
                    'CANCELLED'
                );
            }));
        it('f — TEST:B9a:4 second local pass is idempotent and adds no S20 decision', async () =>
            withServiceTestTransaction(async (tx) => {
                const { userId } = await seedOrphanOwner(tx);
                const { grantId, anchorIds } = await seedPermanentGrant(tx, {
                    beneficiaryUserId: userId,
                    grantedBy: userId,
                    anchors: [{ vertical: ORPHAN_VERTICAL }],
                    includesAddons: true
                });
                const { subscriptionId: targetId } = await seedPrincipal(tx, {
                    userId,
                    vertical: ORPHAN_VERTICAL,
                    status: 'ACTIVE'
                });
                const { subscriptionId } = await seedComplement(tx, {
                    userId,
                    vertical: ORPHAN_VERTICAL,
                    status: 'ACTIVE'
                });
                const { instanceId } = await seedOrphanInstance(tx, {
                    ownerId: userId,
                    scopeType: 'VERTICAL_SUBSCRIPTION',
                    compatibleVerticals: [ORPHAN_VERTICAL],
                    status: 'ACTIVE',
                    targetId,
                    complementSubscriptionId: subscriptionId
                });
                const ports = { orphanhood: orphanPorts(tx).ports };
                const input = {
                    tx,
                    includesAddons: true,
                    permanentGrantId: grantId,
                    beneficiaryUserId: userId,
                    anchors: [{ id: anchorIds[0]!, vertical: ORPHAN_VERTICAL }],
                    now: orphanNow,
                    actorId: userId
                };
                expect((await runS20InTransaction(input, ports)).rows).toHaveLength(1);
                const beforeInstance = await tx
                    .select({ updatedAt: addonInstances.updatedAt })
                    .from(addonInstances)
                    .where(eq(addonInstances.id, instanceId));
                const beforeSubscription = await readSubscription(tx, subscriptionId);
                const beforeDecisions = await readDecisions(tx, subscriptionId);
                expect((await runS20InTransaction(input, ports)).rows).toEqual([]);
                expect(
                    await tx
                        .select({ updatedAt: addonInstances.updatedAt })
                        .from(addonInstances)
                        .where(eq(addonInstances.id, instanceId))
                ).toEqual(beforeInstance);
                expect((await readSubscription(tx, subscriptionId)).updatedAt).toEqual(
                    beforeSubscription.updatedAt
                );
                expect(await readDecisions(tx, subscriptionId)).toHaveLength(
                    beforeDecisions.length
                );
            }));
        it('g — TEST:B9a:4 includesAddons false is a no-op in the local S20 half', async () =>
            withServiceTestTransaction(async (tx) => {
                const { userId } = await seedOrphanOwner(tx);
                const { grantId, anchorIds } = await seedPermanentGrant(tx, {
                    beneficiaryUserId: userId,
                    grantedBy: userId,
                    anchors: [{ vertical: ORPHAN_VERTICAL }],
                    includesAddons: false
                });
                const { subscriptionId: targetId } = await seedPrincipal(tx, {
                    userId,
                    vertical: ORPHAN_VERTICAL,
                    status: 'ACTIVE'
                });
                const { subscriptionId } = await seedComplement(tx, {
                    userId,
                    vertical: ORPHAN_VERTICAL,
                    status: 'ACTIVE'
                });
                const { instanceId } = await seedOrphanInstance(tx, {
                    ownerId: userId,
                    scopeType: 'VERTICAL_SUBSCRIPTION',
                    compatibleVerticals: [ORPHAN_VERTICAL],
                    status: 'ACTIVE',
                    targetId,
                    complementSubscriptionId: subscriptionId
                });
                const instanceBefore = await tx
                    .select({
                        updatedAt: addonInstances.updatedAt,
                        titleAnchorId: addonInstances.titleAnchorId
                    })
                    .from(addonInstances)
                    .where(eq(addonInstances.id, instanceId));
                const subscriptionBefore = await readSubscription(tx, subscriptionId);
                expect(
                    (
                        await runS20InTransaction(
                            {
                                tx,
                                includesAddons: false,
                                permanentGrantId: grantId,
                                beneficiaryUserId: userId,
                                anchors: [{ id: anchorIds[0]!, vertical: ORPHAN_VERTICAL }],
                                now: orphanNow,
                                actorId: userId
                            },
                            { orphanhood: orphanPorts(tx).ports }
                        )
                    ).rows
                ).toEqual([]);
                expect(
                    await tx
                        .select({
                            updatedAt: addonInstances.updatedAt,
                            titleAnchorId: addonInstances.titleAnchorId
                        })
                        .from(addonInstances)
                        .where(eq(addonInstances.id, instanceId))
                ).toEqual(instanceBefore);
                expect(await readSubscription(tx, subscriptionId)).toEqual(subscriptionBefore);
            }));
        it('e — TEST:B9a:4 instance update precedes complement update, and a cut rolls back before retry', async () => {
            const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
            const user = await seedCoverageUser(getServiceTestDb());
            userIds.push(user.userId);
            const vertical = VerticalEnum.ACCOMMODATION;
            const plan = await seedCoveragePlanVersion(getServiceTestDb(), vertical);
            const target = await seedCoverageSubscription(getServiceTestDb(), {
                userId: user.userId,
                vertical,
                ...plan,
                status: 'ACTIVE'
            });
            principalIds.push(target.subscriptionId);
            const addon = await seedS20Addon({
                fake,
                userId: user.userId,
                vertical,
                targetId: target.subscriptionId,
                compatibleVerticals: [vertical]
            });
            const grant = await getServiceTestDb().transaction(async (raw) =>
                seedPermanentGrant(raw as unknown as DrizzleClient, {
                    beneficiaryUserId: user.userId,
                    grantedBy: user.userId,
                    anchors: [{ vertical }],
                    includesAddons: true
                })
            );
            const updates: unknown[] = [];
            await expect(
                getServiceTestDb().transaction(async (raw) => {
                    const tx = new Proxy(raw as object, {
                        get(targetTx, property, receiver) {
                            if (property === 'update')
                                return (table: unknown) => {
                                    updates.push(table);
                                    if (table === subscriptions)
                                        throw new Error('cut between S20 writes');
                                    return Reflect.get(targetTx, property, receiver).call(
                                        targetTx,
                                        table
                                    );
                                };
                            const value = Reflect.get(targetTx, property, receiver);
                            return typeof value === 'function' ? value.bind(targetTx) : value;
                        }
                    });
                    return runS20InTransaction(
                        {
                            tx: tx as unknown as DrizzleClient,
                            includesAddons: true,
                            permanentGrantId: grant.grantId,
                            beneficiaryUserId: user.userId,
                            anchors: [{ id: grant.anchorIds[0]!, vertical }],
                            now,
                            actorId: user.userId
                        },
                        {
                            orphanhood: {
                                addonPolicy: addonPolicyFromTx(tx as unknown as DrizzleClient),
                                listing: async () => {
                                    throw new Error('no listing');
                                }
                            }
                        }
                    );
                })
            ).rejects.toThrow('cut between S20 writes');
            expect(updates.slice(0, 2)).toEqual([addonInstances, subscriptions]);
            expect(
                (
                    await getServiceTestDb()
                        .select({ titleAnchorId: addonInstances.titleAnchorId })
                        .from(addonInstances)
                        .where(eq(addonInstances.id, addon.instanceId))
                )[0]?.titleAnchorId
            ).toBeNull();
            expect(
                (
                    await getServiceTestDb()
                        .select({ status: subscriptions.status })
                        .from(subscriptions)
                        .where(eq(subscriptions.id, addon.complementId))
                )[0]?.status
            ).toBe('ACTIVE');
            await getServiceTestDb().transaction(async (raw) =>
                runS20InTransaction(
                    {
                        tx: raw as unknown as DrizzleClient,
                        includesAddons: true,
                        permanentGrantId: grant.grantId,
                        beneficiaryUserId: user.userId,
                        anchors: [{ id: grant.anchorIds[0]!, vertical }],
                        now,
                        actorId: user.userId
                    },
                    {
                        orphanhood: {
                            addonPolicy: addonPolicyFromTx(raw as unknown as DrizzleClient),
                            listing: async () => {
                                throw new Error('no listing');
                            }
                        }
                    }
                )
            );
            expect(
                (
                    await getServiceTestDb()
                        .select({ titleAnchorId: addonInstances.titleAnchorId })
                        .from(addonInstances)
                        .where(eq(addonInstances.id, addon.instanceId))
                )[0]?.titleAnchorId
            ).toBe(grant.anchorIds[0]);
            expect(
                (
                    await getServiceTestDb()
                        .select({ status: subscriptions.status })
                        .from(subscriptions)
                        .where(eq(subscriptions.id, addon.complementId))
                )[0]?.status
            ).toBe('CANCELLED');
        });
        it('j — TEST:B9a:4 anchoring W converts the USER addon compatible only with W and leaves V alone', async () => {
            const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
            const user = await seedCoverageUser(getServiceTestDb());
            const admin = await seedCoverageUser(getServiceTestDb());
            userIds.push(user.userId, admin.userId);
            const v = VerticalEnum.ACCOMMODATION;
            const w = VerticalEnum.VENUE;
            const addon = await seedS20Addon({
                fake,
                userId: user.userId,
                vertical: w,
                targetId: null,
                scopeType: 'USER',
                compatibleVerticals: [w]
            });
            const planV = await seedGrantPlan(getServiceTestDb(), v);
            const planW = await seedGrantPlan(getServiceTestDb(), w);
            const ports = {
                planPolicy: currentFloorPolicy,
                clock,
                provider: namespaceFake(fake),
                beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }),
                coverageNotices: { emitCoverageChanged: async () => undefined },
                orphanhood: {
                    addonPolicy: addonPolicyFromTx(getServiceTestDb()),
                    listing: async () => {
                        throw new Error('no listing');
                    }
                }
            };
            const initial = await grantPermanentGrant(
                {
                    beneficiaryUserId: user.userId,
                    actor: grantSignerActor(admin.userId),
                    reason: 'S20 anchor sequence',
                    includesAddons: true,
                    anchors: [{ vertical: v, ...planV }]
                },
                ports
            );
            expect(initial.anchoredAddonInstanceIds).toEqual([]);
            expect(
                (
                    await getServiceTestDb()
                        .select({ status: subscriptions.status })
                        .from(subscriptions)
                        .where(eq(subscriptions.id, addon.complementId))
                )[0]?.status
            ).toBe('ACTIVE');
            const anchored = await anchorPermanentGrantVertical(
                {
                    permanentGrantId: initial.permanentGrantId,
                    actor: grantSignerActor(admin.userId),
                    vertical: w,
                    ...planW
                },
                ports
            );
            expect(anchored.anchoredAddonInstanceIds).toContain(addon.instanceId);
            expect(
                (
                    await getServiceTestDb()
                        .select({ status: subscriptions.status })
                        .from(subscriptions)
                        .where(eq(subscriptions.id, addon.complementId))
                )[0]?.status
            ).toBe('CANCELLED');
        });
        it.each([
            ['VERTICAL_SUBSCRIPTION', ORPHAN_VERTICAL, true],
            ['VERTICAL_SUBSCRIPTION', 'venue', false],
            ['LISTING', ORPHAN_VERTICAL, true],
            ['LISTING', 'venue', false],
            ['USER', ORPHAN_VERTICAL, true],
            ['GLOBAL', 'venue', false]
        ] as const)('h — TEST:B9a:4 scope %s with compatible/target vertical %s converts=%s', async (scope, targetVertical, converts) =>
            withServiceTestTransaction(async (tx) => {
                const { userId } = await seedOrphanOwner(tx);
                const { grantId, anchorIds } = await seedPermanentGrant(tx, {
                    beneficiaryUserId: userId,
                    grantedBy: userId,
                    anchors: [{ vertical: ORPHAN_VERTICAL }],
                    includesAddons: true
                });
                const listingId = crypto.randomUUID();
                const fixture = orphanPorts(tx);
                fixture.setListing(listingId, {
                    vertical: targetVertical as VerticalEnum,
                    ownerId: userId,
                    acceptsFeature: true
                });
                const targetId =
                    scope === 'VERTICAL_SUBSCRIPTION'
                        ? (
                              await seedPrincipal(tx, {
                                  userId,
                                  vertical: targetVertical,
                                  status: 'ACTIVE'
                              })
                          ).subscriptionId
                        : scope === 'LISTING'
                          ? listingId
                          : null;
                const { subscriptionId } = await seedComplement(tx, {
                    userId,
                    vertical: ORPHAN_VERTICAL,
                    status: 'ACTIVE'
                });
                await seedOrphanInstance(tx, {
                    ownerId: userId,
                    scopeType: scope,
                    compatibleVerticals:
                        scope === 'VERTICAL_SUBSCRIPTION' || scope === 'LISTING'
                            ? [ORPHAN_VERTICAL]
                            : [targetVertical],
                    status: 'ACTIVE',
                    targetId,
                    complementSubscriptionId: subscriptionId
                });
                const result = await runS20InTransaction(
                    {
                        tx,
                        includesAddons: true,
                        permanentGrantId: grantId,
                        beneficiaryUserId: userId,
                        anchors: [{ id: anchorIds[0]!, vertical: ORPHAN_VERTICAL }],
                        now: orphanNow,
                        actorId: userId
                    },
                    { orphanhood: fixture.ports }
                );
                expect(result.rows).toHaveLength(converts ? 1 : 0);
                expect((await readSubscription(tx, subscriptionId)).status).toBe(
                    converts ? 'CANCELLED' : 'ACTIVE'
                );
            }));
        it.each([
            [ORPHAN_VERTICAL, 'venue'],
            ['venue', ORPHAN_VERTICAL]
        ] as const)('i — TEST:B9a:4 USER addon chooses the first compatible anchor from %s,%s', async (first, second) =>
            withServiceTestTransaction(async (tx) => {
                const { userId } = await seedOrphanOwner(tx);
                const { grantId, anchorIds } = await seedPermanentGrant(tx, {
                    beneficiaryUserId: userId,
                    grantedBy: userId,
                    anchors: [{ vertical: first }, { vertical: second }],
                    includesAddons: true
                });
                const { subscriptionId } = await seedComplement(tx, {
                    userId,
                    vertical: ORPHAN_VERTICAL,
                    status: 'ACTIVE'
                });
                const { instanceId } = await seedOrphanInstance(tx, {
                    ownerId: userId,
                    scopeType: 'USER',
                    compatibleVerticals: [ORPHAN_VERTICAL, 'venue'],
                    status: 'ACTIVE',
                    complementSubscriptionId: subscriptionId
                });
                await runS20InTransaction(
                    {
                        tx,
                        includesAddons: true,
                        permanentGrantId: grantId,
                        beneficiaryUserId: userId,
                        anchors: [
                            { id: anchorIds[0]!, vertical: first },
                            { id: anchorIds[1]!, vertical: second }
                        ],
                        now: orphanNow,
                        actorId: userId
                    },
                    { orphanhood: orphanPorts(tx).ports }
                );
                const [row] = await tx
                    .select({ titleAnchorId: addonInstances.titleAnchorId })
                    .from(addonInstances)
                    .where(eq(addonInstances.id, instanceId));
                expect(row?.titleAnchorId).toBe(anchorIds[0]);
            }));
        it('l — TEST:B9a:4 UNA_VEZ instance without a complement remains ACTIVE and unanchored', async () =>
            withServiceTestTransaction(async (tx) => {
                const { userId } = await seedOrphanOwner(tx);
                const { grantId, anchorIds } = await seedPermanentGrant(tx, {
                    beneficiaryUserId: userId,
                    grantedBy: userId,
                    anchors: [{ vertical: ORPHAN_VERTICAL }],
                    includesAddons: true
                });
                const { instanceId } = await seedOrphanInstance(tx, {
                    ownerId: userId,
                    scopeType: 'USER',
                    compatibleVerticals: [ORPHAN_VERTICAL],
                    status: 'ACTIVE',
                    chargeKind: 'UNA_VEZ'
                });
                expect(
                    (
                        await runS20InTransaction(
                            {
                                tx,
                                includesAddons: true,
                                permanentGrantId: grantId,
                                beneficiaryUserId: userId,
                                anchors: [{ id: anchorIds[0]!, vertical: ORPHAN_VERTICAL }],
                                now: orphanNow,
                                actorId: userId
                            },
                            { orphanhood: orphanPorts(tx).ports }
                        )
                    ).rows
                ).toEqual([]);
                const [instance] = await tx
                    .select({
                        status: addonInstances.status,
                        titleAnchorId: addonInstances.titleAnchorId
                    })
                    .from(addonInstances)
                    .where(eq(addonInstances.id, instanceId));
                expect(instance).toEqual({ status: 'ACTIVE', titleAnchorId: null });
            }));
        it('k — TEST:B9a:4 same-vertical complement owned by another user is outside the grant', async () =>
            withServiceTestTransaction(async (tx) => {
                const owner = await seedOrphanOwner(tx);
                const other = await seedOrphanOwner(tx);
                const { grantId, anchorIds } = await seedPermanentGrant(tx, {
                    beneficiaryUserId: owner.userId,
                    grantedBy: owner.userId,
                    anchors: [{ vertical: ORPHAN_VERTICAL }],
                    includesAddons: true
                });
                const { subscriptionId: targetId } = await seedPrincipal(tx, {
                    userId: other.userId,
                    vertical: ORPHAN_VERTICAL,
                    status: 'ACTIVE'
                });
                const { subscriptionId } = await seedComplement(tx, {
                    userId: other.userId,
                    vertical: ORPHAN_VERTICAL,
                    status: 'ACTIVE'
                });
                const { instanceId } = await seedOrphanInstance(tx, {
                    ownerId: other.userId,
                    scopeType: 'VERTICAL_SUBSCRIPTION',
                    compatibleVerticals: [ORPHAN_VERTICAL],
                    status: 'ACTIVE',
                    targetId,
                    complementSubscriptionId: subscriptionId
                });
                expect(
                    (
                        await runS20InTransaction(
                            {
                                tx,
                                includesAddons: true,
                                permanentGrantId: grantId,
                                beneficiaryUserId: owner.userId,
                                anchors: [{ id: anchorIds[0]!, vertical: ORPHAN_VERTICAL }],
                                now: orphanNow,
                                actorId: owner.userId
                            },
                            { orphanhood: orphanPorts(tx).ports }
                        )
                    ).rows
                ).toEqual([]);
                expect((await readSubscription(tx, subscriptionId)).status).toBe('ACTIVE');
                const [instance] = await tx
                    .select({ titleAnchorId: addonInstances.titleAnchorId })
                    .from(addonInstances)
                    .where(eq(addonInstances.id, instanceId));
                expect(instance?.titleAnchorId).toBeNull();
            }));
        it('a — grant with includesAddons converts the paid addon: instance first, then the charge', async () => {
            const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
            const user = await seedCoverageUser(getServiceTestDb());
            const admin = await seedCoverageUser(getServiceTestDb());
            userIds.push(user.userId, admin.userId);
            const vertical = VerticalEnum.ACCOMMODATION;
            const plan = await seedCoveragePlanVersion(getServiceTestDb(), vertical);
            const principal = await seedCoverageSubscription(getServiceTestDb(), {
                userId: user.userId,
                vertical,
                ...plan,
                status: 'ACTIVE'
            });
            principalIds.push(principal.subscriptionId);
            const addon = await seedS20Addon({
                fake,
                userId: user.userId,
                vertical,
                targetId: principal.subscriptionId,
                scopeType: 'VERTICAL_SUBSCRIPTION',
                compatibleVerticals: [vertical],
                instanceStatus: 'ACTIVE',
                complementStatus: 'ACTIVE'
            });
            const [originalInstance] = await getServiceTestDb()
                .select({ addonVersionId: addonInstances.addonVersionId })
                .from(addonInstances)
                .where(eq(addonInstances.id, addon.instanceId));
            const cancel = vi.spyOn(fake, 'cancel');
            const refund = vi.spyOn(fake, 'refund');
            const provider = new Proxy(namespaceFake(fake), {
                get(target, property, receiver) {
                    if (property === 'cancel')
                        return async (args: { readonly authorizationId: string }) => {
                            const [instance] = await getServiceTestDb()
                                .select({ titleAnchorId: addonInstances.titleAnchorId })
                                .from(addonInstances)
                                .where(eq(addonInstances.id, addon.instanceId));
                            const [complement] = await getServiceTestDb()
                                .select({ status: subscriptions.status })
                                .from(subscriptions)
                                .where(eq(subscriptions.id, addon.complementId));
                            const notices = await getServiceTestDb()
                                .select({ template: emailOutbox.template })
                                .from(emailOutbox)
                                .where(eq(emailOutbox.recipientUserId, user.userId));
                            const [grant] = await getServiceTestDb()
                                .select({ id: permanentGrants.id })
                                .from(permanentGrants)
                                .where(eq(permanentGrants.beneficiaryUserId, user.userId));
                            const [anchor] = grant
                                ? await getServiceTestDb()
                                      .select({ id: permanentGrantVerticals.id })
                                      .from(permanentGrantVerticals)
                                      .where(eq(permanentGrantVerticals.permanentGrantId, grant.id))
                                : [];
                            expect(instance?.titleAnchorId).toBe(anchor?.id);
                            expect(complement?.status).toBe('CANCELLED');
                            expect(notices.map(({ template }) => template)).toContain(
                                'billing.permanent-grant-addon-cancel'
                            );
                            return Reflect.get(target, property, receiver)(args);
                        };
                    const value = Reflect.get(target, property, receiver);
                    return typeof value === 'function' ? value.bind(target) : value;
                }
            }) as PaymentProvider;
            const ports = {
                planPolicy: currentFloorPolicy,
                clock,
                provider,
                beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }),
                coverageNotices: { emitCoverageChanged: async () => undefined },
                orphanhood: {
                    addonPolicy: addonPolicyFromTx(getServiceTestDb()),
                    listing: async () => {
                        throw new Error('S20 fixture has no listing target');
                    }
                }
            };
            const grantPlan = await seedGrantPlan(getServiceTestDb(), vertical);
            const result = await grantPermanentGrant(
                {
                    beneficiaryUserId: user.userId,
                    actor: grantSignerActor(admin.userId),
                    reason: 'S20 cable test',
                    includesAddons: true,
                    anchors: [{ vertical, ...grantPlan }]
                },
                ports
            );
            const [instance] = await getServiceTestDb()
                .select({
                    status: addonInstances.status,
                    titleAnchorId: addonInstances.titleAnchorId,
                    addonVersionId: addonInstances.addonVersionId,
                    productId: addonInstances.productId
                })
                .from(addonInstances)
                .where(eq(addonInstances.id, addon.instanceId));
            const [complement] = await getServiceTestDb()
                .select({ status: subscriptions.status })
                .from(subscriptions)
                .where(eq(subscriptions.id, addon.complementId));
            const events = await domainEventModel.findByEntity({
                entityType: 'subscription',
                entityId: addon.complementId
            });
            expect(result.anchoredAddonInstanceIds).toContain(addon.instanceId);
            expect(result.addonProviderCalls).toContainEqual({
                subscriptionId: addon.complementId,
                cancelCall: 'SENT'
            });
            expect(cancel).toHaveBeenCalledTimes(1);
            expect(instance?.status).toBe('ACTIVE');
            expect(instance?.addonVersionId).toBe(originalInstance?.addonVersionId);
            expect(instance?.productId).toBe(addon.productId);
            expect(instance?.titleAnchorId).toBe(result.anchorIds[0]);
            expect(complement?.status).toBe('CANCELLED');
            expect(
                events.some(
                    (event) =>
                        event.eventType === 'subscription.provider_cancellation_decided' &&
                        event.reason === 'S20'
                )
            ).toBe(true);
            expect(refund).not.toHaveBeenCalled();
        });
    }
);

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B9a:5 — grant does not create or convert incompatible addons',
    () => {
        it('m — TEST:B9a:5 grant without purchased addons creates no addon instances or complement subscriptions', async () => {
            const user = await seedCoverageUser(getServiceTestDb());
            const admin = await seedCoverageUser(getServiceTestDb());
            userIds.push(user.userId, admin.userId);
            const vertical = VerticalEnum.ACCOMMODATION;
            const plan = await seedGrantPlan(getServiceTestDb(), vertical);
            await grantPermanentGrant(
                {
                    beneficiaryUserId: user.userId,
                    actor: grantSignerActor(admin.userId),
                    reason: 'empty S20',
                    includesAddons: true,
                    anchors: [{ vertical, ...plan }]
                },
                {
                    planPolicy: currentFloorPolicy,
                    clock,
                    provider: namespaceFake(
                        new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock })
                    ),
                    beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }),
                    coverageNotices: { emitCoverageChanged: async () => undefined },
                    orphanhood: {
                        addonPolicy: addonPolicyFromTx(getServiceTestDb()),
                        listing: async () => {
                            throw new Error('no listing');
                        }
                    }
                }
            );
            expect(
                await getServiceTestDb()
                    .select({ id: addonInstances.id })
                    .from(addonInstances)
                    .where(eq(addonInstances.ownerId, user.userId))
            ).toHaveLength(0);
            expect(
                await getServiceTestDb()
                    .select({ id: subscriptions.id })
                    .from(subscriptions)
                    .where(
                        and(
                            eq(subscriptions.userId, user.userId),
                            eq(subscriptions.class, 'COMPLEMENTO')
                        )
                    )
            ).toHaveLength(0);
        });

        it('n — TEST:B9a:5 incompatible vertical-target and USER addons retain authorized preapprovals', async () => {
            const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
            const user = await seedCoverageUser(getServiceTestDb());
            const admin = await seedCoverageUser(getServiceTestDb());
            userIds.push(user.userId, admin.userId);
            const vertical = VerticalEnum.ACCOMMODATION;
            const other = VerticalEnum.VENUE;
            const targetPlan = await seedCoveragePlanVersion(getServiceTestDb(), other);
            const target = await seedCoverageSubscription(getServiceTestDb(), {
                userId: user.userId,
                vertical: other,
                ...targetPlan,
                status: 'ACTIVE'
            });
            principalIds.push(target.subscriptionId);
            const verticalAddon = await seedS20Addon({
                fake,
                userId: user.userId,
                vertical: other,
                targetId: target.subscriptionId,
                scopeType: 'VERTICAL_SUBSCRIPTION',
                compatibleVerticals: [other]
            });
            const userAddon = await seedS20Addon({
                fake,
                userId: user.userId,
                vertical: other,
                targetId: null,
                scopeType: 'USER',
                compatibleVerticals: [other]
            });
            const cancel = vi.spyOn(fake, 'cancel');
            const grantPlan = await seedGrantPlan(getServiceTestDb(), vertical);
            await grantPermanentGrant(
                {
                    beneficiaryUserId: user.userId,
                    actor: grantSignerActor(admin.userId),
                    reason: 'incompatible S20',
                    includesAddons: true,
                    anchors: [{ vertical, ...grantPlan }]
                },
                {
                    planPolicy: currentFloorPolicy,
                    clock,
                    provider: namespaceFake(fake),
                    beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }),
                    coverageNotices: { emitCoverageChanged: async () => undefined },
                    orphanhood: {
                        addonPolicy: addonPolicyFromTx(getServiceTestDb()),
                        listing: async () => {
                            throw new Error('no listing');
                        }
                    }
                }
            );
            for (const addon of [verticalAddon, userAddon]) {
                expect(
                    (await fake.readAuthorization({ authorizationId: addon.authorizationId }))
                        .snapshot.status
                ).toBe('active');
                expect(
                    cancel.mock.calls.some(
                        ([call]) => call.authorizationId === addon.authorizationId
                    )
                ).toBe(false);
                expect(
                    (
                        await getServiceTestDb()
                            .select({ titleAnchorId: addonInstances.titleAnchorId })
                            .from(addonInstances)
                            .where(eq(addonInstances.id, addon.instanceId))
                    )[0]?.titleAnchorId
                ).toBeNull();
                expect(
                    (
                        await domainEventModel.findByEntity({
                            entityType: 'subscription',
                            entityId: addon.complementId
                        })
                    ).some(
                        (event) =>
                            event.eventType === 'subscription.provider_cancellation_decided' &&
                            event.reason === 'S20'
                    )
                ).toBe(false);
            }
        });

        it('o — TEST:B9a:5 a compatible and incompatible addon for one beneficiary converts only the compatible one', async () => {
            const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
            const user = await seedCoverageUser(getServiceTestDb());
            const admin = await seedCoverageUser(getServiceTestDb());
            userIds.push(user.userId, admin.userId);
            const vertical = VerticalEnum.ACCOMMODATION;
            const other = VerticalEnum.VENUE;
            const targetPlan = await seedCoveragePlanVersion(getServiceTestDb(), vertical);
            const target = await seedCoverageSubscription(getServiceTestDb(), {
                userId: user.userId,
                vertical,
                ...targetPlan,
                status: 'ACTIVE'
            });
            principalIds.push(target.subscriptionId);
            const compatible = await seedS20Addon({
                fake,
                userId: user.userId,
                vertical,
                targetId: target.subscriptionId,
                scopeType: 'VERTICAL_SUBSCRIPTION',
                compatibleVerticals: [vertical]
            });
            const incompatible = await seedS20Addon({
                fake,
                userId: user.userId,
                vertical: other,
                targetId: null,
                scopeType: 'USER',
                compatibleVerticals: [other]
            });
            const cancel = vi.spyOn(fake, 'cancel');
            const plan = await seedGrantPlan(getServiceTestDb(), vertical);
            await grantPermanentGrant(
                {
                    beneficiaryUserId: user.userId,
                    actor: grantSignerActor(admin.userId),
                    reason: 'mixed S20',
                    includesAddons: true,
                    anchors: [{ vertical, ...plan }]
                },
                {
                    planPolicy: currentFloorPolicy,
                    clock,
                    provider: namespaceFake(fake),
                    beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }),
                    coverageNotices: { emitCoverageChanged: async () => undefined },
                    orphanhood: {
                        addonPolicy: addonPolicyFromTx(getServiceTestDb()),
                        listing: async () => {
                            throw new Error('no listing');
                        }
                    }
                }
            );
            const [yes] = await getServiceTestDb()
                .select({ status: subscriptions.status })
                .from(subscriptions)
                .where(eq(subscriptions.id, compatible.complementId));
            const [no] = await getServiceTestDb()
                .select({ status: subscriptions.status })
                .from(subscriptions)
                .where(eq(subscriptions.id, incompatible.complementId));
            expect(yes?.status).toBe('CANCELLED');
            expect(no?.status).toBe('ACTIVE');
            expect(
                cancel.mock.calls.some(
                    ([call]) => call.authorizationId === compatible.authorizationId
                )
            ).toBe(true);
            expect(
                cancel.mock.calls.some(
                    ([call]) => call.authorizationId === incompatible.authorizationId
                )
            ).toBe(false);
        });
    }
);
