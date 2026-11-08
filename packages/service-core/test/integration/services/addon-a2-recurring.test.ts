import type { CoverageChangedEvent } from '@repo/billing-verticals-contract';
import {
    addonInstances,
    addonProducts,
    emailOutbox,
    eq,
    providerLinks,
    subscriptions
} from '@repo/db';
import { encodeFakeNotice } from '@repo/payments/fake';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { applyA2Recurring } from '../../../src/services/billing/addon/addon-instance-a2';
import { purchaseAddon } from '../../../src/services/billing/addon/purchase-addon.service';
import { processProviderNotice } from '../../../src/services/billing/notice/process-provider-notice.service';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers';
import { payingPrincipal } from './support/addon-a2-fixtures';
import { purchaseFixture, retirePurchaseFixtures } from './support/addon-purchase-fixtures';

afterEach(async () => {
    vi.restoreAllMocks();
    await retirePurchaseFixtures();
});
afterAll(closeServiceTestPool);

describe('TEST:B10:4 AC:B10:3 recurring addon authorization', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        'activates its own complement without mutating the principal preapproval',
        async () => {
            const f = await purchaseFixture({
                chargeKind: 'PERIODICO',
                cycle: 'annual',
                verticals: ['accommodation', 'venue']
            });
            const principal = await payingPrincipal(f);
            const principalBefore = (
                await f.fake.readAuthorization({ authorizationId: principal.authorizationId })
            ).snapshot;
            const bought = await purchaseAddon(f.input(), f.ports);
            expect(bought.outcome).toBe('CREATED');
            if (bought.outcome !== 'CREATED') throw new Error('Purchase did not create');
            const [instance] = await getServiceTestDb()
                .select()
                .from(addonInstances)
                .where(eq(addonInstances.id, bought.instanceId));
            expect(instance?.complementSubscriptionId).toEqual(expect.any(String));
            if (!instance?.complementSubscriptionId) throw new Error('Complement missing');
            const complementId = instance.complementSubscriptionId;
            const [link] = await getServiceTestDb()
                .select()
                .from(providerLinks)
                .where(eq(providerLinks.subscriptionId, instance.complementSubscriptionId));
            if (!link) throw new Error('Addon preapproval missing');
            const addonBefore = (
                await f.fake.readAuthorization({ authorizationId: link.providerId })
            ).snapshot;
            const [product] = await getServiceTestDb()
                .select({ price: addonProducts.price })
                .from(addonProducts)
                .where(eq(addonProducts.id, f.productId));
            expect(addonBefore).toMatchObject({
                reference: instance.complementSubscriptionId,
                amount: { amountMinor: product?.price, currency: 'ARS' },
                cadence: { everyMonths: 12 }
            });
            const emit = vi.fn(async (_event: CoverageChangedEvent) => {});
            await f.fake.approve({ authorizationId: link.providerId });
            const notice = encodeFakeNotice({
                notice: {
                    resourceKind: 'authorization',
                    resourceId: link.providerId,
                    version: '1'
                },
                format: 'json'
            });
            const answer = await processProviderNotice(
                {
                    channel: 'WEBHOOKS',
                    delivery: { headers: { 'content-type': 'application/json' }, body: notice.body }
                },
                {
                    provider: f.fake,
                    clock: f.ports.clock,
                    beforeCancelNotice: { beforeCancel: async () => 'SENT' },
                    complements: f.ports,
                    coverageNotices: { emitCoverageChanged: emit }
                }
            );
            expect(answer).toMatchObject({ ack: 'OK', outcome: 'APPLIED' });
            const [complement] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, instance.complementSubscriptionId));
            const [active] = await getServiceTestDb()
                .select()
                .from(addonInstances)
                .where(eq(addonInstances.id, instance.id));
            expect(complement?.status).toBe('ACTIVE');
            expect(active).toMatchObject({
                status: 'ACTIVE',
                startsAt: expect.any(Date),
                endsAt: null
            });
            const principalAfter = (
                await f.fake.readAuthorization({ authorizationId: principal.authorizationId })
            ).snapshot;
            expect(principalAfter.amount).toEqual(principalBefore.amount);
            const signups = await getServiceTestDb()
                .select()
                .from(emailOutbox)
                .where(eq(emailOutbox.recipientUserId, f.ownerId));
            expect(
                signups.filter((row) => row.template === 'billing.signup-confirmed')
            ).toMatchObject([
                { payload: expect.objectContaining({ subscriptionId: principal.subscriptionId }) }
            ]);
            expect(emit.mock.calls.map(([event]) => event)).toEqual([
                {
                    userId: f.ownerId,
                    vertical: 'accommodation',
                    sourceType: 'ADDON',
                    change: 'ADDED'
                },
                { userId: f.ownerId, vertical: 'venue', sourceType: 'ADDON', change: 'ADDED' }
            ]);
            const replay = await getServiceTestDb().transaction((tx) =>
                applyA2Recurring(
                    {
                        tx,
                        complementSubscriptionId: complementId,
                        now: f.ports.clock.now()
                    },
                    f.ports
                )
            );
            expect(replay).toEqual({ outcome: 'NOT_APPLICABLE' });
            expect(emit).toHaveBeenCalledTimes(2);
        }
    );
});
