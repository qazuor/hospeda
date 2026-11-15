import { billingOptions, domainEvent, eq, plans, planVersions, subscriptions } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
    previewCyclePrice,
    setCyclePrice
} from '../../../src/services/billing/pricing/cycle-price.service.js';
import {
    PROVIDER_AMOUNT_CEILING_MINOR,
    PROVIDER_AMOUNT_FLOOR_MINOR
} from '../../../src/services/billing/promo/provider-amount-floor.js';
import { readAnchoredBillingOption } from '../../../src/services/billing/read-anchored-billing-option.js';
import { activateSubscription } from '../../../src/services/billing/subscription/activate-subscription.service.js';
import {
    closeServiceTestPool,
    getServiceTestDb,
    getServiceTestPool,
    isServiceTestDbAvailable
} from './helpers.js';
import {
    seedCyclePriceDeadlines,
    seedCyclePriceVersion,
    startCyclePriceCustomer
} from './support/cycle-price-fixtures.js';
import { noTouristVip } from './support/tourist-vip.js';

beforeAll(seedCyclePriceDeadlines);
afterAll(closeServiceTestPool);

const price = PROVIDER_AMOUNT_FLOOR_MINOR + 100;
const nextPrice = price + 100;
const request = (planVersionId: string, amount = price, cycle = 'monthly') => ({
    planVersionId,
    cycle,
    amount
});

async function eventRows(optionId: string) {
    return getServiceTestDb().select().from(domainEvent).where(eq(domainEvent.entityId, optionId));
}

async function optionRows(planVersionId: string) {
    return getServiceTestDb()
        .select()
        .from(billingOptions)
        .where(eq(billingOptions.planVersionId, planVersionId));
}

async function confirm(
    actor: Awaited<ReturnType<typeof seedCyclePriceVersion>>['actor'],
    planVersionId: string,
    amount = price,
    expectedPreviousAmount: number | null = null,
    cycle = 'monthly'
) {
    return setCyclePrice({
        actor,
        input: {
            ...request(planVersionId, amount, cycle),
            expectedPreviousAmount,
            confirmed: true
        },
        correlationId: crypto.randomUUID()
    });
}

describe.skipIf(!isServiceTestDbAvailable())('cycle price action 19', () => {
    it('TEST:B2:6 E1 creates an option and records its previous null amount', async () => {
        const fixture = await seedCyclePriceVersion();
        const preview = await previewCyclePrice({
            actor: fixture.actor,
            input: request(fixture.planVersionId)
        });
        expect(preview).toMatchObject({
            previousAmount: null,
            newAmount: price,
            cycle: 'monthly',
            customersReached: 0
        });
        expect(preview.message).toContain('sin precio');
        expect(preview.message).toContain(String(price));
        const result = await confirm(fixture.actor, fixture.planVersionId);
        expect(result.billingOption.amount).toBe(price);
        const events = (await eventRows(result.billingOption.id)).filter(
            (row) => row.eventType === 'billing_option.price_set'
        );
        expect(events).toHaveLength(1);
        expect(events[0]?.changes).toContainEqual({
            field: 'billing_option.amount',
            old: null,
            new: price
        });
    });

    it('TEST:B2:6 E2 updates the same option and records the old amount', async () => {
        const fixture = await seedCyclePriceVersion();
        const first = await confirm(fixture.actor, fixture.planVersionId);
        const preview = await previewCyclePrice({
            actor: fixture.actor,
            input: request(fixture.planVersionId, nextPrice)
        });
        expect(preview).toMatchObject({ previousAmount: price, newAmount: nextPrice });
        const second = await confirm(fixture.actor, fixture.planVersionId, nextPrice, price);
        expect(second.billingOption.id).toBe(first.billingOption.id);
        expect(second.billingOption.amount).toBe(nextPrice);
        const events = (await eventRows(first.billingOption.id)).filter(
            (row) => row.eventType === 'billing_option.price_set'
        );
        expect(events).toHaveLength(2);
        expect(events.find((row) => row.id === second.domainEventId)?.changes).toContainEqual({
            field: 'billing_option.amount',
            old: price,
            new: nextPrice
        });
    });

    it.each([false, true])('TEST:B2:6 E3 rejects Juan anchored (active=%s)', async (active) => {
        const fixture = await seedCyclePriceVersion();
        const first = await confirm(fixture.actor, fixture.planVersionId);
        const juan = await startCyclePriceCustomer(first.billingOption.id);
        if (active) {
            await juan.fake.approve({
                authorizationId: juan.authorizationId.split(':').at(-1) ?? ''
            });
            const activation = await activateSubscription(juan.subscriptionId, {
                provider: juan.provider,
                clock: { now: () => new Date('2026-10-08T20:00:00.000Z') },
                beforeCancelNotice: { beforeCancel: async () => 'SENT' },
                touristVipInheritance: noTouristVip
            });
            expect(activation.activated).toBe(true);
        }
        await expect(
            previewCyclePrice({
                actor: fixture.actor,
                input: request(fixture.planVersionId, nextPrice)
            })
        ).rejects.toMatchObject({ reason: 'PLAN_VERSION_HAS_CUSTOMERS' });
        await expect(
            confirm(fixture.actor, fixture.planVersionId, nextPrice, price)
        ).rejects.toMatchObject({ reason: 'PLAN_VERSION_HAS_CUSTOMERS' });
        expect((await optionRows(fixture.planVersionId))[0]?.amount).toBe(price);
        expect(
            (await eventRows(first.billingOption.id)).filter(
                (row) => row.eventType === 'billing_option.price_set'
            )
        ).toHaveLength(1);
        const [subscription] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, juan.subscriptionId));
        if (!subscription?.planVersionId || !subscription.billingOptionId)
            throw new Error('Missing Juan anchor');
        expect(
            (
                await readAnchoredBillingOption({
                    subscription: {
                        planVersionId: subscription.planVersionId,
                        billingOptionId: subscription.billingOptionId
                    }
                })
            )?.amount
        ).toBe(price);
    });

    it('AC:B2:10 E4 rejects below provider floor and accepts the boundary', async () => {
        const fixture = await seedCyclePriceVersion();
        const below = PROVIDER_AMOUNT_FLOOR_MINOR - 1;
        await expect(
            previewCyclePrice({
                actor: fixture.actor,
                input: request(fixture.planVersionId, below)
            })
        ).rejects.toMatchObject({
            reason: 'CYCLE_PRICE_BELOW_PROVIDER_MINIMUM',
            message: `El monto mínimo que acepta Mercado Pago es ARS ${PROVIDER_AMOUNT_FLOOR_MINOR / 100}.`
        });
        await expect(confirm(fixture.actor, fixture.planVersionId, below)).rejects.toMatchObject({
            reason: 'CYCLE_PRICE_BELOW_PROVIDER_MINIMUM'
        });
        expect(await optionRows(fixture.planVersionId)).toHaveLength(0);
        const result = await confirm(
            fixture.actor,
            fixture.planVersionId,
            PROVIDER_AMOUNT_FLOOR_MINOR
        );
        expect(result.billingOption.amount).toBe(PROVIDER_AMOUNT_FLOOR_MINOR);
    });

    it('PM-334 rejects a non-sellable version before writing and allows current=false', async () => {
        const fixture = await seedCyclePriceVersion();
        const [plan] = await getServiceTestDb()
            .insert(plans)
            .values({
                vertical: 'accommodation',
                slug: `cycle-unsellable-${crypto.randomUUID()}`,
                name: 'Básico'
            })
            .returning({ id: plans.id });
        if (!plan) throw new Error('Missing fixture plan');
        const [version] = await getServiceTestDb()
            .insert(planVersions)
            .values({
                planId: plan.id,
                vertical: 'accommodation',
                rank: Math.floor(Math.random() * 1_000_000_000) + 1000,
                sellable: false,
                current: false,
                graceDays: 10,
                trialDays: 0,
                allowsPause: false
            })
            .returning({ id: planVersions.id });
        if (!version) throw new Error('Missing fixture version');
        await expect(
            previewCyclePrice({ actor: fixture.actor, input: request(version.id) })
        ).rejects.toMatchObject({ reason: 'PLAN_VERSION_NOT_SELLABLE' });
        await expect(confirm(fixture.actor, version.id)).rejects.toMatchObject({
            reason: 'PLAN_VERSION_NOT_SELLABLE'
        });
        expect(await optionRows(version.id)).toHaveLength(0);
        const [other] = await getServiceTestDb()
            .insert(planVersions)
            .values({
                planId: plan.id,
                vertical: 'accommodation',
                rank: Math.floor(Math.random() * 1_000_000_000) + 1000,
                sellable: true,
                current: false,
                graceDays: 10,
                trialDays: 0,
                allowsPause: false
            })
            .returning({ id: planVersions.id });
        if (!other) throw new Error('Missing noncurrent fixture');
        expect((await confirm(fixture.actor, other.id)).billingOption.amount).toBe(price);
    });

    it('PM-334 rejects an amount above RP3 ceiling before any write in preview and act', async () => {
        const fixture = await seedCyclePriceVersion();
        const above = PROVIDER_AMOUNT_CEILING_MINOR + 1;
        await expect(
            previewCyclePrice({
                actor: fixture.actor,
                input: request(fixture.planVersionId, above)
            })
        ).rejects.toMatchObject({
            reason: 'CYCLE_PRICE_ABOVE_PROVIDER_MAXIMUM',
            message: `El monto máximo que acepta Mercado Pago es ARS ${PROVIDER_AMOUNT_CEILING_MINOR / 100}.`
        });
        await expect(confirm(fixture.actor, fixture.planVersionId, above)).rejects.toMatchObject({
            reason: 'CYCLE_PRICE_ABOVE_PROVIDER_MAXIMUM'
        });
        expect(await optionRows(fixture.planVersionId)).toHaveLength(0);
        expect(
            (await confirm(fixture.actor, fixture.planVersionId, PROVIDER_AMOUNT_CEILING_MINOR))
                .billingOption.amount
        ).toBe(PROVIDER_AMOUNT_CEILING_MINOR);
    });

    it('AC:B2:4 E5 checks grace at equal and shorter cycle boundaries', async () => {
        const equal = await seedCyclePriceVersion(28);
        await expect(confirm(equal.actor, equal.planVersionId)).rejects.toMatchObject({
            reason: 'CYCLE_NOT_LONGER_THAN_GRACE'
        });
        expect(await optionRows(equal.planVersionId)).toHaveLength(0);
        const shorter = await seedCyclePriceVersion(27);
        expect((await confirm(shorter.actor, shorter.planVersionId)).billingOption.amount).toBe(
            price
        );
        const quarterly = await seedCyclePriceVersion(89);
        await expect(
            confirm(quarterly.actor, quarterly.planVersionId, price, null, 'quarterly')
        ).rejects.toMatchObject({ reason: 'CYCLE_NOT_LONGER_THAN_GRACE' });
        expect(
            (await confirm(quarterly.actor, quarterly.planVersionId, price, null, 'semiannual'))
                .billingOption.cycle
        ).toBe('semiannual');
    });

    it('AC:B2:4 E6 rejects unauthorized actors and an unknown version', async () => {
        const fixture = await seedCyclePriceVersion();
        const admin = { ...fixture.actor, permissions: [PermissionEnum.ACCESS_PANEL_ADMIN] };
        const system = { ...fixture.actor, _isSystemActor: true };
        await expect(confirm(admin, fixture.planVersionId)).rejects.toMatchObject({
            reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN'
        });
        await expect(confirm(system, fixture.planVersionId)).rejects.toMatchObject({
            reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN'
        });
        expect(await optionRows(fixture.planVersionId)).toHaveLength(0);
        await expect(confirm(fixture.actor, crypto.randomUUID())).rejects.toMatchObject({
            reason: 'PLAN_VERSION_NOT_FOUND'
        });
    });

    it('H-H E7 rejects stale confirmation and unchanged amount', async () => {
        const fixture = await seedCyclePriceVersion();
        const first = await confirm(fixture.actor, fixture.planVersionId);
        await expect(
            confirm(fixture.actor, fixture.planVersionId, nextPrice, null)
        ).rejects.toMatchObject({ reason: 'CYCLE_PRICE_CHANGED_SINCE_PREVIEW' });
        await expect(
            confirm(fixture.actor, fixture.planVersionId, price, price)
        ).rejects.toMatchObject({ reason: 'CYCLE_PRICE_UNCHANGED' });
        expect(
            (await eventRows(first.billingOption.id)).filter(
                (row) => row.eventType === 'billing_option.price_set'
            )
        ).toHaveLength(1);
    });

    it('E8 waits for an FK key-share lock on plan_version before changing price', async () => {
        const fixture = await seedCyclePriceVersion();
        const first = await confirm(fixture.actor, fixture.planVersionId);
        const blocker = await getServiceTestPool().connect();
        let pending: Promise<unknown> | undefined;
        try {
            await blocker.query('BEGIN');
            await blocker.query('SELECT 1 FROM plan_version WHERE id = $1 FOR KEY SHARE', [
                fixture.planVersionId
            ]);
            const blockerPid = (
                await blocker.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')
            ).rows[0]?.pid;
            if (!blockerPid) throw new Error('Missing blocker backend pid');
            let settled = false;
            pending = confirm(fixture.actor, fixture.planVersionId, nextPrice, price).finally(
                () => {
                    settled = true;
                }
            );
            const deadline = Date.now() + 5000;
            let blocked = false;
            while (Date.now() < deadline) {
                const result = await getServiceTestPool().query<{ pid: number }>(
                    `SELECT pid FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND $1 = ANY(pg_blocking_pids(pid)) LIMIT 1`,
                    [blockerPid]
                );
                if (result.rows.length) {
                    blocked = true;
                    break;
                }
                await new Promise((resolve) => setTimeout(resolve, 50));
            }
            expect(blocked).toBe(true);
            expect(settled).toBe(false);
            await blocker.query('ROLLBACK');
            const result = await pending;
            expect(result).toMatchObject({
                billingOption: { id: first.billingOption.id, amount: nextPrice }
            });
        } finally {
            await blocker.query('ROLLBACK');
            blocker.release();
            if (pending) await pending;
        }
    });
});
