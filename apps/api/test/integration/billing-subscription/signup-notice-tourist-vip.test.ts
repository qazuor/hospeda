import { randomUUID } from 'node:crypto';
import {
    billingOptions,
    eq,
    getDb,
    plans,
    planVersionEntitlements,
    planVersionLimits,
    planVersions,
    sql,
    subscriptions,
    users
} from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { SignupNoticeResponseSchema } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { injectClock } from '../../../src/utils/clock';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';

const path = '/api/v1/protected/billing/subscriptions/signup-notice';
const now = new Date('2026-10-10T12:00:00.000Z');
const clock = { now: () => now };
const userIds: string[] = [];
const planIds: string[] = [];
const versionIds: string[] = [];
const optionIds: string[] = [];

async function createUser() {
    const [user] = await getDb()
        .insert(users)
        .values({
            email: `b13a-vip-notice-${randomUUID()}@example.test`,
            displayName: 'B13a Tourist VIP notice user',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!user) throw new Error('No Tourist VIP notice user');
    userIds.push(user.id);
    return user;
}

async function createOption(
    vertical: 'tourist' | 'accommodation' | 'venue' | 'experience',
    inheritsTouristVip: boolean
) {
    const [plan] = await getDb()
        .insert(plans)
        .values({
            vertical,
            slug: `b13a-vip-notice-${randomUUID()}`,
            name: 'Tourist VIP notice plan'
        })
        .returning();
    if (!plan) throw new Error('No Tourist VIP notice plan');
    planIds.push(plan.id);
    const [version] = await getDb()
        .insert(planVersions)
        .values({
            planId: plan.id,
            vertical,
            rank: Math.floor(Math.random() * 100000000) + 1000,
            sellable: true,
            current: true,
            trialDays: 0,
            allowsPause: false,
            inheritsTouristVip
        })
        .returning();
    if (!version) throw new Error('No Tourist VIP notice plan version');
    versionIds.push(version.id);
    const [option] = await getDb()
        .insert(billingOptions)
        .values({
            planVersionId: version.id,
            cycle: 'monthly',
            amount: 100000,
            currency: 'ARS'
        })
        .returning();
    if (!option) throw new Error('No Tourist VIP notice billing option');
    optionIds.push(option.id);
    return { option, version };
}

async function seedSubscription(input: {
    readonly userId: string;
    readonly vertical: 'accommodation' | 'experience';
    readonly versionId: string;
    readonly optionId: string;
    readonly status: 'ACTIVE' | 'SUSPENDED';
}) {
    const [row] = await getDb()
        .insert(subscriptions)
        .values({
            userId: input.userId,
            vertical: input.vertical,
            planVersionId: input.versionId,
            billingOptionId: input.optionId,
            paymentMethod: 'CARD',
            status: input.status,
            class: 'PRINCIPAL',
            graceStartedAt: input.status === 'SUSPENDED' ? now : null,
            graceEndsAt:
                input.status === 'SUSPENDED' ? new Date(now.getTime() + 7 * 86_400_000) : null
        })
        .returning();
    if (!row) throw new Error('No seeded subscription');
    return row;
}

async function readStatus(userId: string, billingOptionId: string) {
    return (await readNotice(userId, billingOptionId)).touristVip.status;
}

async function readNotice(userId: string, billingOptionId: string) {
    const response = await app.request(`${path}/${billingOptionId}`, {
        headers: {
            'content-type': 'application/json',
            'user-agent': 'vitest',
            'x-mock-actor-id': userId,
            'x-mock-actor-role': 'USER',
            'x-mock-actor-permissions': '[]'
        }
    });
    const body = await response.json();
    expect(response.status).toBe(200);
    const parsed = SignupNoticeResponseSchema.parse(body.data);
    expect(parsed.trial).toEqual({ status: 'NOT_RUNNING' });
    return parsed;
}

async function seedVip(input: {
    readonly userId: string;
    readonly optionId: string;
    readonly versionId: string;
    readonly status: 'ACTIVE' | 'GRACE_PERIOD' | 'CANCEL_SCHEDULED';
    readonly date: Date;
}) {
    const [vip] = await getDb()
        .insert(subscriptions)
        .values({
            userId: input.userId,
            vertical: 'tourist',
            planVersionId: input.versionId,
            billingOptionId: input.optionId,
            paymentMethod: 'CARD',
            status: input.status,
            class: 'PRINCIPAL',
            nextChargeAt: input.status === 'CANCEL_SCHEDULED' ? null : input.date,
            serviceEndsAt: input.status === 'CANCEL_SCHEDULED' ? input.date : null
        })
        .returning();
    if (!vip) throw new Error('No seeded Tourist VIP');
    return vip;
}

const app = initApp({
    clock,
    paymentProvider: new FakePaymentProvider({ clock, idNamespace: randomUUID() })
});

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
    injectClock({ clock });
});

afterEach(async () => {
    const db = getDb();
    const cleanupUsers = userIds.splice(0);
    const cleanupOptions = optionIds.splice(0);
    const cleanupVersions = versionIds.splice(0);
    const cleanupPlans = planIds.splice(0);
    await db.transaction(async (tx) => {
        for (const id of cleanupUsers) {
            await tx.delete(subscriptions).where(eq(subscriptions.userId, id));
        }
        for (const id of cleanupOptions) {
            await tx.delete(billingOptions).where(eq(billingOptions.id, id));
        }
        await tx.execute(sql`SET LOCAL session_replication_role = 'replica'`);
        for (const id of cleanupVersions) {
            await tx
                .delete(planVersionEntitlements)
                .where(eq(planVersionEntitlements.planVersionId, id));
            await tx.delete(planVersionLimits).where(eq(planVersionLimits.planVersionId, id));
            await tx.delete(planVersions).where(eq(planVersions.id, id));
        }
        for (const id of cleanupPlans) await tx.delete(plans).where(eq(plans.id, id));
        for (const id of cleanupUsers) await tx.delete(users).where(eq(users.id, id));
    });
});

afterAll(async () => testDb.teardown());

describe('TEST:1623:5 AC:B13a:16 signup Tourist VIP notice', () => {
    it('warns for an inherited owner plan and uses nextChargeAt as the paid-through date', async () => {
        const user = await createUser();
        const owner = await createOption('accommodation', true);
        const vip = await createOption('tourist', false);
        const paidUntil = new Date('2026-11-10T12:00:00.000Z');
        await seedVip({
            userId: user.id,
            optionId: vip.option.id,
            versionId: vip.version.id,
            status: 'ACTIVE',
            date: paidUntil
        });

        expect((await readNotice(user.id, owner.option.id)).touristVip).toEqual({
            status: 'CANCELLED_ON_ACTIVATION',
            paidUntil: paidUntil.toISOString()
        });
    });

    it('uses serviceEndsAt for a scheduled VIP cancellation', async () => {
        const user = await createUser();
        const owner = await createOption('experience', true);
        const vip = await createOption('tourist', false);
        const paidUntil = new Date('2026-11-11T12:00:00.000Z');
        await seedVip({
            userId: user.id,
            optionId: vip.option.id,
            versionId: vip.version.id,
            status: 'CANCEL_SCHEDULED',
            date: paidUntil
        });

        expect((await readNotice(user.id, owner.option.id)).touristVip).toEqual({
            status: 'CANCELLED_ON_ACTIVATION',
            paidUntil: paidUntil.toISOString()
        });
    });

    it('warns for a gastronomy option that inherits Tourist VIP', async () => {
        const user = await createUser();
        const owner = await createOption('venue', true);
        const vip = await createOption('tourist', false);
        await seedVip({
            userId: user.id,
            optionId: vip.option.id,
            versionId: vip.version.id,
            status: 'GRACE_PERIOD',
            date: now
        });

        expect((await readNotice(user.id, owner.option.id)).touristVip).toEqual({
            status: 'CANCELLED_ON_ACTIVATION',
            paidUntil: now.toISOString()
        });
    });

    it('does not warn without an applicable VIP or an inheriting option', async () => {
        const user = await createUser();
        const owner = await createOption('accommodation', true);
        const plain = await createOption('accommodation', false);
        const vip = await createOption('tourist', false);

        expect((await readNotice(user.id, owner.option.id)).touristVip).toEqual({
            status: 'NOT_AFFECTED'
        });
        await seedVip({
            userId: user.id,
            optionId: vip.option.id,
            versionId: vip.version.id,
            status: 'ACTIVE',
            date: now
        });
        expect((await readNotice(user.id, plain.option.id)).touristVip).toEqual({
            status: 'NOT_AFFECTED'
        });
        const other = await createUser();
        expect((await readNotice(other.id, owner.option.id)).touristVip).toEqual({
            status: 'NOT_AFFECTED'
        });
    });

    it('marks a suspended inheriting plan for cancellation on return (a)', async () => {
        const user = await createUser();
        const title = await createOption('accommodation', true);
        const vip = await createOption('tourist', false);
        await seedSubscription({
            userId: user.id,
            vertical: 'accommodation',
            versionId: title.version.id,
            optionId: title.option.id,
            status: 'SUSPENDED'
        });
        expect(await readStatus(user.id, vip.option.id)).toBe('CANCELLED_ON_RETURN');
    });

    it('does not mark a suspended plan whose pinned version does not inherit (b)', async () => {
        const user = await createUser();
        const title = await createOption('accommodation', false);
        const vip = await createOption('tourist', false);
        await seedSubscription({
            userId: user.id,
            vertical: 'accommodation',
            versionId: title.version.id,
            optionId: title.option.id,
            status: 'SUSPENDED'
        });
        expect(await readStatus(user.id, vip.option.id)).toBe('NOT_AFFECTED');
    });

    it('does not warn when another active title currently inherits VIP (c)', async () => {
        const user = await createUser();
        const suspendedTitle = await createOption('accommodation', true);
        const activeTitle = await createOption('experience', true);
        const vip = await createOption('tourist', false);
        await seedSubscription({
            userId: user.id,
            vertical: 'accommodation',
            versionId: suspendedTitle.version.id,
            optionId: suspendedTitle.option.id,
            status: 'SUSPENDED'
        });
        await seedSubscription({
            userId: user.id,
            vertical: 'experience',
            versionId: activeTitle.version.id,
            optionId: activeTitle.option.id,
            status: 'ACTIVE'
        });
        expect(await readStatus(user.id, vip.option.id)).toBe('NOT_AFFECTED');
    });

    it('does not read the return predicate for an accommodation option (d)', async () => {
        const user = await createUser();
        const title = await createOption('accommodation', true);
        const option = await createOption('accommodation', false);
        await seedSubscription({
            userId: user.id,
            vertical: 'accommodation',
            versionId: title.version.id,
            optionId: title.option.id,
            status: 'SUSPENDED'
        });
        expect(await readStatus(user.id, option.option.id)).toBe('NOT_AFFECTED');
    });

    it('does not use another user’s suspended plan (e)', async () => {
        const user = await createUser();
        const other = await createUser();
        const title = await createOption('accommodation', true);
        const vip = await createOption('tourist', false);
        await seedSubscription({
            userId: other.id,
            vertical: 'accommodation',
            versionId: title.version.id,
            optionId: title.option.id,
            status: 'SUSPENDED'
        });
        expect(await readStatus(user.id, vip.option.id)).toBe('NOT_AFFECTED');
    });
});
