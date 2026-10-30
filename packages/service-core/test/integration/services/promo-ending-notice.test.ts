import { eq, subscriptionScheduledChanges, subscriptions } from '@repo/db';
import { afterAll, describe, expect, it } from 'vitest';
import { applyPromoEndingNotice } from '../../../src/services/billing/promo/promo-ending-notice';
import { sendPromoEndingNotices } from '../../../src/services/billing/promo/send-promo-ending-notices.service';
import { closeServiceTestPool, withServiceTestTransaction } from './helpers';
import {
    addPromoToSubscription,
    insertDeadlineVersion,
    promoEndingInstant,
    readPromoEndingOutbox,
    seedPromoEndingCase
} from './support/promo-ending-fixtures';

afterAll(closeServiceTestPool);
const clock = (day: string) => ({ now: () => promoEndingInstant(day) });

/** All deadline versions and domain rows are inserted inside the rollback transaction. */
describe('TEST:B9b:5 AC:B9b:5 the promo ending notice is enqueued 7 days before the last discounted charge', () => {
    it('(a) enqueues once at seven local days, skips eight, and deduplicates moved charge dates', async () => {
        await withServiceTestTransaction(async (tx) => {
            await insertDeadlineVersion(tx, {
                version: 801001,
                createdAt: promoEndingInstant('2098-01-01'),
                daysBefore: 7
            });
            const seeded = await seedPromoEndingCase(tx, {
                nextChargeAt: promoEndingInstant('2099-06-09'),
                redeemedAt: promoEndingInstant('2098-02-01'),
                listAmountMinor: 100000
            });
            expect(
                (
                    await applyPromoEndingNotice({
                        tx,
                        redemptionId: seeded.redemptionId,
                        now: promoEndingInstant('2099-06-01')
                    })
                ).outcome
            ).toBe('NOT_DUE');
            expect(
                (
                    await applyPromoEndingNotice({
                        tx,
                        redemptionId: seeded.redemptionId,
                        now: promoEndingInstant('2099-06-02')
                    })
                ).outcome
            ).toBe('ENQUEUED');
            expect(
                (
                    await applyPromoEndingNotice({
                        tx,
                        redemptionId: seeded.redemptionId,
                        now: promoEndingInstant('2099-06-02')
                    })
                ).outcome
            ).toBe('ALREADY_ENQUEUED');
            const rows = await readPromoEndingOutbox(tx, seeded.subscriptionId);
            expect(rows).toHaveLength(1);
            expect(rows[0]).toMatchObject({
                recipientUserId: seeded.userId,
                recipientEmail: seeded.email
            });
            expect(rows[0]?.payload).toEqual({
                subscriptionId: seeded.subscriptionId,
                redemptionId: seeded.redemptionId,
                vertical: 'accommodation',
                planName: 'Coverage plan',
                lastDiscountedChargeDate: '2099-06-09',
                amountAfterMinor: 100000,
                currency: 'ARS',
                daysBefore: 7,
                deadlinesVersion: 801001
            });
            await tx
                .update(subscriptions)
                .set({ nextChargeAt: promoEndingInstant('2099-06-10') })
                .where(eq(subscriptions.id, seeded.subscriptionId));
            expect(
                (
                    await applyPromoEndingNotice({
                        tx,
                        redemptionId: seeded.redemptionId,
                        now: promoEndingInstant('2099-06-03')
                    })
                ).outcome
            ).toBe('ENQUEUED');
            expect(await readPromoEndingOutbox(tx, seeded.subscriptionId)).toHaveLength(2);
        });
    });

    it('(b) composes the anchored list amount with only the still-live promo discounts', async () => {
        await withServiceTestTransaction(async (tx) => {
            await insertDeadlineVersion(tx, {
                version: 801002,
                createdAt: promoEndingInstant('2098-01-01'),
                daysBefore: 7
            });
            const withLive = await seedPromoEndingCase(tx, {
                nextChargeAt: promoEndingInstant('2099-06-09'),
                redeemedAt: promoEndingInstant('2098-02-01'),
                listAmountMinor: 100000,
                discountKind: 'FIXED',
                value: 10000
            });
            await addPromoToSubscription(tx, {
                ...withLive,
                value: 20,
                discountKind: 'PERCENTAGE',
                redeemedAt: promoEndingInstant('2098-02-02')
            });
            const onlyEnding = await seedPromoEndingCase(tx, {
                nextChargeAt: promoEndingInstant('2099-06-09'),
                redeemedAt: promoEndingInstant('2098-02-01'),
                listAmountMinor: 100000,
                discountKind: 'FIXED',
                value: 10000
            });
            await applyPromoEndingNotice({
                tx,
                redemptionId: withLive.redemptionId,
                now: promoEndingInstant('2099-06-02')
            });
            await applyPromoEndingNotice({
                tx,
                redemptionId: onlyEnding.redemptionId,
                now: promoEndingInstant('2099-06-02')
            });
            const withLiveRows = await readPromoEndingOutbox(tx, withLive.subscriptionId);
            const onlyEndingRows = await readPromoEndingOutbox(tx, onlyEnding.subscriptionId);
            expect((withLiveRows[0]?.payload as Record<string, unknown>).amountAfterMinor).toBe(
                80000
            );
            expect((onlyEndingRows[0]?.payload as Record<string, unknown>).amountAfterMinor).toBe(
                100000
            );
        });
    });

    it('(c) uses the PLAZO:14 version published before redemption, even after a newer version', async () => {
        await withServiceTestTransaction(async (tx) => {
            await insertDeadlineVersion(tx, {
                version: 801003,
                createdAt: promoEndingInstant('2098-01-01'),
                daysBefore: 10
            });
            await insertDeadlineVersion(tx, {
                version: 801004,
                createdAt: promoEndingInstant('2098-03-01'),
                daysBefore: 3
            });
            const seeded = await seedPromoEndingCase(tx, {
                nextChargeAt: promoEndingInstant('2099-07-01'),
                redeemedAt: promoEndingInstant('2098-02-01')
            });
            const result = await applyPromoEndingNotice({
                tx,
                redemptionId: seeded.redemptionId,
                now: promoEndingInstant('2099-06-21')
            });
            expect(result.outcome).toBe('ENQUEUED');
            expect(
                (await readPromoEndingOutbox(tx, seeded.subscriptionId))[0]?.payload
            ).toMatchObject({ daysBefore: 10, deadlinesVersion: 801003 });
        });
    });

    it('(d) skips first-charge, forever, two remaining charges, ineligible subscriptions, scheduled changes and past charges', async () => {
        await withServiceTestTransaction(async (tx) => {
            await insertDeadlineVersion(tx, {
                version: 801005,
                createdAt: promoEndingInstant('2098-01-01'),
                daysBefore: 7
            });
            const cases = [
                { durationKind: 'FIRST_CHARGE' as const },
                { durationKind: 'FOREVER' as const, remainingCharges: null },
                { remainingCharges: 2 },
                { status: 'PAUSED' },
                { status: 'GRACE_PERIOD' },
                { class: 'COMPLEMENTO' as const },
                { paymentMethod: 'MANUAL' as const },
                { nextChargeAt: promoEndingInstant('2099-05-31') }
            ];
            for (const item of cases) {
                const seeded = await seedPromoEndingCase(tx, {
                    nextChargeAt: promoEndingInstant('2099-06-09'),
                    redeemedAt: promoEndingInstant('2098-02-01'),
                    ...item
                });
                expect(
                    (
                        await applyPromoEndingNotice({
                            tx,
                            redemptionId: seeded.redemptionId,
                            now: promoEndingInstant('2099-06-02')
                        })
                    ).outcome
                ).toBe('SKIPPED');
                expect(await readPromoEndingOutbox(tx, seeded.subscriptionId)).toHaveLength(0);
            }
            const scheduled = await seedPromoEndingCase(tx, {
                nextChargeAt: promoEndingInstant('2099-06-09'),
                redeemedAt: promoEndingInstant('2098-02-01')
            });
            const [sub] = await tx
                .select({
                    planVersionId: subscriptions.planVersionId,
                    billingOptionId: subscriptions.billingOptionId
                })
                .from(subscriptions)
                .where(eq(subscriptions.id, scheduled.subscriptionId));
            await tx.insert(subscriptionScheduledChanges).values({
                subscriptionId: scheduled.subscriptionId,
                targetPlanVersionId: sub!.planVersionId!,
                targetBillingOptionId: sub!.billingOptionId!,
                effectiveAt: promoEndingInstant('2099-06-10')
            });
            expect(
                (
                    await applyPromoEndingNotice({
                        tx,
                        redemptionId: scheduled.redemptionId,
                        now: promoEndingInstant('2099-06-02')
                    })
                ).outcome
            ).toBe('SKIPPED');
            expect(await readPromoEndingOutbox(tx, scheduled.subscriptionId)).toHaveLength(0);
        });
    });

    it('(e) fails closed without a deadline version for that redemption and continues the batch', async () => {
        await withServiceTestTransaction(async (tx) => {
            await insertDeadlineVersion(tx, {
                version: 801006,
                createdAt: promoEndingInstant('2098-01-01'),
                daysBefore: 7
            });
            const missing = await seedPromoEndingCase(tx, {
                nextChargeAt: promoEndingInstant('2099-06-09'),
                redeemedAt: promoEndingInstant('2000-01-01')
            });
            const valid = await seedPromoEndingCase(tx, {
                nextChargeAt: promoEndingInstant('2099-06-09'),
                redeemedAt: promoEndingInstant('2098-02-01')
            });
            const summary = await sendPromoEndingNotices(
                { limit: 100, db: tx },
                { clock: clock('2099-06-02') }
            );
            expect(summary).toMatchObject({ failed: 1, enqueued: 1 });
            expect(await readPromoEndingOutbox(tx, missing.subscriptionId)).toHaveLength(0);
            expect(await readPromoEndingOutbox(tx, valid.subscriptionId)).toHaveLength(1);
        });
    });
});
