import {
    addonInstances,
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
import { grantPermanentGrant } from '../../../src/services/billing/grant/permanent-grant.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    addonPolicyFromTx,
    seedCoveragePlanVersion,
    seedCoverageSubscription,
    seedCoverageUser
} from './support/coverage-fixtures.js';
import { outboxBeforeCancelNotice } from './support/outbox-before-cancel-notice.js';
import { namespaceFake } from './support/payment-provider.js';
import { retirePermanentGrantRows, seedGrantPlan } from './support/permanent-grant-fixtures.js';
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
                    grantedBy: admin.userId,
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
