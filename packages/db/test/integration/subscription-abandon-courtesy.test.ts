import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { subscriptionModel } from '../../src/models/subscription/subscription.model.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import { billingDeadlineVersions } from '../../src/schemas/vertical/billing-deadline-version.dbschema.ts';
import { billingOptions } from '../../src/schemas/vertical/billing-option.dbschema.ts';
import { courtesyGrants } from '../../src/schemas/vertical/courtesy-grant.dbschema.ts';
import { plans, planVersions } from '../../src/schemas/vertical/plan-catalog.dbschema.ts';
import { subscriptions } from '../../src/schemas/vertical/subscription.dbschema.ts';
import { closeTestPool, type DrizzleClient, testData, withTestTransaction } from './helpers.ts';

afterAll(closeTestPool);

const billingDeadlineVersion1Values = {
    '10': { cardHours: 72, manualDays: 7 },
    '11': { noticeDays: 60, contactDays: [30, 7] },
    '12': { noticeDays: 60, contactDays: [30, 7] },
    '13': { daysBefore: [5, 1] },
    '14': { daysBefore: 7 },
    '15': { hoursRemaining: 24 },
    '16': { days: 7 },
    '17': { days: 7 },
    '18': { days: 180 },
    '19': { minutes: 60 }
};

async function seedChain(
    tx: DrizzleClient,
    options: { readonly userId?: string; readonly vertical: string }
) {
    await tx
        .insert(billingDeadlineVersions)
        .values({ version: 1, values: billingDeadlineVersion1Values })
        .onConflictDoNothing();
    const [user] = options.userId
        ? await tx.select().from(users).where(eq(users.id, options.userId))
        : await tx.insert(users).values(testData.user()).returning();
    if (!user) throw new Error('Expected a user');
    const [plan] = await tx
        .insert(plans)
        .values({
            vertical: options.vertical,
            slug: `b3-${crypto.randomUUID()}`,
            name: 'Basic'
        })
        .returning();
    if (!plan) throw new Error('Expected a plan');
    const [version] = await tx
        .insert(planVersions)
        .values({
            planId: plan.id,
            vertical: options.vertical,
            rank: Math.floor(Math.random() * 100_000_000) + 1000,
            sellable: true,
            current: true,
            trialDays: 0,
            allowsPause: false
        })
        .returning();
    if (!version) throw new Error('Expected a plan version');
    const [option] = await tx
        .insert(billingOptions)
        .values({
            planVersionId: version.id,
            cycle: 'monthly',
            amount: 1000,
            currency: 'ARS'
        })
        .returning();
    if (!option) throw new Error('Expected a billing option');
    return { userId: user.id, planVersionId: version.id, billingOptionId: option.id };
}

// TEST:B3:12 (base: el cierre en la persistencia de S3)
describe('TEST:B3:12 deferred courtesy closure in S3 persistence', () => {
    const now = new Date('2026-10-11T20:00:00.000Z');

    async function seedSuccession(
        tx: DrizzleClient,
        status: 'PENDING_AUTHORIZATION' | 'ABANDONED' = 'PENDING_AUTHORIZATION'
    ) {
        const chain = await seedChain(tx, { vertical: 'accommodation' });
        const [predecessor] = await tx
            .insert(subscriptions)
            .values({
                ...chain,
                vertical: 'accommodation',
                class: 'PRINCIPAL',
                status: 'CANCELLED',
                paymentMethod: 'CARD'
            })
            .returning();
        if (!predecessor) throw new Error('Missing predecessor');
        const [successor] = await tx
            .insert(subscriptions)
            .values({
                ...chain,
                vertical: 'accommodation',
                class: 'PRINCIPAL',
                status,
                paymentMethod: 'CARD',
                authorizationWindowDeadlineVersion: 1,
                authorizationWindowEndsAt: new Date(now.getTime() - 1)
            })
            .returning();
        if (!successor) throw new Error('Missing successor');
        await tx
            .update(subscriptions)
            .set({ succeededById: successor.id })
            .where(eq(subscriptions.id, predecessor.id));
        return { predecessor, successor, userId: chain.userId };
    }

    async function grant(
        tx: DrizzleClient,
        subscriptionId: string,
        userId: string,
        balanceMonths: number | null,
        closedAt: Date | null = null
    ) {
        const [row] = await tx
            .insert(courtesyGrants)
            .values({
                beneficiaryUserId: userId,
                grantedBy: userId,
                subscriptionId,
                months: 6,
                startsAt: now,
                endsAt: new Date('2027-10-11T20:00:00.000Z'),
                reason: 'TEST:B3:12',
                balanceMonths,
                balanceClosedAt: closedAt,
                closeReason: closedAt ? 'DESTINO_DE_PLAN_NO_MENSUAL' : null
            })
            .returning();
        if (!row) throw new Error('Missing grant');
        return row;
    }

    it('closes only the deferred balance of the predecessor with the exact supplied instant', async () => {
        await withTestTransaction(async (tx) => {
            const { predecessor, successor, userId } = await seedSuccession(tx);
            const before = await grant(tx, predecessor.id, userId, 3);
            const result = await subscriptionModel.abandonPendingAuthorization({
                subscriptionId: successor.id,
                now,
                tx
            });
            const [after] = await tx
                .select()
                .from(courtesyGrants)
                .where(eq(courtesyGrants.id, before.id));
            expect(result).toEqual({ wrote: true, closedCourtesyMonths: 3 });
            expect(after).toMatchObject({
                balanceMonths: 3,
                closeReason: 'VENTANA_DE_AUTORIZACION_VENCIDA'
            });
            expect(after?.balanceClosedAt).toEqual(now);
        });
    });

    it('writes no courtesy rows when none exist', async () => {
        await withTestTransaction(async (tx) => {
            const { predecessor, successor } = await seedSuccession(tx);
            expect(
                await subscriptionModel.abandonPendingAuthorization({
                    subscriptionId: successor.id,
                    now,
                    tx
                })
            ).toEqual({ wrote: true, closedCourtesyMonths: null });
            expect(
                await tx
                    .select()
                    .from(courtesyGrants)
                    .where(eq(courtesyGrants.subscriptionId, predecessor.id))
            ).toHaveLength(0);
        });
    });

    it('leaves a current grant and an already closed grant byte for byte intact', async () => {
        await withTestTransaction(async (tx) => {
            const { predecessor, successor, userId } = await seedSuccession(tx);
            const current = await grant(tx, predecessor.id, userId, null);
            const closed = await grant(
                tx,
                predecessor.id,
                userId,
                2,
                new Date('2026-10-01T00:00:00.000Z')
            );
            expect(
                await subscriptionModel.abandonPendingAuthorization({
                    subscriptionId: successor.id,
                    now,
                    tx
                })
            ).toEqual({ wrote: true, closedCourtesyMonths: null });
            const [currentAfter] = await tx
                .select()
                .from(courtesyGrants)
                .where(eq(courtesyGrants.id, current.id));
            const [closedAfter] = await tx
                .select()
                .from(courtesyGrants)
                .where(eq(courtesyGrants.id, closed.id));
            expect(currentAfter).toEqual(current);
            expect(closedAfter).toEqual(closed);
        });
    });

    it('does not close another predecessor’s deferred grant for the same user', async () => {
        await withTestTransaction(async (tx) => {
            const { successor, userId } = await seedSuccession(tx);
            const chain = await seedChain(tx, { vertical: 'accommodation', userId });
            const [other] = await tx
                .insert(subscriptions)
                .values({
                    ...chain,
                    vertical: 'accommodation',
                    class: 'PRINCIPAL',
                    status: 'CANCELLED',
                    paymentMethod: 'CARD'
                })
                .returning();
            if (!other) throw new Error('Missing other predecessor');
            const before = await grant(tx, other.id, userId, 4);
            await subscriptionModel.abandonPendingAuthorization({
                subscriptionId: successor.id,
                now,
                tx
            });
            const [after] = await tx
                .select()
                .from(courtesyGrants)
                .where(eq(courtesyGrants.id, before.id));
            expect(after).toEqual(before);
        });
    });

    it('does not close the balance when the successor is no longer pending', async () => {
        await withTestTransaction(async (tx) => {
            const { predecessor, successor, userId } = await seedSuccession(tx, 'ABANDONED');
            const before = await grant(tx, predecessor.id, userId, 3);
            expect(
                await subscriptionModel.abandonPendingAuthorization({
                    subscriptionId: successor.id,
                    now,
                    tx
                })
            ).toEqual({ wrote: false, closedCourtesyMonths: null });
            const [after] = await tx
                .select()
                .from(courtesyGrants)
                .where(eq(courtesyGrants.id, before.id));
            expect(after).toEqual(before);
        });
    });
});
