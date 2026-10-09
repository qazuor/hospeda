import type { BillingDeadlineValues } from '@repo/schemas';
import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { subscriptionModel } from '../../src/models/subscription/subscription.model.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import { billingDeadlineVersions } from '../../src/schemas/vertical/billing-deadline-version.dbschema.ts';
import { billingOptions } from '../../src/schemas/vertical/billing-option.dbschema.ts';
import { manualPayments } from '../../src/schemas/vertical/manual-payment.dbschema.ts';
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
} satisfies BillingDeadlineValues;

/** Seeds a user + plan + version + option chain for one vertical. */
async function seedChain(
    tx: DrizzleClient,
    options: { readonly userId?: string; readonly vertical: string }
) {
    await tx
        .insert(billingDeadlineVersions)
        .values({ version: 1, values: billingDeadlineVersion1Values })
        .onConflictDoNothing();
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
                authorizationWindowDeadlineVersion: 1,
                authorizationWindowEndsAt: new Date('2026-10-11T20:00:00.000Z'),
                tx
            });

            const beforeLink = await subscriptionModel.findLiveCommitment({
                userId: chain.userId,
                vertical: 'accommodation',
                tx
            });
            expect(beforeLink?.subscription.id).toBe(pending.subscription.id);
            expect(beforeLink?.subscription.status).toBe('PENDING_AUTHORIZATION');
            // TEST:B3:10 (base: versión y vencimiento guardados al abrir la ventana)
            expect(beforeLink?.subscription.authorizationWindowDeadlineVersion).toBe(1);
            expect(beforeLink?.subscription.authorizationWindowEndsAt).toEqual(
                new Date('2026-10-11T20:00:00.000Z')
            );
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
                    authorizationWindowDeadlineVersion: 1,
                    authorizationWindowEndsAt: new Date('2026-10-11T20:00:00.000Z'),
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
                authorizationWindowDeadlineVersion: 1,
                authorizationWindowEndsAt: new Date('2026-10-11T20:00:00.000Z'),
                tx
            });
            const gastronomyRow = await subscriptionModel.createPendingAuthorization({
                userId: accommodation.userId,
                vertical: 'gastronomy',
                planVersionId: gastronomy.planVersionId,
                billingOptionId: gastronomy.billingOptionId,
                authorizationWindowDeadlineVersion: 1,
                authorizationWindowEndsAt: new Date('2026-10-11T20:00:00.000Z'),
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

// TEST:B3:10 (base: versión y vencimiento guardados al abrir la ventana)
describe('stored authorization window model operations', () => {
    it('lists only pending principal rows due at the supplied instant, including equality', async () => {
        await withTestTransaction(async (tx) => {
            const now = new Date('2026-10-11T20:00:00.000Z');
            const dueChain = await seedChain(tx, { vertical: 'accommodation' });
            const due = await subscriptionModel.createPendingAuthorization({
                ...dueChain,
                vertical: 'accommodation',
                authorizationWindowDeadlineVersion: 1,
                authorizationWindowEndsAt: now,
                tx
            });
            await subscriptionModel.recordAuthorizationResult({
                idempotencyKey: due.idempotencyKey,
                subscriptionId: due.subscription.id,
                provider: 'MERCADO_PAGO',
                providerId: `due-${crypto.randomUUID()}`,
                result: {
                    authorizationId: 'due',
                    applied: true,
                    checkoutUrl: 'https://mp.test/due'
                },
                completedAt: now,
                tx
            });
            const futureChain = await seedChain(tx, { vertical: 'accommodation' });
            await subscriptionModel.createPendingAuthorization({
                ...futureChain,
                vertical: 'accommodation',
                authorizationWindowDeadlineVersion: 1,
                authorizationWindowEndsAt: new Date(now.getTime() + 1),
                tx
            });
            const nullChain = await seedChain(tx, { vertical: 'accommodation' });
            await tx.insert(subscriptions).values({
                ...nullChain,
                vertical: 'accommodation',
                class: 'PRINCIPAL',
                status: 'PENDING_AUTHORIZATION',
                paymentMethod: 'CARD'
            });
            const inactiveChain = await seedChain(tx, { vertical: 'accommodation' });
            await tx.insert(subscriptions).values({
                ...inactiveChain,
                vertical: 'accommodation',
                class: 'PRINCIPAL',
                status: 'ABANDONED',
                paymentMethod: 'CARD',
                authorizationWindowDeadlineVersion: 1,
                authorizationWindowEndsAt: now
            });
            const complementChain = await seedChain(tx, { vertical: 'accommodation' });
            await tx.insert(subscriptions).values({
                ...complementChain,
                vertical: 'accommodation',
                class: 'COMPLEMENTO',
                status: 'PENDING_AUTHORIZATION',
                paymentMethod: 'CARD',
                authorizationWindowDeadlineVersion: 1,
                authorizationWindowEndsAt: now
            });
            const rows = await subscriptionModel.findExpiredAuthorizationWindows({
                now,
                limit: 10,
                tx
            });
            expect(rows.map((row) => row.subscription.id)).toEqual([due.subscription.id]);
            expect(rows[0]?.providerLink?.subscriptionId).toBe(due.subscription.id);
            expect(
                await subscriptionModel.findExpiredAuthorizationWindows({ now, limit: 0, tx })
            ).toEqual([]);
        });
    });

    it('updates only pending rows; S3 closes an awaiting manual payment in the same transaction', async () => {
        await withTestTransaction(async (tx) => {
            const now = new Date('2026-10-11T20:00:00.000Z');
            const cardChain = await seedChain(tx, { vertical: 'accommodation' });
            const card = await subscriptionModel.createPendingAuthorization({
                ...cardChain,
                vertical: 'accommodation',
                authorizationWindowDeadlineVersion: 1,
                authorizationWindowEndsAt: now,
                tx
            });
            const [cardPayment] = await tx
                .insert(manualPayments)
                .values({
                    subscriptionId: card.subscription.id,
                    periodStart: now,
                    status: 'AWAITING'
                })
                .returning();
            expect(
                await subscriptionModel.activatePendingAuthorization({
                    subscriptionId: card.subscription.id,
                    now,
                    tx
                })
            ).toBe(true);
            expect(
                await subscriptionModel.activatePendingAuthorization({
                    subscriptionId: card.subscription.id,
                    now,
                    tx
                })
            ).toBe(false);
            expect(
                await subscriptionModel.abandonPendingAuthorization({
                    subscriptionId: card.subscription.id,
                    now,
                    tx
                })
            ).toBe(false);
            const [active] = await tx
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, card.subscription.id));
            expect(active?.status).toBe('ACTIVE');
            expect(active?.updatedAt).toEqual(now);
            const [untouched] = await tx
                .select()
                .from(manualPayments)
                .where(eq(manualPayments.id, cardPayment?.id ?? ''));
            expect(untouched?.status).toBe('AWAITING');

            const manualChain = await seedChain(tx, { vertical: 'accommodation' });
            const manual = await subscriptionModel.createPendingAuthorization({
                ...manualChain,
                vertical: 'accommodation',
                authorizationWindowDeadlineVersion: 1,
                authorizationWindowEndsAt: now,
                tx
            });
            await tx
                .update(subscriptions)
                .set({ paymentMethod: 'MANUAL' })
                .where(eq(subscriptions.id, manual.subscription.id));
            const [manualPayment] = await tx
                .insert(manualPayments)
                .values({
                    subscriptionId: manual.subscription.id,
                    periodStart: now,
                    status: 'AWAITING'
                })
                .returning();
            expect(
                await subscriptionModel.abandonPendingAuthorization({
                    subscriptionId: manual.subscription.id,
                    now,
                    tx
                })
            ).toBe(true);
            expect(
                await subscriptionModel.abandonPendingAuthorization({
                    subscriptionId: manual.subscription.id,
                    now,
                    tx
                })
            ).toBe(false);
            const [abandoned] = await tx
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, manual.subscription.id));
            const [closed] = await tx
                .select()
                .from(manualPayments)
                .where(eq(manualPayments.id, manualPayment?.id ?? ''));
            expect(abandoned?.status).toBe('ABANDONED');
            expect(abandoned?.updatedAt).toEqual(now);
            expect(closed?.status).toBe('DECLARED_UNPAID');
            expect(closed?.updatedAt).toEqual(now);
        });
    });
});
