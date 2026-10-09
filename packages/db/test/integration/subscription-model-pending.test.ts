import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { subscriptionModel } from '../../src/models/subscription/subscription.model.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import { billingOptions } from '../../src/schemas/vertical/billing-option.dbschema.ts';
import { plans, planVersions } from '../../src/schemas/vertical/plan-catalog.dbschema.ts';
import { subscriptions } from '../../src/schemas/vertical/subscription.dbschema.ts';
import { closeTestPool, type DrizzleClient, testData, withTestTransaction } from './helpers.ts';

afterAll(closeTestPool);

/** Seeds a user + plan + version + option chain for one vertical. */
async function seedChain(
    tx: DrizzleClient,
    options: { readonly userId?: string; readonly vertical: string }
) {
    const [user] = await tx
        .insert(users)
        .values({ ...testData.user(), id: options.userId } as typeof users.$inferInsert)
        .returning();
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

describe('findLiveCommitment (AC:B3:6)', () => {
    it('returns the live pending row with its key and no provider link, then with the link', async () => {
        await withTestTransaction(async (tx) => {
            const chain = await seedChain(tx, { vertical: 'accommodation' });
            const pending = await subscriptionModel.createPendingAuthorization({
                userId: chain.userId,
                vertical: 'accommodation',
                planVersionId: chain.planVersionId,
                billingOptionId: chain.billingOptionId,
                tx
            });

            const beforeLink = await subscriptionModel.findLiveCommitment({
                userId: chain.userId,
                vertical: 'accommodation',
                tx
            });
            expect(beforeLink?.subscription.id).toBe(pending.subscription.id);
            expect(beforeLink?.subscription.status).toBe('PENDING_AUTHORIZATION');
            expect(beforeLink?.idempotencyKey?.key).toBe(pending.idempotencyKey);
            expect(beforeLink?.idempotencyKey?.operation).toBe('PREAPPROVAL_CREATE');
            expect(beforeLink?.providerLink).toBeNull();

            await subscriptionModel.recordAuthorizationResult({
                idempotencyKey: pending.idempotencyKey,
                subscriptionId: pending.subscription.id,
                provider: 'MERCADO_PAGO',
                providerId: `b3-live-${crypto.randomUUID()}`,
                result: {
                    authorizationId: 'b3-live',
                    applied: true,
                    checkoutUrl: 'https://x.test'
                },
                completedAt: new Date(),
                tx
            });

            const afterLink = await subscriptionModel.findLiveCommitment({
                userId: chain.userId,
                vertical: 'accommodation',
                tx
            });
            expect(afterLink?.providerLink?.subscriptionId).toBe(pending.subscription.id);
        });
    });

    it('returns the live row with a null key when the row has no idempotency key', async () => {
        await withTestTransaction(async (tx) => {
            const chain = await seedChain(tx, { vertical: 'accommodation' });
            // Inserted directly (not through createPendingAuthorization, which
            // always mints a key) so the read must tolerate a key-less row: the
            // left join yields null for the PREAPPROVAL_CREATE key.
            const [row] = await tx
                .insert(subscriptions)
                .values({
                    userId: chain.userId,
                    vertical: 'accommodation',
                    planVersionId: chain.planVersionId,
                    billingOptionId: chain.billingOptionId,
                    paymentMethod: 'CARD',
                    status: 'PENDING_AUTHORIZATION',
                    class: 'PRINCIPAL'
                })
                .returning();
            if (!row) throw new Error('Expected a subscription');

            const live = await subscriptionModel.findLiveCommitment({
                userId: chain.userId,
                vertical: 'accommodation',
                tx
            });
            expect(live?.subscription.id).toBe(row.id);
            expect(live?.idempotencyKey).toBeNull();
            expect(live?.providerLink).toBeNull();
        });
    });

    it('ignores a live row once it leaves the live statuses', async () => {
        for (const status of ['ABANDONED', 'CANCELLED', 'CHARGE_DECLINED'] as const) {
            await withTestTransaction(async (tx) => {
                const chain = await seedChain(tx, { vertical: 'accommodation' });
                const pending = await subscriptionModel.createPendingAuthorization({
                    userId: chain.userId,
                    vertical: 'accommodation',
                    planVersionId: chain.planVersionId,
                    billingOptionId: chain.billingOptionId,
                    tx
                });
                await tx
                    .update(subscriptions)
                    .set({ status })
                    .where(eq(subscriptions.id, pending.subscription.id));
                expect(
                    await subscriptionModel.findLiveCommitment({
                        userId: chain.userId,
                        vertical: 'accommodation',
                        tx
                    })
                ).toBeNull();
            });
        }
    });

    it('scopes by user and vertical, one live row each', async () => {
        await withTestTransaction(async (tx) => {
            const accommodation = await seedChain(tx, { vertical: 'accommodation' });
            const gastronomy = await seedChain(tx, { vertical: 'gastronomy' });
            const otherUser = await seedChain(tx, { vertical: 'accommodation' });
            const accommodationRow = await subscriptionModel.createPendingAuthorization({
                userId: accommodation.userId,
                vertical: 'accommodation',
                planVersionId: accommodation.planVersionId,
                billingOptionId: accommodation.billingOptionId,
                tx
            });
            const gastronomyRow = await subscriptionModel.createPendingAuthorization({
                userId: accommodation.userId,
                vertical: 'gastronomy',
                planVersionId: gastronomy.planVersionId,
                billingOptionId: gastronomy.billingOptionId,
                tx
            });

            expect(
                (
                    await subscriptionModel.findLiveCommitment({
                        userId: accommodation.userId,
                        vertical: 'accommodation',
                        tx
                    })
                )?.subscription.id
            ).toBe(accommodationRow.subscription.id);
            expect(
                (
                    await subscriptionModel.findLiveCommitment({
                        userId: accommodation.userId,
                        vertical: 'gastronomy',
                        tx
                    })
                )?.subscription.id
            ).toBe(gastronomyRow.subscription.id);
            expect(
                await subscriptionModel.findLiveCommitment({
                    userId: otherUser.userId,
                    vertical: 'accommodation',
                    tx
                })
            ).toBeNull();
        });
    });
});
