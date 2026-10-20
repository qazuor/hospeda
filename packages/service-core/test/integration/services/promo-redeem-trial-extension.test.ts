import type { ExtendTrialArgs } from '@repo/billing-verticals-contract';
import { VerticalsForBillingSimulator } from '@repo/billing-verticals-contract/testing';
import { eq, getDb, promoCodes, promoRedemptions, users } from '@repo/db';
import { VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { redeemTrialExtensionCode } from '../../../src/services';
import { closeServiceTestPool, getServiceTestDb } from './helpers';

const now = new Date('2026-10-12T12:00:00.000Z');
const clock = { now: () => new Date(now) };
const day = 24 * 60 * 60 * 1000;
const createdUserIds: string[] = [];
const createdPromoIds: string[] = [];

beforeAll(() => {
    getServiceTestDb();
});
afterAll(closeServiceTestPool);
afterEach(async () => {
    for (const promoCodeId of createdPromoIds.splice(0)) {
        await getDb().delete(promoRedemptions).where(eq(promoRedemptions.promoCodeId, promoCodeId));
        await getDb().delete(promoCodes).where(eq(promoCodes.id, promoCodeId));
    }
    for (const userId of createdUserIds.splice(0)) {
        await getDb().delete(users).where(eq(users.id, userId));
    }
});

async function seedUser(): Promise<string> {
    const [user] = await getDb()
        .insert(users)
        .values({
            email: `trial-promo-${crypto.randomUUID()}@example.test`,
            displayName: 'Trial promo user',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning({ id: users.id });
    if (!user) throw new Error('Could not seed promo user');
    createdUserIds.push(user.id);
    return user.id;
}

async function seedExtensionCode(
    input: {
        readonly verticals?: string[];
        readonly effectKind?: 'TRIAL_EXTENSION' | 'DISCOUNT';
        readonly totalQuota?: number | null;
        readonly validFrom?: Date;
        readonly validUntil?: Date | null;
    } = {}
) {
    const [promo] = await getDb()
        .insert(promoCodes)
        .values({
            code: `TRIAL-${crypto.randomUUID()}`,
            effectKind: input.effectKind ?? 'TRIAL_EXTENSION',
            extensionDays: input.effectKind === 'DISCOUNT' ? null : 5,
            discountKind: input.effectKind === 'DISCOUNT' ? 'FIXED' : null,
            value: input.effectKind === 'DISCOUNT' ? 100 : null,
            allVerticals: input.verticals === undefined,
            verticals: input.verticals ?? null,
            totalQuota: input.totalQuota === undefined ? 10 : input.totalQuota,
            validFrom: input.validFrom ?? new Date('2026-01-01T00:00:00.000Z'),
            validUntil:
                input.validUntil === undefined
                    ? new Date('2027-01-01T00:00:00.000Z')
                    : input.validUntil,
            stackable: false,
            usableWithAnotherActive: false,
            durationKind: input.effectKind === 'DISCOUNT' ? 'FOREVER' : null,
            durationCharges: null
        })
        .returning();
    if (!promo) throw new Error('Could not seed promo code');
    createdPromoIds.push(promo.id);
    return promo;
}

function configuredSimulator(input: {
    readonly userId: string;
    readonly endsAt?: Date;
    readonly remainingExtensionDays?: number;
}) {
    const simulator = new VerticalsForBillingSimulator({ clock });
    if (input.endsAt) {
        simulator.setTrial({
            userId: input.userId,
            vertical: VerticalEnum.ACCOMMODATION,
            endsAt: input.endsAt,
            remainingExtensionDays: input.remainingExtensionDays ?? 20
        });
    }
    return simulator;
}

async function redemptionCount(promoCodeId: string): Promise<number> {
    return (
        await getDb()
            .select({ id: promoRedemptions.id })
            .from(promoRedemptions)
            .where(eq(promoRedemptions.promoCodeId, promoCodeId))
    ).length;
}

describe('TEST:B9b:6 AC:B9b:6 redeeming a trial extension code with extenderTrial', () => {
    it('(a) leaves the code intact for each simulator rejection', async () => {
        for (const reason of ['TRIAL_ENDED', 'CEILING_REACHED', 'NO_TRIAL'] as const) {
            const userId = await seedUser();
            const promo = await seedExtensionCode();
            const simulator = configuredSimulator({
                userId,
                ...(reason === 'NO_TRIAL'
                    ? {}
                    : {
                          endsAt:
                              reason === 'TRIAL_ENDED'
                                  ? new Date(now.getTime() - day)
                                  : new Date(now.getTime() + day),
                          remainingExtensionDays: reason === 'CEILING_REACHED' ? 0 : 20
                      })
            });
            const extend = vi.spyOn(simulator, 'extendTrial');
            const before = simulator.trialEndsAt({ userId, vertical: VerticalEnum.ACCOMMODATION });
            const result = await redeemTrialExtensionCode(
                { userId, code: promo.code, vertical: VerticalEnum.ACCOMMODATION },
                { extendTrial: (args) => simulator.extendTrial(args), clock }
            );
            expect(result).toEqual({ outcome: 'REJECTED', reason });
            expect(extend).toHaveBeenCalledTimes(1);
            expect(await redemptionCount(promo.id)).toBe(0);
            const [storedPromo] = await getDb()
                .select({ totalQuota: promoCodes.totalQuota })
                .from(promoCodes)
                .where(eq(promoCodes.id, promo.id));
            expect(storedPromo?.totalQuota).toBe(10);
            expect(simulator.trialEndsAt({ userId, vertical: VerticalEnum.ACCOMMODATION })).toEqual(
                before
            );
        }
    });

    it('(b,g) accepts once for a user without a subscription or payment method', async () => {
        const userId = await seedUser();
        const promo = await seedExtensionCode();
        const simulator = configuredSimulator({
            userId,
            endsAt: new Date(now.getTime() + 10 * day)
        });
        const extend = vi.spyOn(simulator, 'extendTrial');
        const result = await redeemTrialExtensionCode(
            { userId, code: ` ${promo.code} `, vertical: VerticalEnum.ACCOMMODATION },
            { extendTrial: (args) => simulator.extendTrial(args), clock }
        );
        expect(result).toEqual({ outcome: 'REDEEMED', days: 5, replay: false });
        expect(extend).toHaveBeenCalledWith({
            userId,
            vertical: VerticalEnum.ACCOMMODATION,
            days: 5,
            redemptionKey: `promo-redemption:${promo.id}:${userId}`
        });
        expect(await redemptionCount(promo.id)).toBe(1);
        const [redemption] = await getDb()
            .select()
            .from(promoRedemptions)
            .where(eq(promoRedemptions.promoCodeId, promo.id));
        expect(redemption?.subscriptionId).toBeNull();
        expect(simulator.trialEndsAt({ userId, vertical: VerticalEnum.ACCOMMODATION })).toEqual(
            new Date(now.getTime() + 15 * day)
        );
    });

    it('(c) TEST:B9b:3 rejects a second use without extending or consuming twice', async () => {
        const userId = await seedUser();
        const promo = await seedExtensionCode();
        const simulator = configuredSimulator({
            userId,
            endsAt: new Date(now.getTime() + 10 * day)
        });
        const input = { userId, code: promo.code, vertical: VerticalEnum.ACCOMMODATION };
        const ports = {
            extendTrial: (args: ExtendTrialArgs) => simulator.extendTrial(args),
            clock
        };
        const extend = vi.spyOn(simulator, 'extendTrial');
        await redeemTrialExtensionCode(input, ports);
        const afterFirst = simulator.trialEndsAt({ userId, vertical: VerticalEnum.ACCOMMODATION });
        await expect(redeemTrialExtensionCode(input, ports)).rejects.toMatchObject({
            reason: 'PROMO_CODE_ALREADY_REDEEMED'
        });
        expect(simulator.trialEndsAt({ userId, vertical: VerticalEnum.ACCOMMODATION })).toEqual(
            afterFirst
        );
        expect(await redemptionCount(promo.id)).toBe(1);
        expect(extend).toHaveBeenCalledTimes(1);
    });

    it('(d) records an accepted extension after a process dies before inserting its redemption', async () => {
        const userId = await seedUser();
        const promo = await seedExtensionCode();
        const simulator = configuredSimulator({
            userId,
            endsAt: new Date(now.getTime() + 10 * day)
        });
        const redemptionKey = `promo-redemption:${promo.id}:${userId}`;
        await simulator.extendTrial({
            userId,
            vertical: VerticalEnum.ACCOMMODATION,
            days: 5,
            redemptionKey
        });
        expect(await redemptionCount(promo.id)).toBe(0);
        const result = await redeemTrialExtensionCode(
            { userId, code: promo.code, vertical: VerticalEnum.ACCOMMODATION },
            { extendTrial: (args) => simulator.extendTrial(args), clock }
        );
        expect(result).toEqual({ outcome: 'REDEEMED', days: 5, replay: false });
        expect(simulator.trialEndsAt({ userId, vertical: VerticalEnum.ACCOMMODATION })).toEqual(
            new Date(now.getTime() + 15 * day)
        );
        expect(await redemptionCount(promo.id)).toBe(1);
    });

    it('(e) checks vertical scope before calling extenderTrial', async () => {
        const userId = await seedUser();
        const promo = await seedExtensionCode({ verticals: [VerticalEnum.TOURIST] });
        const simulator = configuredSimulator({ userId, endsAt: new Date(now.getTime() + day) });
        const extend = vi.spyOn(simulator, 'extendTrial');
        await expect(
            redeemTrialExtensionCode(
                { userId, code: promo.code, vertical: VerticalEnum.ACCOMMODATION },
                { extendTrial: (args) => simulator.extendTrial(args), clock }
            )
        ).rejects.toMatchObject({ reason: 'PROMO_CODE_NOT_FOR_VERTICAL' });
        expect(extend).not.toHaveBeenCalled();
    });

    it('(f) rejects a discount code before calling extenderTrial', async () => {
        const userId = await seedUser();
        const promo = await seedExtensionCode({ effectKind: 'DISCOUNT' });
        const simulator = configuredSimulator({ userId, endsAt: new Date(now.getTime() + day) });
        const extend = vi.spyOn(simulator, 'extendTrial');
        await expect(
            redeemTrialExtensionCode(
                { userId, code: promo.code, vertical: VerticalEnum.ACCOMMODATION },
                { extendTrial: (args) => simulator.extendTrial(args), clock }
            )
        ).rejects.toMatchObject({ reason: 'PROMO_CODE_NOT_A_TRIAL_EXTENSION' });
        expect(extend).not.toHaveBeenCalled();
    });

    it('(d) TEST:B9b:3 rejects exhausted and expired trial codes before calling extendTrial', async () => {
        const userId = await seedUser();
        const quotaOwner = await seedUser();
        const exhausted = await seedExtensionCode({ totalQuota: 1 });
        await getDb().insert(promoRedemptions).values({
            promoCodeId: exhausted.id,
            userId: quotaOwner,
            subscriptionId: null,
            remainingCharges: null,
            redeemedAt: now
        });
        const expired = await seedExtensionCode({ validUntil: now });
        const simulator = configuredSimulator({
            userId,
            endsAt: new Date(now.getTime() + 10 * day)
        });
        const extend = vi.spyOn(simulator, 'extendTrial');
        for (const promo of [exhausted, expired]) {
            await expect(
                redeemTrialExtensionCode(
                    { userId, code: promo.code, vertical: VerticalEnum.ACCOMMODATION },
                    { extendTrial: (args) => simulator.extendTrial(args), clock }
                )
            ).rejects.toMatchObject({ reason: 'PROMO_CODE_NOT_AVAILABLE' });
        }
        expect(extend).not.toHaveBeenCalled();
    });

    it('(e) TEST:B9b:3 serializes five different trial extension redeemers against a quota of two', async () => {
        const promo = await seedExtensionCode({ totalQuota: 2 });
        const userIds = await Promise.all(Array.from({ length: 5 }, () => seedUser()));
        const simulator = new VerticalsForBillingSimulator({ clock });
        for (const userId of userIds)
            simulator.setTrial({
                userId,
                vertical: VerticalEnum.ACCOMMODATION,
                endsAt: new Date(now.getTime() + 10 * day),
                remainingExtensionDays: 20
            });
        const extend = vi.spyOn(simulator, 'extendTrial');
        const results = await Promise.allSettled(
            userIds.map((userId) =>
                redeemTrialExtensionCode(
                    { userId, code: promo.code, vertical: VerticalEnum.ACCOMMODATION },
                    { extendTrial: (args) => simulator.extendTrial(args), clock }
                )
            )
        );
        expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(2);
        expect(results.filter((result) => result.status === 'rejected')).toHaveLength(3);
        expect(extend).toHaveBeenCalledTimes(2);
        expect(await redemptionCount(promo.id)).toBe(2);
    });

    it('(h) inserts one redemption and extends once for two simultaneous requests', async () => {
        const userId = await seedUser();
        const promo = await seedExtensionCode();
        const simulator = configuredSimulator({
            userId,
            endsAt: new Date(now.getTime() + 10 * day)
        });
        const input = { userId, code: promo.code, vertical: VerticalEnum.ACCOMMODATION };
        const ports = {
            extendTrial: (args: ExtendTrialArgs) => simulator.extendTrial(args),
            clock
        };
        const results = await Promise.allSettled([
            redeemTrialExtensionCode(input, ports),
            redeemTrialExtensionCode(input, ports)
        ]);
        expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
        expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
        expect(await redemptionCount(promo.id)).toBe(1);
        expect(simulator.trialEndsAt({ userId, vertical: VerticalEnum.ACCOMMODATION })).toEqual(
            new Date(now.getTime() + 15 * day)
        );
    });
});
