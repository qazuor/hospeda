import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { confirmOneTimePagePayment } from '../../../src/services/billing/addon/addon-instance-a2-one-time-page';
import { abandonOneTimeAddon } from '../../../src/services/billing/addon/expire-addon-authorization-windows-one-time';
import { closeServiceTestPool, isServiceTestDbAvailable } from './helpers';
import { retirePurchaseFixtures } from './support/addon-purchase-fixtures';
import {
    boughtPage,
    changeOf,
    liftPageMarks,
    pageInstance,
    pageMarkEvents,
    pageMarks,
    pagePayments,
    pagePriceIs,
    pageSetup,
    refusePageMarks
} from './support/one-time-page-fixtures';

const skip = !isServiceTestDbAvailable();

afterEach(async () => {
    vi.restoreAllMocks();
    await retirePurchaseFixtures();
});
afterAll(closeServiceTestPool);

/** A purchase activated by its first approved payment, plus a second approved payment on the page. */
async function paidTwice() {
    const s = await pageSetup();
    const { instance, paymentPageId } = await boughtPage(s);
    const first = s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
    const second = s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
    expect(
        await confirmOneTimePagePayment(
            { instanceId: instance.id, chargeId: first.chargeId },
            s.ports
        )
    ).toMatchObject({ outcome: 'ACTIVATED' });
    return { s, instance, first, second };
}

/** A purchase abandoned with an approved payment it never saw. */
async function paidAfterAbandon() {
    const s = await pageSetup();
    const { instance, paymentPageId } = await boughtPage(s);
    const paid = s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
    await abandonOneTimeAddon({
        instanceId: instance.id,
        expectedProviderOrderId: null,
        now: s.f.ports.clock.now()
    });
    return { s, instance, paid };
}

describe('HOS-2179 §5.8 AC-11 a second payment on the same page opens COBRO_DUPLICADO', () => {
    it.skipIf(skip)('opens the mark with the charge and a proposed full refund', async () => {
        const { s, instance, second } = await paidTwice();

        const result = await confirmOneTimePagePayment(
            { instanceId: instance.id, chargeId: second.chargeId },
            s.ports
        );

        expect(result).toEqual({ outcome: 'DUPLICATE_PAYMENT' });
        expect((await pageInstance(instance.id)).status).toBe('ACTIVE');
        expect(await pagePayments(instance.id)).toHaveLength(1);
        expect(await pageMarks(instance.id)).toEqual([
            { reason: 'COBRO_DUPLICADO', liftedAt: null }
        ]);
        const [event] = await pageMarkEvents(instance.id);
        expect(event?.actorType).toBe('provider');
        expect(changeOf(event ?? { changes: [] }, 'provider.charge_id')).toBe(second.chargeId);
        expect(changeOf(event ?? { changes: [] }, 'provider.charge_amount_minor')).toBe(10000);
        expect(changeOf(event ?? { changes: [] }, 'provider.charge_currency')).toBe('ARS');
        expect(
            changeOf(event ?? { changes: [] }, 'reconciliation_mark.proposed_refund_minor')
        ).toBe(10000);
    });

    it.skipIf(skip)(
        'accumulates a repeated notice of the same duplicate on one open mark',
        async () => {
            const { s, instance, second } = await paidTwice();
            for (let i = 0; i < 2; i++)
                expect(
                    await confirmOneTimePagePayment(
                        { instanceId: instance.id, chargeId: second.chargeId },
                        s.ports
                    )
                ).toEqual({ outcome: 'DUPLICATE_PAYMENT' });
            expect(await pageMarks(instance.id)).toEqual([
                { reason: 'COBRO_DUPLICADO', liftedAt: null }
            ]);
            expect(await pageMarkEvents(instance.id)).toHaveLength(2);
        }
    );

    it.skipIf(skip)('does not reopen a lifted duplicate for the same charge', async () => {
        const { s, instance, second } = await paidTwice();
        await confirmOneTimePagePayment(
            { instanceId: instance.id, chargeId: second.chargeId },
            s.ports
        );
        await liftPageMarks(instance.id, instance.ownerId);
        expect(
            await confirmOneTimePagePayment(
                { instanceId: instance.id, chargeId: second.chargeId },
                s.ports
            )
        ).toEqual({ outcome: 'DUPLICATE_PAYMENT' });
        const marks = await pageMarks(instance.id);
        expect(marks).toHaveLength(1);
        expect(marks[0]?.liftedAt).not.toBeNull();
        expect(await pageMarkEvents(instance.id)).toHaveLength(1);
    });

    it.skipIf(skip)('opens a new duplicate for a third payment after one was lifted', async () => {
        const s = await pageSetup();
        const { instance, paymentPageId } = await boughtPage(s);
        // RP18: the open page takes all three before the activation closes it.
        const [first, second, third] = [1, 2, 3].map(() =>
            s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' })
        );
        if (!first || !second || !third) throw new Error('payments missing');
        await confirmOneTimePagePayment(
            { instanceId: instance.id, chargeId: first.chargeId },
            s.ports
        );
        await confirmOneTimePagePayment(
            { instanceId: instance.id, chargeId: second.chargeId },
            s.ports
        );
        await liftPageMarks(instance.id, instance.ownerId);
        expect(
            await confirmOneTimePagePayment(
                { instanceId: instance.id, chargeId: third.chargeId },
                s.ports
            )
        ).toEqual({ outcome: 'DUPLICATE_PAYMENT' });
        const marks = await pageMarks(instance.id);
        expect(marks.map((mark) => mark.reason)).toEqual(['COBRO_DUPLICADO', 'COBRO_DUPLICADO']);
        expect(marks.filter((mark) => mark.liftedAt === null)).toHaveLength(1);
    });

    it.skipIf(skip)('leaves a duplicate undecided when its mark cannot open', async () => {
        const { s, instance, second } = await paidTwice();
        await refusePageMarks(instance.id, async () => {
            expect(
                await confirmOneTimePagePayment(
                    { instanceId: instance.id, chargeId: second.chargeId },
                    s.ports
                )
            ).toEqual({ outcome: 'UNKNOWN' });
        });
        expect(await pageMarks(instance.id)).toHaveLength(0);
    });

    it.skipIf(skip)('opens nothing for a repeated notice of the payment it holds', async () => {
        const { s, instance, first } = await paidTwice();
        expect(
            await confirmOneTimePagePayment(
                { instanceId: instance.id, chargeId: first.chargeId },
                s.ports
            )
        ).toEqual({ outcome: 'ALREADY_CONFIRMED' });
        expect(await pageMarks(instance.id)).toHaveLength(0);
    });
});

describe('HOS-2179 §5.9 AC-12 a payment after the purchase closed opens mark 23', () => {
    it.skipIf(skip)('opens mark 23 with a proposed refund and activates nothing', async () => {
        const { s, instance, paid } = await paidAfterAbandon();

        const result = await confirmOneTimePagePayment(
            { instanceId: instance.id, chargeId: paid.chargeId },
            s.ports
        );

        expect(result).toEqual({ outcome: 'LATE_PAYMENT' });
        expect((await pageInstance(instance.id)).status).toBe('ABANDONED');
        expect(await pagePayments(instance.id)).toHaveLength(0);
        expect(await pageMarks(instance.id)).toEqual([
            { reason: 'ORDEN_PAGADA_SIN_INSTANCIA', liftedAt: null }
        ]);
        const [event] = await pageMarkEvents(instance.id);
        expect(changeOf(event ?? { changes: [] }, 'provider.charge_id')).toBe(paid.chargeId);
        expect(
            changeOf(event ?? { changes: [] }, 'reconciliation_mark.proposed_refund_minor')
        ).toBe(10000);
    });

    it.skipIf(skip)('records the sweep as the actor when the sweep opens it', async () => {
        const { s, instance, paid } = await paidAfterAbandon();
        const correlationId = crypto.randomUUID();
        expect(
            await confirmOneTimePagePayment(
                {
                    instanceId: instance.id,
                    chargeId: paid.chargeId,
                    trigger: { actor: 'job', correlationId }
                },
                s.ports
            )
        ).toEqual({ outcome: 'LATE_PAYMENT' });
        const [event] = await pageMarkEvents(instance.id);
        expect(event?.actorType).toBe('job');
    });

    it.skipIf(skip)('does not reopen a lifted mark 23 for the same charge', async () => {
        const { s, instance, paid } = await paidAfterAbandon();
        await confirmOneTimePagePayment(
            { instanceId: instance.id, chargeId: paid.chargeId },
            s.ports
        );
        await liftPageMarks(instance.id, instance.ownerId);
        expect(
            await confirmOneTimePagePayment(
                { instanceId: instance.id, chargeId: paid.chargeId },
                s.ports
            )
        ).toEqual({ outcome: 'LATE_PAYMENT' });
        expect(await pageMarks(instance.id)).toHaveLength(1);
        expect(await pageMarkEvents(instance.id)).toHaveLength(1);
    });

    it.skipIf(skip)('leaves a late payment undecided when its mark cannot open', async () => {
        const { s, instance, paid } = await paidAfterAbandon();
        await refusePageMarks(instance.id, async () => {
            expect(
                await confirmOneTimePagePayment(
                    { instanceId: instance.id, chargeId: paid.chargeId },
                    s.ports
                )
            ).toEqual({ outcome: 'UNKNOWN' });
        });
        expect(await pageMarks(instance.id)).toHaveLength(0);
    });

    it.skipIf(skip)(
        'raises only the amount divergence for another amount on a closed purchase',
        async () => {
            const { s, instance, paid } = await paidAfterAbandon();
            await pagePriceIs(instance.productId, 12000);
            expect(
                await confirmOneTimePagePayment(
                    { instanceId: instance.id, chargeId: paid.chargeId },
                    s.ports
                )
            ).toEqual({ outcome: 'AMOUNT_MISMATCH' });
            expect(await pageMarks(instance.id)).toEqual([
                { reason: 'DIVERGENCIA_DE_MONTO', liftedAt: null }
            ]);
        }
    );
});
