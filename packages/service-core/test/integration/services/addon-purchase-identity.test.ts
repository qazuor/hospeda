import { addonInstances, eq, idempotencyKeys, providerLinks, subscriptions } from '@repo/db';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { purchaseAddon } from '../../../src/services/billing/addon/purchase-addon.service';
import { sendOneTimeOrder } from '../../../src/services/billing/addon/send-one-time-order.service';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers';
import {
    createProduct,
    principalFixture,
    purchaseFixture,
    purchaseNow,
    retirePurchaseFixtures
} from './support/addon-purchase-fixtures';

const skip = !isServiceTestDbAvailable();
afterEach(async () => {
    vi.restoreAllMocks();
    await retirePurchaseFixtures();
});
afterAll(closeServiceTestPool);

async function rows(ownerId: string) {
    return getServiceTestDb()
        .select()
        .from(addonInstances)
        .where(eq(addonInstances.ownerId, ownerId));
}

describe('TEST:B10:3 AC:B10:2 addon purchase identity', () => {
    it.skipIf(skip)(
        'replays one request into one instance, one key and one provider order',
        async () => {
            const f = await purchaseFixture();
            // The paying principal and payment are seeded directly.
            await principalFixture({ ownerId: f.ownerId, credited: true });
            const input = f.input();
            const first = await purchaseAddon(input, f.ports);
            const second = await purchaseAddon(input, f.ports);
            expect(first).toMatchObject({ outcome: 'CREATED' });
            expect(second).toMatchObject({
                outcome: 'EXISTING',
                instanceId: first.outcome === 'CREATED' ? first.instanceId : ''
            });
            const instances = await rows(f.ownerId);
            expect(instances).toHaveLength(1);
            const keys = await getServiceTestDb()
                .select()
                .from(idempotencyKeys)
                .where(eq(idempotencyKeys.subjectId, instances[0]!.id));
            expect(keys).toMatchObject([
                {
                    key: `order:${input.orderRequestId}`,
                    operation: 'ORDER_CREATE',
                    subjectId: instances[0]!.id
                }
            ]);
            const chargeOnce = vi.spyOn(f.fake, 'chargeOnce');
            const orderInput = {
                orderRequestId: input.orderRequestId,
                payerEmail: 'payer@example.test',
                payment: {
                    token: `card-${crypto.randomUUID()}`,
                    brand: 'visa',
                    kind: 'credit' as const
                }
            };
            const sent = await sendOneTimeOrder(orderInput, {
                provider: f.fake,
                clock: f.ports.clock
            });
            const resent = await sendOneTimeOrder(orderInput, {
                provider: f.fake,
                clock: f.ports.clock
            });
            expect(sent.outcome).toBe('ORDER_PLACED');
            expect(resent.outcome).toBe('ORDER_ALREADY_PLACED');
            expect(chargeOnce).toHaveBeenCalledTimes(1);
            expect(f.fake.ordersFor({ reference: input.orderRequestId })).toEqual({
                orders: 1,
                paid: 1
            });
        }
    );

    it.skipIf(skip)(
        'returns PENDING_ELSEWHERE for a different request on the same identity',
        async () => {
            const f = await purchaseFixture();
            // The paying principal and payment are seeded directly.
            await principalFixture({ ownerId: f.ownerId, credited: true });
            const first = await purchaseAddon(f.input(), f.ports);
            const second = await purchaseAddon(f.input(), f.ports);
            expect(first.outcome).toBe('CREATED');
            expect(second).toMatchObject({
                outcome: 'PENDING_ELSEWHERE',
                instanceId: first.outcome === 'CREATED' ? first.instanceId : ''
            });
            expect(await rows(f.ownerId)).toHaveLength(1);
        }
    );

    it.skipIf(skip)(
        'concurrent recurring replays create one complement and one preapproval',
        async () => {
            const f = await purchaseFixture({ chargeKind: 'PERIODICO', cycle: 'annual' });
            // The paying principal and payment are seeded directly.
            await principalFixture({ ownerId: f.ownerId, credited: true });
            const authorize = vi.spyOn(f.fake, 'authorize');
            const input = f.input();
            const results = await Promise.all([
                purchaseAddon(input, f.ports),
                purchaseAddon(input, f.ports)
            ]);
            expect(results.map(({ outcome }) => outcome).sort()).toEqual(['CREATED', 'EXISTING']);
            const instances = await rows(f.ownerId);
            expect(instances).toHaveLength(1);
            const complementId = instances[0]?.complementSubscriptionId;
            expect(complementId).toEqual(expect.any(String));
            const complements = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, complementId!));
            expect(complements).toMatchObject([
                {
                    class: 'COMPLEMENTO',
                    status: 'PENDING_AUTHORIZATION',
                    authorizationWindowDeadlineVersion: expect.any(Number),
                    authorizationWindowEndsAt: expect.any(Date)
                }
            ]);
            const links = await getServiceTestDb()
                .select()
                .from(providerLinks)
                .where(eq(providerLinks.subscriptionId, complementId!));
            expect(links).toHaveLength(1);
            expect(authorize).toHaveBeenCalledTimes(1);
            expect(await purchaseAddon(input, f.ports)).toMatchObject({
                outcome: 'EXISTING',
                instanceId: instances[0]!.id,
                checkoutUrl: expect.any(String)
            });
            expect(authorize).toHaveBeenCalledTimes(1);
            expect(authorize.mock.calls[0]?.[0]).toEqual({
                reference: complementId,
                amount: { amountMinor: 5000, currency: 'ARS' },
                cadence: { everyMonths: 12 },
                reason: 'Coverage addon',
                returnUrl: input.returnUrl,
                payerEmail: input.payerEmail
            });
        }
    );

    it.skipIf(skip)('refuses an active recurring identity', async () => {
        const f = await purchaseFixture({ chargeKind: 'PERIODICO' });
        // The paying principal and payment are seeded directly; A2 is simulated by a direct state update.
        await principalFixture({ ownerId: f.ownerId, credited: true });
        const first = await purchaseAddon(f.input(), f.ports);
        if (first.outcome !== 'CREATED') throw new Error('Expected initial purchase');
        await getServiceTestDb()
            .update(addonInstances)
            .set({ status: 'ACTIVE', startsAt: purchaseNow })
            .where(eq(addonInstances.id, first.instanceId));
        expect(await purchaseAddon(f.input(), f.ports)).toEqual({
            outcome: 'REFUSED',
            reason: 'ALREADY_ACTIVE'
        });
    });

    it.skipIf(skip)('allows another one-time purchase after an ACTIVE instance', async () => {
        const f = await purchaseFixture();
        // The paying principal and payment are seeded directly; A2 is simulated by a direct state update.
        await principalFixture({ ownerId: f.ownerId, credited: true });
        const first = await purchaseAddon(f.input(), f.ports);
        if (first.outcome !== 'CREATED') throw new Error('Expected initial purchase');
        await getServiceTestDb()
            .update(addonInstances)
            .set({ status: 'ACTIVE', startsAt: purchaseNow })
            .where(eq(addonInstances.id, first.instanceId));
        expect(await purchaseAddon(f.input(), f.ports)).toMatchObject({ outcome: 'CREATED' });
        expect(await rows(f.ownerId)).toHaveLength(2);
    });

    it.skipIf(skip)('allows another purchase after an ABANDONED instance', async () => {
        const f = await purchaseFixture();
        // The paying principal and payment are seeded directly; A3 is simulated by a direct state update.
        await principalFixture({ ownerId: f.ownerId, credited: true });
        const first = await purchaseAddon(f.input(), f.ports);
        if (first.outcome !== 'CREATED') throw new Error('Expected initial purchase');
        await getServiceTestDb()
            .update(addonInstances)
            .set({ status: 'ABANDONED' })
            .where(eq(addonInstances.id, first.instanceId));
        expect(await purchaseAddon(f.input(), f.ports)).toMatchObject({ outcome: 'CREATED' });
        expect(await rows(f.ownerId)).toHaveLength(2);
    });

    it.skipIf(skip)(
        'refuses reuse of the same request identifier for another product',
        async () => {
            const f = await purchaseFixture();
            // The paying principal and payment are seeded directly.
            await principalFixture({ ownerId: f.ownerId, credited: true });
            const input = f.input();
            expect(await purchaseAddon(input, f.ports)).toMatchObject({ outcome: 'CREATED' });
            const other = await createProduct({
                scopeType: 'USER',
                chargeKind: 'UNA_VEZ',
                cycle: 'monthly',
                verticals: ['accommodation']
            });
            expect(
                await purchaseAddon(
                    {
                        ...input,
                        productId: other.productId,
                        expectedAddonVersionId: other.versionId
                    },
                    f.ports
                )
            ).toEqual({ outcome: 'REFUSED', reason: 'ORDER_REQUEST_REUSED' });
        }
    );

    it.skipIf(skip)('rejects a stale expected addon version', async () => {
        const f = await purchaseFixture();
        // The paying principal and payment are seeded directly.
        await principalFixture({ ownerId: f.ownerId, credited: true });
        expect(
            await purchaseAddon(
                { ...f.input(), expectedAddonVersionId: crypto.randomUUID() },
                f.ports
            )
        ).toEqual({ outcome: 'REFUSED', reason: 'ADDON_VERSION_NOT_CURRENT' });
        expect(await rows(f.ownerId)).toHaveLength(0);
    });
});
