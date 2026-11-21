import { reconciliationPagePaymentModel } from '@repo/db';
import { PaymentProviderError } from '@repo/payments';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { confirmOneTimePagePayment } from '../../../src/services/billing/addon/addon-instance-a2-one-time-page';
import { abandonOneTimeAddon } from '../../../src/services/billing/addon/expire-addon-authorization-windows-one-time';
import { runReconciliationSweep } from '../../../src/services/billing/reconciliation/sweep/reconciliation-sweep.service';
import { closeServiceTestPool, isServiceTestDbAvailable } from './helpers';
import { withSeededReconciliationInventory } from './reconciliation-sweep-fixtures';
import { purchaseNow, retirePurchaseFixtures } from './support/addon-purchase-fixtures';
import {
    activationPagePayments,
    boughtPage,
    changeOf,
    heldPagePayments,
    liftPageMarks,
    pageInstance,
    pageMarkEvents,
    pageMarks,
    pagePriceIs,
    pageSetup,
    retirePageMarks
} from './support/one-time-page-fixtures';
import { orderDeadlines } from './support/paid-order-fixtures';

const DAY_MS = 86_400_000;
const skip = !isServiceTestDbAvailable();

afterEach(async () => {
    vi.restoreAllMocks();
    await retirePageMarks();
    await retirePurchaseFixtures();
});
afterAll(closeServiceTestPool);

type Setup = Awaited<ReturnType<typeof pageSetup>>;

/** Runs the sweep with only the page-payments pass, over this test's purchases only. */
async function sweepPagePayments(
    s: Setup,
    owned: readonly string[],
    input: { readonly days?: number; readonly correlationId?: string } = {}
) {
    const original =
        reconciliationPagePaymentModel.listSettledOneTimePagePurchasesInWindowPage.bind(
            reconciliationPagePaymentModel
        );
    const listing = vi
        .spyOn(reconciliationPagePaymentModel, 'listSettledOneTimePagePurchasesInWindowPage')
        .mockImplementation(async (page) => {
            const rows = await original({ ...page, afterInstanceId: undefined, limit: 10_000 });
            return rows
                .filter(({ instance }) => owned.includes(instance.id))
                .filter(
                    ({ instance }) =>
                        page.afterInstanceId === undefined || instance.id > page.afterInstanceId
                )
                .slice(0, page.limit);
        });
    try {
        return await withSeededReconciliationInventory(() =>
            runReconciliationSweep(
                { mode: 'single', correlationId: input.correlationId ?? crypto.randomUUID() },
                {
                    provider: s.f.fake,
                    clock: s.f.ports.clock,
                    pagePayments: {
                        deadlines: orderDeadlines(input.days ?? 180),
                        complements: {
                            addonPolicy: s.f.ports.addonPolicy,
                            listing: s.f.ports.listing
                        },
                        coverageNotices: s.ports.coverageNotices
                    }
                }
            )
        );
    } finally {
        listing.mockRestore();
    }
}

/** A purchase abandoned while an approved payment on its page went unnoticed. */
async function paidWithoutLiveInstance() {
    const s = await pageSetup();
    const { instance, paymentPageId } = await boughtPage(s);
    const paid = s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
    await abandonOneTimeAddon({
        instanceId: instance.id,
        expectedProviderOrderId: null,
        now: s.f.ports.clock.now()
    });
    s.f.advanceTo(new Date(purchaseNow.getTime() + DAY_MS));
    return { s, instance, paid };
}

/** An active purchase with a second approved payment whose notice never arrived. */
async function paidTwiceUnnoticed() {
    const s = await pageSetup();
    const { instance, paymentPageId } = await boughtPage(s);
    const first = s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
    const second = s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
    await confirmOneTimePagePayment({ instanceId: instance.id, chargeId: first.chargeId }, s.ports);
    s.f.advanceTo(new Date(purchaseNow.getTime() + DAY_MS));
    return { s, instance, first, second };
}

describe('TEST:B11:20 HOS-2179 §5.10 the sweep searches page payments', () => {
    it.skipIf(skip)(
        'LISTA:B11 cláusula 7 (página de pago, HOS-2179): opens mark 23 for a paid purchase with no live instance',
        async () => {
            const { s, instance, paid } = await paidWithoutLiveInstance();
            const search = vi.spyOn(s.f.fake, 'searchCharges');
            const read = vi.spyOn(s.f.fake, 'readCharge');

            const summary = await sweepPagePayments(s, [instance.id]);

            expect(summary.pagePayments).toEqual({
                examined: 1,
                duplicateMarked: 0,
                lateMarked: 1,
                divergenceMarked: 0,
                failures: []
            });
            expect(search).toHaveBeenCalledWith({
                reference: instance.orderRequestId,
                createdFrom: new Date(purchaseNow.getTime() - 3_600_000).toISOString(),
                createdTo: s.f.ports.clock.now().toISOString()
            });
            // The search only yields ids: the decision comes from the read by id (INV:D6).
            expect(read).toHaveBeenCalledWith({ chargeId: paid.chargeId });
            expect(await pageMarks(instance.id)).toEqual([
                { reason: 'ORDEN_PAGADA_SIN_INSTANCIA', liftedAt: null }
            ]);
            const [event] = await pageMarkEvents(instance.id);
            expect(event?.actorType).toBe('job');
            expect(changeOf(event ?? { changes: [] }, 'provider.charge_id')).toBe(paid.chargeId);
            expect((await pageInstance(instance.id)).status).toBe('ABANDONED');
            // D1: the sweep hangs the charge's own payment row from the mark, never credited.
            const held = await heldPagePayments(instance.id);
            expect(
                held.map((row) => [row.payment.providerFactId, row.reason, row.payment.status])
            ).toEqual([[paid.chargeId, 'ORDEN_PAGADA_SIN_INSTANCIA', 'SUCCEEDED']]);
            expect(await activationPagePayments(instance.id)).toHaveLength(0);
        }
    );

    it.skipIf(skip)('does not mark the same payment again on the next run', async () => {
        const { s, instance } = await paidWithoutLiveInstance();
        await sweepPagePayments(s, [instance.id]);
        const read = vi.spyOn(s.f.fake, 'readCharge');

        const again = await sweepPagePayments(s, [instance.id]);

        expect(again.pagePayments).toMatchObject({ examined: 1, lateMarked: 0, failures: [] });
        expect(read).not.toHaveBeenCalled();
        expect(await pageMarkEvents(instance.id)).toHaveLength(1);
    });

    it.skipIf(skip)('never reopens a mark 23 a person lifted', async () => {
        const { s, instance } = await paidWithoutLiveInstance();
        await sweepPagePayments(s, [instance.id]);
        await liftPageMarks(instance.id, instance.ownerId);
        await sweepPagePayments(s, [instance.id]);
        const marks = await pageMarks(instance.id);
        expect(marks).toHaveLength(1);
        expect(marks[0]?.liftedAt).not.toBeNull();
    });

    it.skipIf(skip)('opens COBRO_DUPLICADO for a second approved payment', async () => {
        const { s, instance, first, second } = await paidTwiceUnnoticed();
        const read = vi.spyOn(s.f.fake, 'readCharge');

        const summary = await sweepPagePayments(s, [instance.id]);

        expect(summary.pagePayments).toMatchObject({
            examined: 1,
            duplicateMarked: 1,
            lateMarked: 0,
            failures: []
        });
        // The payment the purchase holds is not read again.
        expect(read).not.toHaveBeenCalledWith({ chargeId: first.chargeId });
        expect(read).toHaveBeenCalledWith({ chargeId: second.chargeId });
        expect(await pageMarks(instance.id)).toEqual([
            { reason: 'COBRO_DUPLICADO', liftedAt: null }
        ]);
        expect((await pageInstance(instance.id)).status).toBe('ACTIVE');
        expect(
            (await heldPagePayments(instance.id)).map((row) => row.payment.providerFactId)
        ).toEqual([second.chargeId]);

        await sweepPagePayments(s, [instance.id]);
        expect(await pageMarkEvents(instance.id)).toHaveLength(1);
        expect(await heldPagePayments(instance.id)).toHaveLength(1);
    });

    it.skipIf(skip)('skips a payment that already carries the amount divergence', async () => {
        const s = await pageSetup();
        const { instance, paymentPageId } = await boughtPage(s);
        const paid = s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
        await pagePriceIs(instance.productId, 12000);
        expect(
            await confirmOneTimePagePayment(
                { instanceId: instance.id, chargeId: paid.chargeId },
                s.ports
            )
        ).toEqual({ outcome: 'AMOUNT_MISMATCH' });
        await abandonOneTimeAddon({
            instanceId: instance.id,
            expectedProviderOrderId: null,
            now: s.f.ports.clock.now()
        });
        // Back at the price the payment carries: a re-read alone would now call it late money.
        await pagePriceIs(instance.productId, 10000);
        s.f.advanceTo(new Date(purchaseNow.getTime() + DAY_MS));
        const read = vi.spyOn(s.f.fake, 'readCharge');

        const summary = await sweepPagePayments(s, [instance.id]);

        expect(summary.pagePayments).toMatchObject({
            examined: 1,
            lateMarked: 0,
            divergenceMarked: 0,
            failures: []
        });
        expect(read).not.toHaveBeenCalled();
        expect(await pageMarks(instance.id)).toEqual([
            { reason: 'DIVERGENCIA_DE_MONTO', liftedAt: null }
        ]);
        expect(await pageMarkEvents(instance.id)).toHaveLength(1);

        await liftPageMarks(instance.id, instance.ownerId);
        await sweepPagePayments(s, [instance.id]);
        expect((await pageMarks(instance.id)).map((m) => m.reason)).toEqual([
            'DIVERGENCIA_DE_MONTO'
        ]);
    });

    it.skipIf(skip)('marks nothing when the page only took rejected payments', async () => {
        const s = await pageSetup();
        const { instance, paymentPageId } = await boughtPage(s);
        s.f.fake.payOnPage({ paymentPageId, outcome: 'rejected' });
        await abandonOneTimeAddon({
            instanceId: instance.id,
            expectedProviderOrderId: null,
            now: s.f.ports.clock.now()
        });
        const summary = await sweepPagePayments(s, [instance.id]);
        expect(summary.pagePayments).toMatchObject({ examined: 1, lateMarked: 0, failures: [] });
        expect(await pageMarks(instance.id)).toHaveLength(0);
    });

    it.skipIf(skip)('leaves a purchase still waiting to A3', async () => {
        const s = await pageSetup();
        const { instance, paymentPageId } = await boughtPage(s);
        s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
        const search = vi.spyOn(s.f.fake, 'searchCharges');
        const summary = await sweepPagePayments(s, [instance.id]);
        expect(summary.pagePayments?.examined).toBe(0);
        expect(search).not.toHaveBeenCalled();
        expect((await pageInstance(instance.id)).status).toBe('PENDING_AUTHORIZATION');
    });

    it.skipIf(skip)('leaves out a purchase whose page key is older than the window', async () => {
        const { s, instance } = await paidWithoutLiveInstance();
        s.f.advanceTo(new Date(purchaseNow.getTime() + 31 * DAY_MS));
        const summary = await sweepPagePayments(s, [instance.id], { days: 30 });
        expect(summary.pagePayments?.examined).toBe(0);
        expect(await pageMarks(instance.id)).toHaveLength(0);
    });

    it.skipIf(skip)(
        'records a failure and marks nothing when the search does not answer',
        async () => {
            const { s, instance } = await paidWithoutLiveInstance();
            vi.spyOn(s.f.fake, 'searchCharges').mockRejectedValue(
                new PaymentProviderError({
                    code: 'UNAVAILABLE',
                    capability: 'read',
                    message: 'down'
                })
            );
            const summary = await sweepPagePayments(s, [instance.id]);
            expect(summary.pagePayments).toMatchObject({ examined: 1, lateMarked: 0 });
            expect(summary.pagePayments?.failures).toEqual([
                { addonInstanceId: instance.id, message: expect.any(String) }
            ]);
            expect(await pageMarks(instance.id)).toHaveLength(0);
        }
    );

    it.skipIf(skip)('records a charge it could not read as undecided', async () => {
        const { s, instance, paid } = await paidWithoutLiveInstance();
        vi.spyOn(s.f.fake, 'readCharge').mockRejectedValue(new Error('down'));
        const summary = await sweepPagePayments(s, [instance.id]);
        expect(summary.pagePayments?.failures).toEqual([
            { addonInstanceId: instance.id, message: `undecided charges: ${paid.chargeId}` }
        ]);
        expect(await pageMarks(instance.id)).toHaveLength(0);
    });
});
