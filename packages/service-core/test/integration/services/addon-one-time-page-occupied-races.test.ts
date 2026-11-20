/**
 * HOS-2179 T-6 follow-up: a retry over the same owner's expired page purchase. The purchase is
 * decided at the page expiry, without A3's margin: a declined payment is final on a binary-mode
 * page. Races around that decision end in one purchase and one page, and a payment the search
 * missed lands on the late-payment path. The fake lies by default.
 */
import { addonInstances, and, eq, idempotencyKeys, ne } from '@repo/db';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { confirmOneTimePagePayment } from '../../../src/services/billing/addon/addon-instance-a2-one-time-page';
import type * as occupiedModule from '../../../src/services/billing/addon/occupied-page-purchase';
import {
    PAYMENT_PAGE_OPERATION,
    paymentPageCheckoutUrlOf
} from '../../../src/services/billing/addon/one-time-payment-page';
import { purchaseAddon } from '../../../src/services/billing/addon/purchase-addon.service';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers';
import { retirePurchaseFixtures } from './support/addon-purchase-fixtures';
import {
    boughtPage,
    heldPagePayments,
    pageInstance,
    pageMarks,
    pageSetup,
    retirePageMarks
} from './support/one-time-page-fixtures';

/** Runs once after the real decision, before the service acts on it; null passes it through. */
const afterDecision: {
    hook: ((decision: string, occupantId: string) => Promise<void>) | null;
} = { hook: null };

vi.mock('../../../src/services/billing/addon/occupied-page-purchase', async (importOriginal) => {
    const original = await importOriginal<typeof occupiedModule>();
    return {
        ...original,
        decideOccupiedPagePurchase: async (
            ...args: Parameters<typeof original.decideOccupiedPagePurchase>
        ) => {
            const decision = await original.decideOccupiedPagePurchase(...args);
            await afterDecision.hook?.(decision, args[0].occupant.id);
            return decision;
        }
    };
});

const skip = !isServiceTestDbAvailable();

afterEach(async () => {
    afterDecision.hook = null;
    vi.restoreAllMocks();
    await retirePageMarks();
    await retirePurchaseFixtures();
});
afterAll(closeServiceTestPool);

async function boughtAndBack() {
    const s = await pageSetup();
    const bought = await boughtPage(s);
    if (!bought.instance.paymentPageExpiresAt) throw new Error('Page expiry missing');
    const expiry = bought.instance.paymentPageExpiresAt.getTime();
    const retry = () => ({ ...s.request, orderRequestId: crypto.randomUUID() });
    return {
        s,
        ...bought,
        retry,
        justExpired: new Date(expiry + 1)
    };
}

/** The purchases of the owner's identity that are not abandoned. */
async function liveInstances(s: Awaited<ReturnType<typeof pageSetup>>) {
    return getServiceTestDb()
        .select()
        .from(addonInstances)
        .where(
            and(
                eq(addonInstances.ownerId, s.request.ownerId),
                eq(addonInstances.productId, s.request.productId),
                ne(addonInstances.status, 'ABANDONED')
            )
        );
}

describe('HOS-2179 T-6 follow-up: a retry at the page expiry', () => {
    it.skipIf(skip)(
        'releases a purchase whose seen payment was declined without waiting for the margin',
        async () => {
            const { s, instance, paymentPageId, retry, justExpired } = await boughtAndBack();
            s.f.fake.payOnPage({ paymentPageId, outcome: 'rejected' });
            s.f.fake.takeDeliveries();
            s.f.advanceTo(justExpired);

            const answer = await purchaseAddon(retry(), s.f.ports);

            expect(answer).toMatchObject({ outcome: 'CREATED', checkoutUrl: expect.any(String) });
            if (answer.outcome !== 'CREATED') throw new Error(answer.outcome);
            expect(answer.instanceId).not.toBe(instance.id);
            expect((await pageInstance(instance.id)).status).toBe('ABANDONED');
        }
    );
});

describe('HOS-2179 T-6 follow-up: races and late payments around the release', () => {
    it.skipIf(skip)(
        'two tabs retrying over an expired page end with one new purchase and one page',
        async () => {
            const { s, instance, retry, justExpired } = await boughtAndBack();
            s.f.advanceTo(justExpired);
            const page = vi.spyOn(s.f.fake, 'requestOneTimePayment');

            const answers = await Promise.all([
                purchaseAddon(retry(), s.f.ports),
                purchaseAddon(retry(), s.f.ports)
            ]);

            expect((await pageInstance(instance.id)).status).toBe('ABANDONED');
            const live = await liveInstances(s);
            expect(live).toHaveLength(1);
            expect(live[0]?.paymentPageId).not.toBeNull();
            // Both tabs may reach the provider (it does not deduplicate pages by key); the one
            // that loses the record closes its page (§5.6), so one page takes payments.
            const created: readonly { paymentPageId: string }[] = await Promise.all(
                page.mock.results.map((r) => r.value)
            );
            expect(created.map((c) => c.paymentPageId)).toContain(live[0]?.paymentPageId);
            const now = s.f.ports.clock.now().getTime();
            const open = created.filter(({ paymentPageId }) => {
                const { expiresAt } = s.f.fake.paymentPage({ paymentPageId }).snapshot;
                return expiresAt === null || Date.parse(expiresAt) > now;
            });
            expect(open.map((c) => c.paymentPageId)).toEqual([live[0]?.paymentPageId]);
            // Neither tab fails: one created the purchase, and both carry the live page's link.
            const liveUrl = await paymentPageCheckoutUrlOf({ instanceId: live[0]?.id ?? '' });
            expect(liveUrl).toMatch(/^https:\/\//);
            const outcomes = answers.map((a) => a.outcome).sort();
            expect(outcomes[0]).toBe('CREATED');
            expect(['CREATED', 'EXISTING']).toContain(outcomes[1]);
            for (const answer of answers) {
                expect(answer).toMatchObject({ instanceId: live[0]?.id, checkoutUrl: liveUrl });
            }
        }
    );

    it.skipIf(skip)(
        'a payment the search missed lands in mark 23 with a held row once the purchase is released',
        async () => {
            const { s, instance, paymentPageId, retry, justExpired } = await boughtAndBack();
            const paid = s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
            s.f.fake.takeDeliveries();
            s.f.advanceTo(justExpired);
            // M4 and M6: the search misses it and its notice has not arrived.
            vi.spyOn(s.f.fake, 'searchCharges').mockResolvedValueOnce({ chargeIds: [] });
            const answer = await purchaseAddon(retry(), s.f.ports);
            expect(answer).toMatchObject({ outcome: 'CREATED' });
            expect((await pageInstance(instance.id)).status).toBe('ABANDONED');

            const late = await confirmOneTimePagePayment(
                { instanceId: instance.id, chargeId: paid.chargeId },
                s.ports
            );

            expect(late).toEqual({ outcome: 'LATE_PAYMENT' });
            expect(
                (await heldPagePayments(instance.id)).map((row) => [
                    row.payment.providerFactId,
                    row.reason
                ])
            ).toEqual([[paid.chargeId, 'ORDEN_PAGADA_SIN_INSTANCIA']]);
            expect(await pageMarks(instance.id)).toEqual([
                { reason: 'ORDEN_PAGADA_SIN_INSTANCIA', liftedAt: null }
            ]);
        }
    );

    it.skipIf(skip)(
        'answers ALREADY_ACTIVE when the purchase was activated between the decision and the open',
        async () => {
            const { s, instance, retry } = await boughtAndBack();
            afterDecision.hook = async (decision, occupantId) => {
                if (decision !== 'RESUME' || occupantId !== instance.id) return;
                // The creation answer was lost, and another entry activated the purchase.
                await getServiceTestDb()
                    .update(idempotencyKeys)
                    .set({ result: null, completedAt: null })
                    .where(
                        and(
                            eq(idempotencyKeys.subjectId, occupantId),
                            eq(idempotencyKeys.operation, PAYMENT_PAGE_OPERATION)
                        )
                    );
                await getServiceTestDb()
                    .update(addonInstances)
                    .set({ status: 'ACTIVE' })
                    .where(eq(addonInstances.id, occupantId));
            };

            const answer = await purchaseAddon(retry(), s.f.ports);

            expect(answer).toEqual({ outcome: 'REFUSED', reason: 'ALREADY_ACTIVE' });
        }
    );
});
