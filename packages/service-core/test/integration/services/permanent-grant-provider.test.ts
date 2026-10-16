import {
    domainEventModel,
    emailOutbox,
    eq,
    inArray,
    permanentGrants,
    providerLinks,
    subscriptions
} from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import { VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import {
    anchorPermanentGrantVertical,
    grantPermanentGrant,
    resumePermanentGrant
} from '../../../src/services/billing/grant/permanent-grant.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
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
    seedGrantPlan
} from './support/permanent-grant-fixtures.js';

const now = new Date('2026-10-14T12:00:00.000Z');
const clock = { now: () => now };
const users: string[] = [];
const subscriptionIds: string[] = [];
const V = [VerticalEnum.ACCOMMODATION, VerticalEnum.GASTRONOMY, VerticalEnum.EXPERIENCE] as const;
afterAll(closeServiceTestPool);
afterEach(async () => {
    if (users.length)
        await getServiceTestDb()
            .delete(emailOutbox)
            .where(inArray(emailOutbox.recipientUserId, users));
    const ids = subscriptionIds.splice(0);
    if (ids.length) {
        await getServiceTestDb()
            .delete(providerLinks)
            .where(inArray(providerLinks.subscriptionId, ids));
        await getServiceTestDb().delete(subscriptions).where(inArray(subscriptions.id, ids));
    }
    await retirePermanentGrantRows(users.splice(0));
});

async function seedProviderRow(input: {
    fake: FakePaymentProvider;
    userId: string;
    vertical: string;
    status: string;
    approved: boolean;
    cancelled?: boolean;
}) {
    const { authorizationId } = await input.fake.authorize({
        reference: crypto.randomUUID(),
        amount: { amountMinor: 250000, currency: 'ARS' },
        cadence: { everyMonths: 1 },
        reason: 'permanent grant S13 fixture',
        returnUrl: 'https://example.test/return',
        payerEmail: `payer-${crypto.randomUUID()}@example.test`
    });
    if (input.approved) await input.fake.approve({ authorizationId });
    if (input.cancelled) await input.fake.cancel({ authorizationId });
    const plan = await seedCoveragePlanVersion(getServiceTestDb(), input.vertical);
    const { subscriptionId } = await seedCoverageSubscription(getServiceTestDb(), {
        userId: input.userId,
        vertical: input.vertical,
        ...plan,
        status: input.status
    });
    subscriptionIds.push(subscriptionId);
    await getServiceTestDb().insert(providerLinks).values({
        subscriptionId,
        provider: 'MERCADO_PAGO',
        providerId: authorizationId
    });
    return { subscriptionId, authorizationId };
}

function ports(
    fake: FakePaymentProvider,
    provider: PaymentProvider = namespaceFake(fake),
    beforeCancelNotice = outboxBeforeCancelNotice({ deliver: true })
) {
    return {
        planPolicy: currentFloorPolicy,
        clock,
        provider,
        beforeCancelNotice,
        coverageNotices: { emitCoverageChanged: async () => undefined },
        orphanhood: {
            addonPolicy: addonPolicyFromTx(getServiceTestDb()),
            listing: async () => {
                throw new Error('no listing addon seeded');
            }
        }
    };
}

async function decisionsOf(subscriptionId: string) {
    return (
        await domainEventModel.findByEntity({
            entityType: 'subscription',
            entityId: subscriptionId
        })
    ).filter(({ eventType }) => eventType === 'subscription.provider_cancellation_decided');
}

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B9a:1 — S13 provider half: our notice first, one cancellation per live preapproval, resumable (AC:B9a:1)',
    () => {
        it('a — sends one cancellation per live preapproval after commit, and none for an already cancelled authorization', async () => {
            const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
            const { userId } = await seedCoverageUser(getServiceTestDb());
            const { userId: adminId } = await seedCoverageUser(getServiceTestDb());
            users.push(userId, adminId);
            const rows = [
                await seedProviderRow({
                    fake,
                    userId,
                    vertical: V[0],
                    status: 'ACTIVE',
                    approved: true
                }),
                await seedProviderRow({
                    fake,
                    userId,
                    vertical: V[1],
                    status: 'PENDING_AUTHORIZATION',
                    approved: false
                }),
                await seedProviderRow({
                    fake,
                    userId,
                    vertical: V[2],
                    status: 'CANCEL_SCHEDULED',
                    approved: true,
                    cancelled: true
                })
            ];
            const cancelSpy = vi.spyOn(fake, 'cancel');
            const provider = new Proxy(namespaceFake(fake), {
                get(target, property, receiver) {
                    if (property === 'cancel')
                        return async (args: { authorizationId: string }) => {
                            const rawAuthorizationId = args.authorizationId.split(':').at(-1);
                            const targetRow = rows.find(
                                (row) => row.authorizationId === rawAuthorizationId
                            );
                            const [local] = await getServiceTestDb()
                                .select({ status: subscriptions.status })
                                .from(subscriptions)
                                .where(eq(subscriptions.id, targetRow?.subscriptionId ?? ''));
                            expect(local?.status).toBe('CANCELLED');
                            const notices = await getServiceTestDb()
                                .select({ template: emailOutbox.template })
                                .from(emailOutbox)
                                .where(eq(emailOutbox.recipientUserId, userId));
                            expect(notices.map(({ template }) => template)).toContain(
                                'billing.permanent-grant-cancel'
                            );
                            return Reflect.get(target, property, receiver)(args);
                        };
                    const value = Reflect.get(target, property, receiver);
                    return typeof value === 'function' ? value.bind(target) : value;
                }
            });
            const anchors = await Promise.all(
                V.map((vertical) => seedGrantPlan(getServiceTestDb(), vertical))
            );
            const result = await grantPermanentGrant(
                {
                    beneficiaryUserId: userId,
                    actor: grantSignerActor(adminId),
                    reason: 'provider half test',
                    includesAddons: false,
                    anchors: V.map((vertical, index) => ({ vertical, ...anchors[index]! }))
                },
                ports(fake, provider)
            );
            expect(result.providerCalls.map(({ cancelCall }) => cancelCall).sort()).toEqual([
                'NOT_NEEDED',
                'SENT',
                'SENT'
            ]);
            expect(cancelSpy).toHaveBeenCalledTimes(2);
            for (const row of rows) expect(await decisionsOf(row.subscriptionId)).toHaveLength(1);
        });

        it('c — resumes after a provider call fails without repeating the completed cancellation', async () => {
            const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
            const { userId } = await seedCoverageUser(getServiceTestDb());
            const { userId: adminId } = await seedCoverageUser(getServiceTestDb());
            users.push(userId, adminId);
            const rows = [
                await seedProviderRow({
                    fake,
                    userId,
                    vertical: V[0],
                    status: 'ACTIVE',
                    approved: true
                }),
                await seedProviderRow({
                    fake,
                    userId,
                    vertical: V[1],
                    status: 'ACTIVE',
                    approved: true
                })
            ];
            const originalCancel = fake.cancel.bind(fake);
            let count = 0;
            vi.spyOn(fake, 'cancel').mockImplementation(async (input) => {
                count++;
                if (count === 2) throw new Error('one provider failure');
                return originalCancel(input);
            });
            const anchors = await Promise.all(
                [V[0], V[1]].map((vertical) => seedGrantPlan(getServiceTestDb(), vertical))
            );
            const grant = await grantPermanentGrant(
                {
                    beneficiaryUserId: userId,
                    actor: grantSignerActor(adminId),
                    reason: 'resume provider test',
                    includesAddons: false,
                    anchors: [
                        { vertical: V[0], ...anchors[0]! },
                        { vertical: V[1], ...anchors[1]! }
                    ]
                },
                ports(fake)
            );
            expect(grant.providerCalls.map(({ cancelCall }) => cancelCall).sort()).toEqual([
                'FAILED',
                'SENT'
            ]);
            vi.restoreAllMocks();
            const resumed = await resumePermanentGrant(
                { permanentGrantId: grant.permanentGrantId, actor: grantSignerActor(adminId) },
                ports(fake)
            );
            expect(resumed.providerCalls.map(({ cancelCall }) => cancelCall).sort()).toEqual([
                'NOT_NEEDED',
                'SENT'
            ]);
            expect(await decisionsOf(rows[0]!.subscriptionId)).toHaveLength(1);
            expect(await decisionsOf(rows[1]!.subscriptionId)).toHaveLength(1);
        });

        it('b — a pending notice defers one row and resume cancels it after delivery', async () => {
            const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
            const { userId } = await seedCoverageUser(getServiceTestDb());
            const { userId: adminId } = await seedCoverageUser(getServiceTestDb());
            users.push(userId, adminId);
            const row = await seedProviderRow({
                fake,
                userId,
                vertical: V[0],
                status: 'ACTIVE',
                approved: true
            });
            const plan = await seedGrantPlan(getServiceTestDb(), V[0]);
            const result = await grantPermanentGrant(
                {
                    beneficiaryUserId: userId,
                    actor: grantSignerActor(adminId),
                    reason: 'notice pending',
                    includesAddons: false,
                    anchors: [{ vertical: V[0], ...plan }]
                },
                ports(fake, namespaceFake(fake), outboxBeforeCancelNotice())
            );
            expect(result.providerCalls).toMatchObject([
                { subscriptionId: row.subscriptionId, cancelCall: 'NOTICE_PENDING' }
            ]);
            const resumed = await resumePermanentGrant(
                { permanentGrantId: result.permanentGrantId, actor: grantSignerActor(adminId) },
                ports(fake)
            );
            expect(resumed.providerCalls).toMatchObject([
                { subscriptionId: row.subscriptionId, cancelCall: 'SENT' }
            ]);
        });

        it('d — an unavailable recipient still allows cancellation and reports escalation', async () => {
            const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
            const { userId } = await seedCoverageUser(getServiceTestDb());
            const { userId: adminId } = await seedCoverageUser(getServiceTestDb());
            users.push(userId, adminId);
            const row = await seedProviderRow({
                fake,
                userId,
                vertical: V[0],
                status: 'ACTIVE',
                approved: true
            });
            const plan = await seedGrantPlan(getServiceTestDb(), V[0]);
            const noRecipient = { beforeCancel: async () => 'NO_RECIPIENT' as const };
            const result = await grantPermanentGrant(
                {
                    beneficiaryUserId: userId,
                    actor: grantSignerActor(adminId),
                    reason: 'no recipient',
                    includesAddons: false,
                    anchors: [{ vertical: V[0], ...plan }]
                },
                ports(fake, namespaceFake(fake), noRecipient)
            );
            expect(result.providerCalls).toMatchObject([
                {
                    subscriptionId: row.subscriptionId,
                    cancelCall: 'SENT',
                    escalated: 'NO_RECIPIENT'
                }
            ]);
        });

        it('e — a row without provider_link is cancelled locally without a decision or provider call', async () => {
            const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
            const { userId } = await seedCoverageUser(getServiceTestDb());
            const { userId: adminId } = await seedCoverageUser(getServiceTestDb());
            users.push(userId, adminId);
            const version = await seedCoveragePlanVersion(getServiceTestDb(), V[0]);
            const row = await seedCoverageSubscription(getServiceTestDb(), {
                userId,
                vertical: V[0],
                ...version,
                status: 'ACTIVE'
            });
            subscriptionIds.push(row.subscriptionId);
            const anchor = await seedGrantPlan(getServiceTestDb(), V[0]);
            const result = await grantPermanentGrant(
                {
                    beneficiaryUserId: userId,
                    actor: grantSignerActor(adminId),
                    reason: 'without provider link',
                    includesAddons: false,
                    anchors: [{ vertical: V[0], ...anchor }]
                },
                ports(fake)
            );
            expect(result.providerCalls).toMatchObject([
                { subscriptionId: row.subscriptionId, cancelCall: 'NOT_APPLICABLE' }
            ]);
            expect(await decisionsOf(row.subscriptionId)).toHaveLength(0);
        });

        it('f — anchoring a new vertical runs S13 only for that vertical', async () => {
            const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
            const { userId } = await seedCoverageUser(getServiceTestDb());
            const { userId: adminId } = await seedCoverageUser(getServiceTestDb());
            users.push(userId, adminId);
            const first = await seedProviderRow({
                fake,
                userId,
                vertical: V[0],
                status: 'ACTIVE',
                approved: true
            });
            const next = await seedProviderRow({
                fake,
                userId,
                vertical: V[1],
                status: 'ACTIVE',
                approved: true
            });
            const firstPlan = await seedGrantPlan(getServiceTestDb(), V[0]);
            const created = await grantPermanentGrant(
                {
                    beneficiaryUserId: userId,
                    actor: grantSignerActor(adminId),
                    reason: 'anchor first',
                    includesAddons: false,
                    anchors: [{ vertical: V[0], ...firstPlan }]
                },
                ports(fake)
            );
            const secondPlan = await seedGrantPlan(getServiceTestDb(), V[1]);
            const anchored = await anchorPermanentGrantVertical(
                {
                    permanentGrantId: created.permanentGrantId,
                    actor: grantSignerActor(adminId),
                    vertical: V[1],
                    ...secondPlan
                },
                ports(fake)
            );
            expect(anchored.providerCalls).toMatchObject([
                { subscriptionId: next.subscriptionId, cancelCall: 'SENT' }
            ]);
            expect(
                anchored.providerCalls.map(({ subscriptionId }) => subscriptionId)
            ).not.toContain(first.subscriptionId);
        });

        it('g — resume rejects a revoked grant without making a provider call', async () => {
            const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
            const { userId } = await seedCoverageUser(getServiceTestDb());
            const { userId: adminId } = await seedCoverageUser(getServiceTestDb());
            users.push(userId, adminId);
            const anchor = await seedGrantPlan(getServiceTestDb(), V[0]);
            const created = await grantPermanentGrant(
                {
                    beneficiaryUserId: userId,
                    actor: grantSignerActor(adminId),
                    reason: 'revoke resume',
                    includesAddons: false,
                    anchors: [{ vertical: V[0], ...anchor }]
                },
                ports(fake)
            );
            await getServiceTestDb()
                .update(permanentGrants)
                .set({ revokedAt: now, revokedBy: adminId, revocationReason: 'test revocation' })
                .where(eq(permanentGrants.id, created.permanentGrantId));
            await expect(
                resumePermanentGrant(
                    {
                        permanentGrantId: created.permanentGrantId,
                        actor: grantSignerActor(adminId)
                    },
                    ports(fake)
                )
            ).rejects.toMatchObject({ reason: 'PERMANENT_GRANT_NOT_LIVE' });
        });
    }
);
