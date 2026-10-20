import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { touristVipModel } from '../../src/models/subscription/tourist-vip.model.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import { billingOptions } from '../../src/schemas/vertical/billing-option.dbschema.ts';
import { plans, planVersions } from '../../src/schemas/vertical/plan-catalog.dbschema.ts';
import { subscriptions } from '../../src/schemas/vertical/subscription.dbschema.ts';
import { closeTestPool, type DrizzleClient, testData, withTestTransaction } from './helpers.ts';

afterAll(closeTestPool);

async function seed(tx: DrizzleClient) {
    const [user] = await tx.insert(users).values(testData.user()).returning();
    if (!user) throw new Error('Expected a user');
    async function chain(vertical: 'tourist' | 'accommodation') {
        const [plan] = await tx
            .insert(plans)
            .values({ vertical, slug: `vip-${crypto.randomUUID()}`, name: 'VIP' })
            .returning();
        if (!plan) throw new Error('Expected a plan');
        const [version] = await tx
            .insert(planVersions)
            .values({
                planId: plan.id,
                vertical,
                rank: Math.floor(Math.random() * 100000000) + 1000,
                sellable: true,
                current: true,
                trialDays: 0,
                allowsPause: false
            })
            .returning();
        if (!version) throw new Error('Expected a version');
        const [option] = await tx
            .insert(billingOptions)
            .values({
                planVersionId: version.id,
                cycle: 'monthly',
                amount: 1000,
                currency: 'ARS'
            })
            .returning();
        if (!option) throw new Error('Expected an option');
        return { versionId: version.id, optionId: option.id };
    }
    return { userId: user.id, vip: await chain('tourist'), title: await chain('accommodation') };
}

async function row(
    tx: DrizzleClient,
    userId: string,
    vertical: 'tourist' | 'accommodation',
    versionId: string,
    optionId: string,
    status: string
) {
    const [created] = await tx
        .insert(subscriptions)
        .values({
            userId,
            vertical,
            planVersionId: versionId,
            billingOptionId: optionId,
            paymentMethod: 'CARD',
            status: status as 'ACTIVE',
            class: 'PRINCIPAL'
        })
        .returning();
    if (!created) throw new Error('Expected a subscription');
    return created;
}

describe('TouristVipModel (TEST:B3:28, TEST:B3:37, TEST:B3:29)', () => {
    it('finds only emitting title rows for other verticals and cancellable Tourist rows', async () => {
        await withTestTransaction(async (tx) => {
            const data = await seed(tx);
            const activeTitle = await row(
                tx,
                data.userId,
                'accommodation',
                data.title.versionId,
                data.title.optionId,
                'ACTIVE'
            );
            const [pendingTitleUser] = await tx.insert(users).values(testData.user()).returning();
            const [abandonedTitleUser] = await tx.insert(users).values(testData.user()).returning();
            if (!pendingTitleUser || !abandonedTitleUser)
                throw new Error('Expected title edge users');
            await row(
                tx,
                pendingTitleUser.id,
                'accommodation',
                data.title.versionId,
                data.title.optionId,
                'PENDING_AUTHORIZATION'
            );
            await row(
                tx,
                abandonedTitleUser.id,
                'accommodation',
                data.title.versionId,
                data.title.optionId,
                'ABANDONED'
            );
            const [other] = await tx.insert(users).values(testData.user()).returning();
            if (!other) throw new Error('Expected another user');
            await row(
                tx,
                other.id,
                'accommodation',
                data.title.versionId,
                data.title.optionId,
                'ACTIVE'
            );
            const vip = await row(
                tx,
                data.userId,
                'tourist',
                data.vip.versionId,
                data.vip.optionId,
                'ACTIVE'
            );
            await row(
                tx,
                pendingTitleUser.id,
                'tourist',
                data.vip.versionId,
                data.vip.optionId,
                'ACTIVE'
            );
            const [pendingVipUser] = await tx.insert(users).values(testData.user()).returning();
            const [abandonedVipUser] = await tx.insert(users).values(testData.user()).returning();
            const [cancelledVipUser] = await tx.insert(users).values(testData.user()).returning();
            if (!pendingVipUser || !abandonedVipUser || !cancelledVipUser)
                throw new Error('Expected VIP edge users');
            const pendingVip = await row(
                tx,
                pendingVipUser.id,
                'tourist',
                data.vip.versionId,
                data.vip.optionId,
                'PENDING_AUTHORIZATION'
            );
            const abandonedVip = await row(
                tx,
                abandonedVipUser.id,
                'tourist',
                data.vip.versionId,
                data.vip.optionId,
                'ABANDONED'
            );
            const cancelledVip = await row(
                tx,
                cancelledVipUser.id,
                'tourist',
                data.vip.versionId,
                data.vip.optionId,
                'CANCELLED'
            );

            expect(await touristVipModel.findTitleRows({ userId: data.userId, tx })).toEqual([
                expect.objectContaining({
                    id: activeTitle.id,
                    vertical: 'accommodation',
                    planVersionId: data.title.versionId
                })
            ]);
            expect(
                await touristVipModel.findTitleRows({ userId: pendingTitleUser.id, tx })
            ).toEqual([]);
            const cancellable = await touristVipModel.findCancellableRows({
                userId: data.userId,
                tx
            });
            expect(cancellable.map((item) => item.subscription.id)).toEqual([vip.id]);
            expect(cancellable[0]?.providerLink).toBeNull();
            expect(
                await touristVipModel.findUserIdsWithCancellableVip({ limit: 10, tx })
            ).toContain(data.userId);
            expect(
                await touristVipModel.closeCancelledVip({
                    subscriptionId: vip.id,
                    now: new Date('2026-10-10T00:00:00Z'),
                    tx
                })
            ).toBe(true);
            expect(
                await touristVipModel.closeCancelledVip({
                    subscriptionId: cancelledVip.id,
                    now: new Date(),
                    tx
                })
            ).toBe(false);
            expect(
                await touristVipModel.closeCancelledVip({
                    subscriptionId: abandonedVip.id,
                    now: new Date(),
                    tx
                })
            ).toBe(false);
            expect(
                await touristVipModel.closeCancelledVip({
                    subscriptionId: pendingVip.id,
                    now: new Date(),
                    tx
                })
            ).toBe(false);
            const [closed] = await tx
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, vip.id));
            expect(closed?.status).toBe('CANCELLED');
            expect(closed?.serviceEndsAt).toEqual(new Date('2026-10-10T00:00:00Z'));
            expect(
                (await touristVipModel.findUserIdsWithCancellableVip({ limit: 10, tx })).some(
                    (id) => id === data.userId
                )
            ).toBe(false);
        });
    });

    it('does not return users with a cancellable VIP but no emitting title', async () => {
        await withTestTransaction(async (tx) => {
            const data = await seed(tx);
            await row(tx, data.userId, 'tourist', data.vip.versionId, data.vip.optionId, 'ACTIVE');
            await row(
                tx,
                data.userId,
                'accommodation',
                data.title.versionId,
                data.title.optionId,
                'PENDING_AUTHORIZATION'
            );
            expect(
                await touristVipModel.findUserIdsWithCancellableVip({ limit: 10, tx })
            ).not.toContain(data.userId);
        });
    });

    it('does not select a pending Tourist VIP as cancellable', async () => {
        await withTestTransaction(async (tx) => {
            const data = await seed(tx);
            await row(
                tx,
                data.userId,
                'tourist',
                data.vip.versionId,
                data.vip.optionId,
                'PENDING_AUTHORIZATION'
            );
            expect(await touristVipModel.findCancellableRows({ userId: data.userId, tx })).toEqual(
                []
            );
        });
    });
});
