import {
    addonInstances,
    domainEventModel,
    emailOutbox,
    eq,
    inArray,
    payments,
    providerLinks,
    refunds,
    subscriptions
} from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import {
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
import { retireS20Rows, seedS20Addon } from './support/permanent-grant-s20-fixtures.js';

const now = new Date('2026-10-14T12:00:00.000Z');
const clock = { now: () => now };
const users: string[] = [];
const principals: string[] = [];
afterAll(closeServiceTestPool);
afterEach(async () => {
    await retireS20Rows();
    if (principals.length) {
        const ids = principals.splice(0);
        await getServiceTestDb()
            .delete(providerLinks)
            .where(inArray(providerLinks.subscriptionId, ids));
        await getServiceTestDb().delete(subscriptions).where(inArray(subscriptions.id, ids));
    }
    if (users.length)
        await getServiceTestDb()
            .delete(emailOutbox)
            .where(inArray(emailOutbox.recipientUserId, users));
    await retirePermanentGrantRows(users.splice(0));
});

describe.skipIf(!isServiceTestDbAvailable())('TEST:B9a:4 — S20 provider half', () => {
    it('p — TEST:B9a:4 sends the addon notice before cancel, records the addon kind and never refunds', async () => {
        const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
        const user = await seedCoverageUser(getServiceTestDb());
        const admin = await seedCoverageUser(getServiceTestDb());
        users.push(user.userId, admin.userId);
        const vertical = VerticalEnum.ACCOMMODATION;
        const principalPlan = await seedCoveragePlanVersion(getServiceTestDb(), vertical);
        const principal = await seedCoverageSubscription(getServiceTestDb(), {
            userId: user.userId,
            vertical,
            ...principalPlan,
            status: 'ACTIVE'
        });
        principals.push(principal.subscriptionId);
        const principalAuthorization = await fake.authorize({
            reference: crypto.randomUUID(),
            amount: { amountMinor: 1000000, currency: 'ARS' },
            cadence: { everyMonths: 1 },
            reason: 'principal fixture',
            returnUrl: 'https://example.test/return',
            payerEmail: `principal-${crypto.randomUUID()}@example.test`
        });
        await fake.approve({ authorizationId: principalAuthorization.authorizationId });
        await getServiceTestDb().insert(providerLinks).values({
            subscriptionId: principal.subscriptionId,
            provider: 'MERCADO_PAGO',
            providerId: principalAuthorization.authorizationId
        });
        const addon = await seedS20Addon({
            fake,
            userId: user.userId,
            vertical,
            targetId: principal.subscriptionId,
            compatibleVerticals: [vertical]
        });
        const alreadyCancelled = await seedS20Addon({
            fake,
            userId: user.userId,
            vertical,
            targetId: principal.subscriptionId,
            compatibleVerticals: [vertical]
        });
        await fake.cancel({ authorizationId: alreadyCancelled.authorizationId });
        const beforeCancel = vi.fn(outboxBeforeCancelNotice({ deliver: true }).beforeCancel);
        const cancel = vi.spyOn(fake, 'cancel');
        const refund = vi.spyOn(fake, 'refund');
        const plan = await seedGrantPlan(getServiceTestDb(), vertical);
        const result = await grantPermanentGrant(
            {
                beneficiaryUserId: user.userId,
                actor: grantSignerActor(admin.userId),
                reason: 'S20 provider',
                includesAddons: true,
                anchors: [{ vertical, ...plan }]
            },
            {
                planPolicy: currentFloorPolicy,
                clock,
                provider: namespaceFake(fake),
                beforeCancelNotice: { beforeCancel },
                coverageNotices: { emitCoverageChanged: async () => undefined },
                orphanhood: {
                    addonPolicy: addonPolicyFromTx(getServiceTestDb()),
                    listing: async () => {
                        throw new Error('no listing');
                    }
                }
            }
        );
        expect(beforeCancel).toHaveBeenCalledWith({
            subscriptionId: addon.complementId,
            userId: user.userId,
            kind: 'PERMANENT_GRANT_ADDON'
        });
        const templates = (
            await getServiceTestDb()
                .select({ template: emailOutbox.template })
                .from(emailOutbox)
                .where(eq(emailOutbox.recipientUserId, user.userId))
        ).map((row) => row.template);
        expect(templates).toContain('billing.permanent-grant-addon-cancel');
        expect(templates).toContain('billing.permanent-grant-cancel');
        expect(result.addonProviderCalls).toContainEqual({
            subscriptionId: addon.complementId,
            cancelCall: 'SENT'
        });
        expect(result.addonProviderCalls).toContainEqual({
            subscriptionId: alreadyCancelled.complementId,
            cancelCall: 'NOT_NEEDED'
        });
        expect(cancel).toHaveBeenCalledTimes(2);
        expect(refund).not.toHaveBeenCalled();
        const refundRows = await getServiceTestDb()
            .select({ id: refunds.id })
            .from(refunds)
            .innerJoin(payments, eq(payments.id, refunds.paymentId))
            .where(
                inArray(payments.subscriptionId, [
                    addon.complementId,
                    alreadyCancelled.complementId
                ])
            );
        expect(refundRows).toHaveLength(0);
    });

    it('q — TEST:B9a:4 failed provider call resumes as S20, then becomes NOT_NEEDED without another call', async () => {
        const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
        const user = await seedCoverageUser(getServiceTestDb());
        const admin = await seedCoverageUser(getServiceTestDb());
        users.push(user.userId, admin.userId);
        const vertical = VerticalEnum.ACCOMMODATION;
        const pp = await seedCoveragePlanVersion(getServiceTestDb(), vertical);
        const principal = await seedCoverageSubscription(getServiceTestDb(), {
            userId: user.userId,
            vertical,
            ...pp,
            status: 'ACTIVE'
        });
        principals.push(principal.subscriptionId);
        const addon = await seedS20Addon({
            fake,
            userId: user.userId,
            vertical,
            targetId: principal.subscriptionId,
            compatibleVerticals: [vertical]
        });
        const cancel = vi.spyOn(fake, 'cancel').mockRejectedValueOnce(new Error('boom'));
        const plan = await seedGrantPlan(getServiceTestDb(), vertical);
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
        const grant = await grantPermanentGrant(
            {
                beneficiaryUserId: user.userId,
                actor: grantSignerActor(admin.userId),
                reason: 'S20 retry',
                includesAddons: true,
                anchors: [{ vertical, ...plan }]
            },
            ports
        );
        expect(grant.addonProviderCalls).toContainEqual({
            subscriptionId: addon.complementId,
            cancelCall: 'FAILED'
        });
        expect(
            (
                await domainEventModel.findByEntity({
                    entityType: 'subscription',
                    entityId: addon.complementId
                })
            ).filter(
                (event) =>
                    event.eventType === 'subscription.provider_cancellation_decided' &&
                    event.reason === 'S20'
            )
        ).toHaveLength(1);
        const resumed = await resumePermanentGrant(
            { permanentGrantId: grant.permanentGrantId, actor: grantSignerActor(admin.userId) },
            ports
        );
        expect(resumed.addonProviderCalls).toContainEqual({
            subscriptionId: addon.complementId,
            cancelCall: 'SENT'
        });
        const again = await resumePermanentGrant(
            { permanentGrantId: grant.permanentGrantId, actor: grantSignerActor(admin.userId) },
            ports
        );
        expect(again.addonProviderCalls).toContainEqual({
            subscriptionId: addon.complementId,
            cancelCall: 'NOT_NEEDED'
        });
        expect(cancel).toHaveBeenCalledTimes(2);
    });

    it('u — TEST:B9a:4 resume dispatches principal and complement notices through their own kinds', async () => {
        const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
        const user = await seedCoverageUser(getServiceTestDb());
        const admin = await seedCoverageUser(getServiceTestDb());
        users.push(user.userId, admin.userId);
        const vertical = VerticalEnum.ACCOMMODATION;
        const plan = await seedCoveragePlanVersion(getServiceTestDb(), vertical);
        const principal = await seedCoverageSubscription(getServiceTestDb(), {
            userId: user.userId,
            vertical,
            ...plan,
            status: 'ACTIVE'
        });
        principals.push(principal.subscriptionId);
        const auth = await fake.authorize({
            reference: crypto.randomUUID(),
            amount: { amountMinor: 1000000, currency: 'ARS' },
            cadence: { everyMonths: 1 },
            reason: 'principal resume fixture',
            returnUrl: 'https://example.test/return',
            payerEmail: `principal-${crypto.randomUUID()}@example.test`
        });
        await fake.approve({ authorizationId: auth.authorizationId });
        await getServiceTestDb().insert(providerLinks).values({
            subscriptionId: principal.subscriptionId,
            provider: 'MERCADO_PAGO',
            providerId: auth.authorizationId
        });
        const addon = await seedS20Addon({
            fake,
            userId: user.userId,
            vertical,
            targetId: principal.subscriptionId,
            compatibleVerticals: [vertical]
        });
        const planForGrant = await seedGrantPlan(getServiceTestDb(), vertical);
        const base = {
            planPolicy: currentFloorPolicy,
            clock,
            provider: namespaceFake(fake),
            beforeCancelNotice: outboxBeforeCancelNotice({}),
            coverageNotices: { emitCoverageChanged: async () => undefined },
            orphanhood: {
                addonPolicy: addonPolicyFromTx(getServiceTestDb()),
                listing: async () => {
                    throw new Error('no listing');
                }
            }
        };
        const grant = await grantPermanentGrant(
            {
                beneficiaryUserId: user.userId,
                actor: grantSignerActor(admin.userId),
                reason: 'S20 dispatch',
                includesAddons: true,
                anchors: [{ vertical, ...planForGrant }]
            },
            base
        );
        expect(grant.providerCalls[0]?.cancelCall).toBe('NOTICE_PENDING');
        expect(grant.addonProviderCalls[0]?.cancelCall).toBe('NOTICE_PENDING');
        await getServiceTestDb()
            .update(emailOutbox)
            .set({ status: 'sent' })
            .where(eq(emailOutbox.recipientUserId, user.userId));
        const resumed = await resumePermanentGrant(
            { permanentGrantId: grant.permanentGrantId, actor: grantSignerActor(admin.userId) },
            { ...base, beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }) }
        );
        expect(resumed.providerCalls).toContainEqual({
            subscriptionId: principal.subscriptionId,
            cancelCall: 'SENT'
        });
        expect(resumed.addonProviderCalls).toContainEqual({
            subscriptionId: addon.complementId,
            cancelCall: 'SENT'
        });
        const templates = (
            await getServiceTestDb()
                .select({ template: emailOutbox.template })
                .from(emailOutbox)
                .where(eq(emailOutbox.recipientUserId, user.userId))
        ).map((row) => row.template);
        expect(templates).toContain('billing.permanent-grant-cancel');
        expect(templates).toContain('billing.permanent-grant-addon-cancel');
    });

    it('g — TEST:B9a:4 includesAddons false cancels the principal but leaves the addon preapproval live', async () => {
        const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
        const user = await seedCoverageUser(getServiceTestDb());
        const admin = await seedCoverageUser(getServiceTestDb());
        users.push(user.userId, admin.userId);
        const vertical = VerticalEnum.ACCOMMODATION;
        const pp = await seedCoveragePlanVersion(getServiceTestDb(), vertical);
        const principal = await seedCoverageSubscription(getServiceTestDb(), {
            userId: user.userId,
            vertical,
            ...pp,
            status: 'ACTIVE'
        });
        principals.push(principal.subscriptionId);
        const principalAuth = await fake.authorize({
            reference: crypto.randomUUID(),
            amount: { amountMinor: 1000000, currency: 'ARS' },
            cadence: { everyMonths: 1 },
            reason: 'principal false fixture',
            returnUrl: 'https://example.test/return',
            payerEmail: `principal-${crypto.randomUUID()}@example.test`
        });
        await fake.approve({ authorizationId: principalAuth.authorizationId });
        await getServiceTestDb().insert(providerLinks).values({
            subscriptionId: principal.subscriptionId,
            provider: 'MERCADO_PAGO',
            providerId: principalAuth.authorizationId
        });
        const addon = await seedS20Addon({
            fake,
            userId: user.userId,
            vertical,
            targetId: principal.subscriptionId,
            compatibleVerticals: [vertical]
        });
        const cancel = vi.spyOn(fake, 'cancel');
        const plan = await seedGrantPlan(getServiceTestDb(), vertical);
        const result = await grantPermanentGrant(
            {
                beneficiaryUserId: user.userId,
                actor: grantSignerActor(admin.userId),
                reason: 'S13 only',
                includesAddons: false,
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
        expect(result.cancelledSubscriptionIds).toContain(principal.subscriptionId);
        expect(result.addonProviderCalls).toEqual([]);
        expect(
            cancel.mock.calls.some(([call]) => call.authorizationId === addon.authorizationId)
        ).toBe(false);
        expect(
            (await fake.readAuthorization({ authorizationId: addon.authorizationId })).snapshot
                .status
        ).toBe('active');
        expect(
            (
                await getServiceTestDb()
                    .select({ status: subscriptions.status })
                    .from(subscriptions)
                    .where(eq(subscriptions.id, addon.complementId))
            )[0]?.status
        ).toBe('ACTIVE');
        expect(
            (
                await getServiceTestDb()
                    .select({ titleAnchorId: addonInstances.titleAnchorId })
                    .from(addonInstances)
                    .where(eq(addonInstances.id, addon.instanceId))
            )[0]?.titleAnchorId
        ).toBeNull();
    });

    it('r — TEST:B9a:4 pending addon notice defers the call; resume after delivery cancels it', async () => {
        const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
        const user = await seedCoverageUser(getServiceTestDb());
        const admin = await seedCoverageUser(getServiceTestDb());
        users.push(user.userId, admin.userId);
        const vertical = VerticalEnum.ACCOMMODATION;
        const addon = await seedS20Addon({
            fake,
            userId: user.userId,
            vertical,
            targetId: null,
            scopeType: 'USER',
            compatibleVerticals: [vertical]
        });
        const plan = await seedGrantPlan(getServiceTestDb(), vertical);
        const ports = {
            planPolicy: currentFloorPolicy,
            clock,
            provider: namespaceFake(fake),
            beforeCancelNotice: outboxBeforeCancelNotice({ deliver: false }),
            coverageNotices: { emitCoverageChanged: async () => undefined },
            orphanhood: {
                addonPolicy: addonPolicyFromTx(getServiceTestDb()),
                listing: async () => {
                    throw new Error('no listing');
                }
            }
        };
        const grant = await grantPermanentGrant(
            {
                beneficiaryUserId: user.userId,
                actor: grantSignerActor(admin.userId),
                reason: 'pending notice',
                includesAddons: true,
                anchors: [{ vertical, ...plan }]
            },
            ports
        );
        expect(grant.addonProviderCalls).toContainEqual({
            subscriptionId: addon.complementId,
            cancelCall: 'NOTICE_PENDING'
        });
        expect(
            (
                await getServiceTestDb()
                    .select({ status: subscriptions.status })
                    .from(subscriptions)
                    .where(eq(subscriptions.id, addon.complementId))
            )[0]?.status
        ).toBe('CANCELLED');
        const resumed = await resumePermanentGrant(
            { permanentGrantId: grant.permanentGrantId, actor: grantSignerActor(admin.userId) },
            { ...ports, beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }) }
        );
        expect(resumed.addonProviderCalls).toContainEqual({
            subscriptionId: addon.complementId,
            cancelCall: 'SENT'
        });
    });

    it.each([
        'NO_RECIPIENT',
        'DELIVERY_EXHAUSTED'
    ] as const)('s — TEST:B9a:4 cancellation proceeds and reports %s escalation', async (notice) => {
        const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
        const user = await seedCoverageUser(getServiceTestDb());
        const admin = await seedCoverageUser(getServiceTestDb());
        users.push(user.userId, admin.userId);
        const vertical = VerticalEnum.ACCOMMODATION;
        const addon = await seedS20Addon({
            fake,
            userId: user.userId,
            vertical,
            targetId: null,
            scopeType: 'USER',
            compatibleVerticals: [vertical]
        });
        const plan = await seedGrantPlan(getServiceTestDb(), vertical);
        const result = await grantPermanentGrant(
            {
                beneficiaryUserId: user.userId,
                actor: grantSignerActor(admin.userId),
                reason: 'escalation',
                includesAddons: true,
                anchors: [{ vertical, ...plan }]
            },
            {
                planPolicy: currentFloorPolicy,
                clock,
                provider: namespaceFake(fake),
                beforeCancelNotice: { beforeCancel: async () => notice },
                coverageNotices: { emitCoverageChanged: async () => undefined },
                orphanhood: {
                    addonPolicy: addonPolicyFromTx(getServiceTestDb()),
                    listing: async () => {
                        throw new Error('no listing');
                    }
                }
            }
        );
        expect(result.addonProviderCalls).toContainEqual({
            subscriptionId: addon.complementId,
            cancelCall: 'SENT',
            escalated: notice
        });
    });

    it('t — TEST:B9a:4 missing link and MANUAL payment are NOT_APPLICABLE without a decision', async () => {
        const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
        const user = await seedCoverageUser(getServiceTestDb());
        const admin = await seedCoverageUser(getServiceTestDb());
        users.push(user.userId, admin.userId);
        const vertical = VerticalEnum.ACCOMMODATION;
        const noLink = await seedS20Addon({
            fake,
            userId: user.userId,
            vertical,
            targetId: null,
            scopeType: 'USER',
            compatibleVerticals: [vertical],
            withLink: false
        });
        const manual = await seedS20Addon({
            fake,
            userId: user.userId,
            vertical,
            targetId: null,
            scopeType: 'USER',
            compatibleVerticals: [vertical],
            paymentMethod: 'MANUAL'
        });
        const plan = await seedGrantPlan(getServiceTestDb(), vertical);
        const result = await grantPermanentGrant(
            {
                beneficiaryUserId: user.userId,
                actor: grantSignerActor(admin.userId),
                reason: 'not applicable',
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
        expect(result.addonProviderCalls).toContainEqual({
            subscriptionId: noLink.complementId,
            cancelCall: 'NOT_APPLICABLE'
        });
        expect(result.addonProviderCalls).toContainEqual({
            subscriptionId: manual.complementId,
            cancelCall: 'NOT_APPLICABLE'
        });
        for (const row of [noLink, manual])
            expect(
                (
                    await domainEventModel.findByEntity({
                        entityType: 'subscription',
                        entityId: row.complementId
                    })
                ).some(
                    (event) =>
                        event.eventType === 'subscription.provider_cancellation_decided' &&
                        event.reason === 'S20'
                )
            ).toBe(false);
    });
});
