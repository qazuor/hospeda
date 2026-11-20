import {
    addonInstances,
    addonProducts,
    and,
    domainEvent,
    eq,
    idempotencyKeys,
    isNull,
    payments,
    reconciliationMarks
} from '@repo/db';
import { PaymentProviderError } from '@repo/payments';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { confirmOneTimePagePayment } from '../../../src/services/billing/addon/addon-instance-a2-one-time-page';
import { closeOneTimePaymentPage } from '../../../src/services/billing/addon/close-one-time-payment-page';
import { expireAddonAuthorizationWindows } from '../../../src/services/billing/addon/expire-addon-authorization-windows.service';
import { abandonOneTimeAddon } from '../../../src/services/billing/addon/expire-addon-authorization-windows-one-time';
import { openOneTimePaymentPage } from '../../../src/services/billing/addon/one-time-payment-page';
import { purchaseAddon } from '../../../src/services/billing/addon/purchase-addon.service';
import { getCurrentBillingDeadlines } from '../../../src/services/billing/deadlines/billing-deadlines.service';
import {
    closeServiceTestPool,
    getServiceTestDb,
    getServiceTestPool,
    isServiceTestDbAvailable
} from './helpers';
import { payingPrincipal } from './support/addon-a2-fixtures';
import {
    purchaseFixture,
    purchaseNow,
    retirePurchaseFixtures
} from './support/addon-purchase-fixtures';
import { activationPagePayments, heldPagePayments } from './support/one-time-page-fixtures';
import { outboxBeforeCancelNotice } from './support/outbox-before-cancel-notice';

const MINUTE = 60_000;
const skip = !isServiceTestDbAvailable();

afterEach(async () => {
    vi.restoreAllMocks();
    await retirePurchaseFixtures();
});
afterAll(closeServiceTestPool);

async function instanceOf(instanceId: string) {
    const [row] = await getServiceTestDb()
        .select()
        .from(addonInstances)
        .where(eq(addonInstances.id, instanceId));
    if (!row) throw new Error('Instance missing');
    return row;
}

async function keysOf(instanceId: string) {
    return getServiceTestDb()
        .select()
        .from(idempotencyKeys)
        .where(eq(idempotencyKeys.subjectId, instanceId));
}

async function paymentsOf(instanceId: string) {
    return getServiceTestDb()
        .select()
        .from(payments)
        .where(eq(payments.addonInstanceId, instanceId));
}

/** Records a page on the purchase the way a concurrent resume would have, ahead of the caller. */
async function recordPageDirectly(input: {
    readonly reference: string;
    readonly page: { paymentPageId: string; approvalUrl: string; expiresAt: string };
}) {
    const db = getServiceTestDb();
    const [row] = await db
        .select()
        .from(addonInstances)
        .where(eq(addonInstances.orderRequestId, input.reference));
    if (!row) throw new Error('Instance missing');
    await db
        .update(addonInstances)
        .set({
            paymentPageId: input.page.paymentPageId,
            paymentPageExpiresAt: new Date(input.page.expiresAt)
        })
        .where(eq(addonInstances.id, row.id));
    await db
        .update(idempotencyKeys)
        .set({
            result: {
                paymentPageId: input.page.paymentPageId,
                expiresAt: input.page.expiresAt,
                checkoutUrl: input.page.approvalUrl
            },
            completedAt: new Date()
        })
        .where(eq(idempotencyKeys.subjectId, row.id));
}

async function marksOf(instanceId: string) {
    return getServiceTestDb()
        .select({ reason: reconciliationMarks.reason, liftedAt: reconciliationMarks.liftedAt })
        .from(reconciliationMarks)
        .where(eq(reconciliationMarks.addonInstanceId, instanceId));
}

async function priceIs(productId: string, price: number) {
    await getServiceTestDb()
        .update(addonProducts)
        .set({ price })
        .where(eq(addonProducts.id, productId));
}

/** Lifts every open mark of the instance, as a person settling it without a refund would. */
async function liftMarksOf(instanceId: string, liftedBy: string) {
    await getServiceTestDb()
        .update(reconciliationMarks)
        .set({ liftedAt: new Date(), liftedBy })
        .where(
            and(
                eq(reconciliationMarks.addonInstanceId, instanceId),
                isNull(reconciliationMarks.liftedAt)
            )
        );
}

async function markEventsOf(instanceId: string) {
    return getServiceTestDb()
        .select({ changes: domainEvent.changes })
        .from(domainEvent)
        .where(
            and(
                eq(domainEvent.entityId, instanceId),
                eq(domainEvent.eventType, 'reconciliation.mark_opened')
            )
        )
        .orderBy(domainEvent.occurredAt, domainEvent.id);
}

/** Makes every mark insert for this one instance fail while `run` runs; other files are untouched. */
async function refuseMarksFor(instanceId: string, run: () => Promise<void>) {
    const pool = getServiceTestPool();
    const name = `refuse_marks_${instanceId.replaceAll('-', '')}`;
    await pool.query(
        `CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.addon_instance_id = '${instanceId}' THEN RAISE EXCEPTION 'mark refused by test'; END IF; RETURN NEW; END $$`
    );
    await pool.query(
        `CREATE TRIGGER ${name} BEFORE INSERT ON reconciliation_mark FOR EACH ROW EXECUTE FUNCTION ${name}()`
    );
    try {
        await run();
    } finally {
        await pool.query(`DROP TRIGGER ${name} ON reconciliation_mark`);
        await pool.query(`DROP FUNCTION ${name}()`);
    }
}

async function setup() {
    const f = await purchaseFixture();
    await payingPrincipal(f);
    const request = f.input();
    const ports = {
        ...f.ports,
        beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }),
        coverageNotices: { emitCoverageChanged: vi.fn(async () => {}) }
    };
    return { f, request, ports };
}

async function bought(s: Awaited<ReturnType<typeof setup>>) {
    const result = await purchaseAddon(s.request, s.f.ports);
    if (result.outcome !== 'CREATED') throw new Error(`Purchase returned ${result.outcome}`);
    const instance = await instanceOf(result.instanceId);
    if (!instance.paymentPageId) throw new Error('Payment page missing');
    return { result, instance, paymentPageId: instance.paymentPageId };
}

describe('HOS-2179 §5.1 A1 opens a payment page for a one-time purchase', () => {
    it.skipIf(skip)('opens one page keyed before the call, with no card data', async () => {
        const s = await setup();
        const request = vi.spyOn(s.f.fake, 'requestOneTimePayment');
        const { result, instance, paymentPageId } = await bought(s);

        expect(result).toMatchObject({ outcome: 'CREATED', chargeKind: 'UNA_VEZ' });
        expect(result.outcome === 'CREATED' && result.checkoutUrl).toBe(
            `https://payments-fake.invalid/pay/${paymentPageId}`
        );
        const deadlines = await getCurrentBillingDeadlines();
        expect(deadlines.values['21']).toEqual({ pageMinutes: 60, windowMarginMinutes: 60 });
        expect(request).toHaveBeenCalledTimes(1);
        expect(request.mock.calls[0]?.[0]).toEqual({
            reference: s.request.orderRequestId,
            idempotencyKey: `page:${s.request.orderRequestId}`,
            amount: { amountMinor: 10000, currency: 'ARS' },
            reason: expect.any(String),
            returnUrl: s.request.returnUrl,
            expiresAt: new Date(purchaseNow.getTime() + 60 * MINUTE).toISOString()
        });
        expect(instance).toMatchObject({
            status: 'PENDING_AUTHORIZATION',
            createdAt: purchaseNow,
            providerOrderId: null,
            paymentPageExpiresAt: new Date(purchaseNow.getTime() + 60 * MINUTE)
        });
        const keys = await keysOf(instance.id);
        expect(keys).toHaveLength(1);
        expect(keys[0]).toMatchObject({
            key: `page:${s.request.orderRequestId}`,
            operation: 'PAYMENT_PAGE_CREATE',
            completedAt: expect.any(Date),
            result: { paymentPageId, checkoutUrl: expect.any(String) },
            request: { returnUrl: s.request.returnUrl }
        });
    });

    it.skipIf(skip)('answers a replay with the stored link and opens no second page', async () => {
        const s = await setup();
        const { result } = await bought(s);
        const request = vi.spyOn(s.f.fake, 'requestOneTimePayment');
        const again = await purchaseAddon(s.request, s.f.ports);
        expect(again).toEqual({
            outcome: 'EXISTING',
            instanceId: result.instanceId,
            chargeKind: 'UNA_VEZ',
            checkoutUrl: result.outcome === 'CREATED' ? result.checkoutUrl : undefined
        });
        expect(request).not.toHaveBeenCalled();
    });

    it.skipIf(skip)('records the page but never hands out an unsafe link (G10)', async () => {
        const s = await setup();
        const original = s.f.fake.requestOneTimePayment.bind(s.f.fake);
        const request = vi
            .spyOn(s.f.fake, 'requestOneTimePayment')
            .mockImplementationOnce(async (input) => ({
                ...(await original(input)),
                approvalUrl: 'http://payments-fake.invalid/pay/unsafe'
            }));
        await expect(purchaseAddon(s.request, s.f.ports)).rejects.toMatchObject({
            reason: 'NOT_HTTPS'
        });
        const [row] = await getServiceTestDb()
            .select()
            .from(addonInstances)
            .where(eq(addonInstances.orderRequestId, s.request.orderRequestId));
        expect(row?.paymentPageId).not.toBeNull();
        expect((await keysOf(row?.id ?? ''))[0]).toMatchObject({
            completedAt: expect.any(Date),
            result: { applied: false }
        });
        const again = await purchaseAddon(s.request, s.f.ports);
        expect(again).toEqual({
            outcome: 'EXISTING',
            instanceId: row?.id,
            chargeKind: 'UNA_VEZ',
            checkoutUrl: undefined
        });
        expect(request).toHaveBeenCalledTimes(1);
    });

    it.skipIf(skip)(
        'closes a page that arrives after a concurrent refusal released the purchase',
        async () => {
            const s = await setup();
            const original = s.f.fake.requestOneTimePayment.bind(s.f.fake);
            let received: string | undefined;
            vi.spyOn(s.f.fake, 'requestOneTimePayment').mockImplementationOnce(async (input) => {
                const page = await original(input);
                received = page.paymentPageId;
                // Request B's refusal released the purchase while request A's page was in flight.
                const [row] = await getServiceTestDb()
                    .select()
                    .from(addonInstances)
                    .where(eq(addonInstances.orderRequestId, input.reference));
                await abandonOneTimeAddon({
                    instanceId: row?.id ?? '',
                    expectedProviderOrderId: null,
                    now: s.f.ports.clock.now()
                });
                return page;
            });
            const close = vi.spyOn(s.f.fake, 'closeOneTimePayment');
            const result = await purchaseAddon(s.request, s.f.ports);
            // T-6: the released purchase never gets a page, so the screen is told to mint a
            // new order id rather than replay this one.
            expect(result).toEqual({ outcome: 'REFUSED', reason: 'ORDER_REQUEST_ABANDONED' });
            expect(close).toHaveBeenCalledWith({ paymentPageId: received });
            const page = await s.f.fake.readOneTimePayment({ paymentPageId: received ?? '' });
            expect(Date.parse(page.snapshot.expiresAt ?? '')).toBeLessThanOrEqual(
                s.f.ports.clock.now().getTime()
            );
            const [instance] = await getServiceTestDb()
                .select()
                .from(addonInstances)
                .where(eq(addonInstances.orderRequestId, s.request.orderRequestId));
            expect(instance).toMatchObject({ status: 'ABANDONED', paymentPageId: null });
        }
    );

    it.skipIf(skip)(
        'answers NOT_APPLICABLE to a resume whose purchase was released meanwhile',
        async () => {
            const s = await setup();
            vi.spyOn(s.f.fake, 'requestOneTimePayment').mockRejectedValueOnce(
                new PaymentProviderError({
                    code: 'UNAVAILABLE',
                    capability: 'charge',
                    message: 'lost'
                })
            );
            await expect(purchaseAddon(s.request, s.f.ports)).rejects.toThrow();
            const [row] = await getServiceTestDb()
                .select()
                .from(addonInstances)
                .where(eq(addonInstances.orderRequestId, s.request.orderRequestId));
            const original = s.f.fake.requestOneTimePayment.bind(s.f.fake);
            vi.spyOn(s.f.fake, 'requestOneTimePayment').mockImplementationOnce(async (input) => {
                const page = await original(input);
                await abandonOneTimeAddon({
                    instanceId: row?.id ?? '',
                    expectedProviderOrderId: null,
                    now: s.f.ports.clock.now()
                });
                return page;
            });
            expect(
                await openOneTimePaymentPage(
                    { instanceId: row?.id ?? '', returnUrl: s.request.returnUrl },
                    s.f.ports
                )
            ).toEqual({ outcome: 'NOT_APPLICABLE' });
        }
    );

    it.skipIf(skip)(
        'closes its own page when a concurrent resume recorded another first',
        async () => {
            const s = await setup();
            const original = s.f.fake.requestOneTimePayment.bind(s.f.fake);
            let first: string | undefined;
            let second: string | undefined;
            vi.spyOn(s.f.fake, 'requestOneTimePayment').mockImplementationOnce(async (input) => {
                const winner = await original(input);
                first = winner.paymentPageId;
                await recordPageDirectly({ reference: input.reference, page: winner });
                const ours = await original(input);
                second = ours.paymentPageId;
                return ours;
            });
            const close = vi.spyOn(s.f.fake, 'closeOneTimePayment');
            const result = await purchaseAddon(s.request, s.f.ports);
            expect(result).toMatchObject({
                outcome: 'CREATED',
                checkoutUrl: `https://payments-fake.invalid/pay/${first}`
            });
            expect(close).toHaveBeenCalledTimes(1);
            expect(close).toHaveBeenCalledWith({ paymentPageId: second });
        }
    );

    it.skipIf(skip)(
        'keeps the recorded page open when the provider handed it back again',
        async () => {
            const s = await setup();
            const original = s.f.fake.requestOneTimePayment.bind(s.f.fake);
            vi.spyOn(s.f.fake, 'requestOneTimePayment').mockImplementationOnce(async (input) => {
                const page = await original(input);
                await recordPageDirectly({ reference: input.reference, page });
                return page;
            });
            const close = vi.spyOn(s.f.fake, 'closeOneTimePayment');
            const result = await purchaseAddon(s.request, s.f.ports);
            expect(result).toMatchObject({ outcome: 'CREATED', checkoutUrl: expect.any(String) });
            expect(close).not.toHaveBeenCalled();
        }
    );

    it.skipIf(skip)('resumes a lost creation answer into one instance with one page', async () => {
        const s = await setup();
        const original = s.f.fake.requestOneTimePayment.bind(s.f.fake);
        const request = vi
            .spyOn(s.f.fake, 'requestOneTimePayment')
            .mockImplementationOnce(async (input) => {
                await original(input);
                throw new PaymentProviderError({
                    code: 'UNAVAILABLE',
                    capability: 'charge',
                    message: 'simulated: the answer was lost'
                });
            });
        await expect(purchaseAddon(s.request, s.f.ports)).rejects.toMatchObject({
            code: 'UNAVAILABLE'
        });
        const [lost] = await getServiceTestDb()
            .select()
            .from(addonInstances)
            .where(eq(addonInstances.orderRequestId, s.request.orderRequestId));
        expect(lost).toMatchObject({ status: 'PENDING_AUTHORIZATION', paymentPageId: null });
        expect((await keysOf(lost?.id ?? ''))[0]?.completedAt).toBeNull();

        s.f.advanceTo(new Date(purchaseNow.getTime() + 10 * MINUTE));
        const again = await purchaseAddon(s.request, s.f.ports);
        expect(again).toMatchObject({ outcome: 'EXISTING', checkoutUrl: expect.any(String) });
        expect(request).toHaveBeenCalledTimes(2);
        expect(request.mock.calls[1]?.[0]).toEqual(request.mock.calls[0]?.[0]);
        const instance = await instanceOf(lost?.id ?? '');
        expect(instance.paymentPageId).not.toBeNull();
        expect((await keysOf(instance.id))[0]?.completedAt).not.toBeNull();
    });

    it.skipIf(skip)(
        'resumes from another locale with the body stored before the lost call',
        async () => {
            const s = await setup();
            const first = { ...s.request, reason: 'Destacado (es)' };
            const original = s.f.fake.requestOneTimePayment.bind(s.f.fake);
            const request = vi
                .spyOn(s.f.fake, 'requestOneTimePayment')
                .mockImplementationOnce(async (input) => {
                    await original(input);
                    throw new PaymentProviderError({
                        code: 'UNAVAILABLE',
                        capability: 'charge',
                        message: 'simulated: the answer was lost'
                    });
                });
            await expect(purchaseAddon(first, s.f.ports)).rejects.toMatchObject({
                code: 'UNAVAILABLE'
            });

            const otherLocale = {
                ...first,
                returnUrl: 'https://hospeda.invalid/en/my-account/addons/return',
                reason: 'Featured (en)'
            };
            expect(otherLocale.returnUrl).not.toBe(first.returnUrl);
            const again = await purchaseAddon(otherLocale, s.f.ports);
            expect(again).toMatchObject({ outcome: 'EXISTING', checkoutUrl: expect.any(String) });
            expect(request).toHaveBeenCalledTimes(2);
            expect(request.mock.calls[1]?.[0]).toMatchObject({
                returnUrl: first.returnUrl,
                reason: 'Destacado (es)'
            });
            expect(request.mock.calls[1]?.[0]).toEqual(request.mock.calls[0]?.[0]);
        }
    );

    it.skipIf(skip)('resumes a key written before the stored body with this request', async () => {
        const s = await setup();
        const original = s.f.fake.requestOneTimePayment.bind(s.f.fake);
        const request = vi
            .spyOn(s.f.fake, 'requestOneTimePayment')
            .mockImplementationOnce(async (input) => {
                await original(input);
                throw new PaymentProviderError({
                    code: 'UNAVAILABLE',
                    capability: 'charge',
                    message: 'simulated: the answer was lost'
                });
            });
        await expect(purchaseAddon(s.request, s.f.ports)).rejects.toMatchObject({
            code: 'UNAVAILABLE'
        });
        await getServiceTestDb()
            .update(idempotencyKeys)
            .set({ request: null })
            .where(eq(idempotencyKeys.key, `page:${s.request.orderRequestId}`));
        const returnUrl = 'https://hospeda.invalid/pt/minha-conta/addons/return';
        await purchaseAddon({ ...s.request, returnUrl }, s.f.ports);
        expect(request).toHaveBeenCalledTimes(2);
        expect(request.mock.calls[1]?.[0]).toMatchObject({ returnUrl });
    });

    it.skipIf(skip)('opens no page once the page time of the purchase elapsed', async () => {
        const s = await setup();
        vi.spyOn(s.f.fake, 'requestOneTimePayment').mockRejectedValueOnce(
            new PaymentProviderError({
                code: 'UNAVAILABLE',
                capability: 'charge',
                message: 'no answer'
            })
        );
        await expect(purchaseAddon(s.request, s.f.ports)).rejects.toThrow();
        s.f.advanceTo(new Date(purchaseNow.getTime() + 60 * MINUTE));
        const request = vi.spyOn(s.f.fake, 'requestOneTimePayment');
        request.mockClear();
        const again = await purchaseAddon(s.request, s.f.ports);
        expect(again).toMatchObject({ outcome: 'EXISTING' });
        expect('checkoutUrl' in again && again.checkoutUrl).toBeFalsy();
        expect(request).not.toHaveBeenCalled();
    });

    it.skipIf(skip)('releases the purchase when the provider refuses the page', async () => {
        const s = await setup();
        vi.spyOn(s.f.fake, 'requestOneTimePayment').mockRejectedValueOnce(
            new PaymentProviderError({ code: 'REJECTED', capability: 'charge', message: 'no' })
        );
        await expect(purchaseAddon(s.request, s.f.ports)).rejects.toMatchObject({
            code: 'REJECTED'
        });
        const [row] = await getServiceTestDb()
            .select()
            .from(addonInstances)
            .where(eq(addonInstances.orderRequestId, s.request.orderRequestId));
        expect(row?.status).toBe('ABANDONED');
        expect((await keysOf(row?.id ?? ''))[0]).toMatchObject({
            completedAt: expect.any(Date),
            result: { outcome: 'REJECTED_BY_PROVIDER' }
        });
    });
});

describe('HOS-2179 §5.3 A2 confirms a page payment only by a fresh read by id', () => {
    it.skipIf(skip)(
        'activates on an approved payment, credits it and closes the page',
        async () => {
            const s = await setup();
            const { instance, paymentPageId } = await bought(s);
            const paid = s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
            s.f.advanceTo(new Date(purchaseNow.getTime() + 5 * MINUTE));
            const read = vi.spyOn(s.f.fake, 'readCharge');

            const result = await confirmOneTimePagePayment(
                { instanceId: instance.id, chargeId: paid.chargeId },
                s.ports
            );

            expect(result).toMatchObject({ outcome: 'ACTIVATED', paymentId: expect.any(String) });
            expect(read).toHaveBeenCalledWith({ chargeId: paid.chargeId });
            const active = await instanceOf(instance.id);
            expect(active.status).toBe('ACTIVE');
            expect((active.endsAt?.getTime() ?? 0) - (active.startsAt?.getTime() ?? 0)).toBe(
                30 * 86_400_000
            );
            const rows = await paymentsOf(instance.id);
            expect(rows).toHaveLength(1);
            expect(rows[0]).toMatchObject({
                providerFactId: paid.chargeId,
                amount: 10000,
                currency: 'ARS',
                subscriptionId: null,
                status: 'SUCCEEDED'
            });
            expect(active.paymentPageExpiresAt).toEqual(s.f.ports.clock.now());
            const page = await s.f.fake.readOneTimePayment({ paymentPageId });
            expect(Date.parse(page.snapshot.expiresAt ?? '')).toBeLessThanOrEqual(
                s.f.ports.clock.now().getTime()
            );
            expect(() => s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' })).toThrow();

            expect(
                await confirmOneTimePagePayment(
                    { instanceId: instance.id, chargeId: paid.chargeId },
                    s.ports
                )
            ).toEqual({ outcome: 'ALREADY_CONFIRMED' });
            expect(await paymentsOf(instance.id)).toHaveLength(1);
        }
    );

    it.skipIf(skip)('keeps waiting on a rejected payment and activates the retry', async () => {
        const s = await setup();
        const { instance, paymentPageId } = await bought(s);
        const declined = s.f.fake.payOnPage({ paymentPageId, outcome: 'rejected' });
        expect(
            await confirmOneTimePagePayment(
                { instanceId: instance.id, chargeId: declined.chargeId },
                s.ports
            )
        ).toEqual({ outcome: 'NOT_APPROVED' });
        expect((await instanceOf(instance.id)).status).toBe('PENDING_AUTHORIZATION');
        expect(await paymentsOf(instance.id)).toHaveLength(0);
        const retry = s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
        expect(
            await confirmOneTimePagePayment(
                { instanceId: instance.id, chargeId: retry.chargeId },
                s.ports
            )
        ).toMatchObject({ outcome: 'ACTIVATED' });
    });

    it.skipIf(skip)('classifies a second approved payment as a duplicate', async () => {
        const s = await setup();
        const { instance, paymentPageId } = await bought(s);
        const first = s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
        const second = s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
        await confirmOneTimePagePayment(
            { instanceId: instance.id, chargeId: first.chargeId },
            s.ports
        );
        expect(
            await confirmOneTimePagePayment(
                { instanceId: instance.id, chargeId: second.chargeId },
                s.ports
            )
        ).toEqual({ outcome: 'DUPLICATE_PAYMENT' });
        expect((await activationPagePayments(instance.id)).map((p) => p.providerFactId)).toEqual([
            first.chargeId
        ]);
        expect(
            (await heldPagePayments(instance.id)).map((row) => row.payment.providerFactId)
        ).toEqual([second.chargeId]);
    });

    it.skipIf(skip)('classifies a payment on an abandoned purchase as late', async () => {
        const s = await setup();
        const { instance, paymentPageId } = await bought(s);
        const paid = s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
        await abandonOneTimeAddon({
            instanceId: instance.id,
            expectedProviderOrderId: null,
            now: s.f.ports.clock.now()
        });
        expect(
            await confirmOneTimePagePayment(
                { instanceId: instance.id, chargeId: paid.chargeId },
                s.ports
            )
        ).toEqual({ outcome: 'LATE_PAYMENT' });
        expect((await instanceOf(instance.id)).status).toBe('ABANDONED');
        expect(await activationPagePayments(instance.id)).toHaveLength(0);
        expect(
            (await heldPagePayments(instance.id)).map((row) => row.payment.providerFactId)
        ).toEqual([paid.chargeId]);
    });

    it.skipIf(skip)('does not activate a payment of another amount', async () => {
        const s = await setup();
        const { instance, paymentPageId } = await bought(s);
        const paid = s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
        await getServiceTestDb()
            .update(addonProducts)
            .set({ price: 12000 })
            .where(eq(addonProducts.id, instance.productId));
        expect(
            await confirmOneTimePagePayment(
                { instanceId: instance.id, chargeId: paid.chargeId },
                s.ports
            )
        ).toEqual({ outcome: 'AMOUNT_MISMATCH' });
        expect((await instanceOf(instance.id)).status).toBe('PENDING_AUTHORIZATION');
        expect(await activationPagePayments(instance.id)).toHaveLength(0);
        expect(
            (await heldPagePayments(instance.id)).map((row) => [
                row.payment.providerFactId,
                row.payment.amount,
                row.reason
            ])
        ).toEqual([[paid.chargeId, 10000, 'DIVERGENCIA_DE_MONTO']]);
        expect(await marksOf(instance.id)).toEqual([
            { reason: 'DIVERGENCIA_DE_MONTO', liftedAt: null }
        ]);
        const [event] = await markEventsOf(instance.id);
        expect(event?.changes).toEqual(
            expect.arrayContaining([
                { field: 'provider.charge_id', new: paid.chargeId },
                { field: 'reconciliation_mark.expected_minor', new: 12000 },
                { field: 'provider.charge_amount_minor', new: 10000 }
            ])
        );
    });

    it.skipIf(skip)('accumulates a repeated notice of one divergent payment', async () => {
        const s = await setup();
        const { instance, paymentPageId } = await bought(s);
        const paid = s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
        await priceIs(instance.productId, 12000);
        for (let i = 0; i < 2; i++)
            expect(
                await confirmOneTimePagePayment(
                    { instanceId: instance.id, chargeId: paid.chargeId },
                    s.ports
                )
            ).toEqual({ outcome: 'AMOUNT_MISMATCH' });
        expect(await marksOf(instance.id)).toEqual([
            { reason: 'DIVERGENCIA_DE_MONTO', liftedAt: null }
        ]);
        expect(await markEventsOf(instance.id)).toHaveLength(2);
    });

    it.skipIf(skip)('keeps one open divergence mark for two divergent payments', async () => {
        const s = await setup();
        const { instance, paymentPageId } = await bought(s);
        const first = s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
        const second = s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
        await priceIs(instance.productId, 12000);
        for (const paid of [first, second])
            expect(
                await confirmOneTimePagePayment(
                    { instanceId: instance.id, chargeId: paid.chargeId },
                    s.ports
                )
            ).toEqual({ outcome: 'AMOUNT_MISMATCH' });
        expect(await marksOf(instance.id)).toEqual([
            { reason: 'DIVERGENCIA_DE_MONTO', liftedAt: null }
        ]);
        const charged = (await markEventsOf(instance.id)).map(
            (event) =>
                (event.changes as readonly { field: string; new?: unknown }[]).find(
                    (change) => change.field === 'provider.charge_id'
                )?.new
        );
        expect(charged).toEqual([first.chargeId, second.chargeId]);
        expect((await instanceOf(instance.id)).status).toBe('PENDING_AUTHORIZATION');
    });

    it.skipIf(skip)(
        'activates a correct payment after a divergent one and keeps the divergence open',
        async () => {
            const s = await setup();
            const { instance, paymentPageId } = await bought(s);
            const divergent = s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
            await priceIs(instance.productId, 12000);
            expect(
                await confirmOneTimePagePayment(
                    { instanceId: instance.id, chargeId: divergent.chargeId },
                    s.ports
                )
            ).toEqual({ outcome: 'AMOUNT_MISMATCH' });
            expect((await instanceOf(instance.id)).status).toBe('PENDING_AUTHORIZATION');

            await priceIs(instance.productId, 10000);
            const correct = s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
            expect(
                await confirmOneTimePagePayment(
                    { instanceId: instance.id, chargeId: correct.chargeId },
                    s.ports
                )
            ).toMatchObject({ outcome: 'ACTIVATED' });
            expect((await instanceOf(instance.id)).status).toBe('ACTIVE');
            expect(
                (await activationPagePayments(instance.id)).map((p) => p.providerFactId)
            ).toEqual([correct.chargeId]);
            expect(
                (await heldPagePayments(instance.id)).map((row) => row.payment.providerFactId)
            ).toEqual([divergent.chargeId]);
            expect(await marksOf(instance.id)).toEqual([
                { reason: 'DIVERGENCIA_DE_MONTO', liftedAt: null }
            ]);
        }
    );

    it.skipIf(skip)('does not reopen a lifted divergence for the same charge', async () => {
        const s = await setup();
        const { instance, paymentPageId } = await bought(s);
        const paid = s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
        await priceIs(instance.productId, 12000);
        await confirmOneTimePagePayment(
            { instanceId: instance.id, chargeId: paid.chargeId },
            s.ports
        );
        await liftMarksOf(instance.id, instance.ownerId);

        expect(
            await confirmOneTimePagePayment(
                { instanceId: instance.id, chargeId: paid.chargeId },
                s.ports
            )
        ).toEqual({ outcome: 'AMOUNT_MISMATCH' });
        const marks = await marksOf(instance.id);
        expect(marks).toHaveLength(1);
        expect(marks[0]?.liftedAt).not.toBeNull();
    });

    it.skipIf(skip)('opens a new divergence for another charge after one was lifted', async () => {
        const s = await setup();
        const { instance, paymentPageId } = await bought(s);
        const first = s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
        const second = s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
        await priceIs(instance.productId, 12000);
        await confirmOneTimePagePayment(
            { instanceId: instance.id, chargeId: first.chargeId },
            s.ports
        );
        await liftMarksOf(instance.id, instance.ownerId);

        expect(
            await confirmOneTimePagePayment(
                { instanceId: instance.id, chargeId: second.chargeId },
                s.ports
            )
        ).toEqual({ outcome: 'AMOUNT_MISMATCH' });
        const marks = await marksOf(instance.id);
        expect(marks).toHaveLength(2);
        expect(marks.filter((mark) => mark.liftedAt === null)).toHaveLength(1);
        // The lifted mark names only the first charge: the open one still accumulates.
        await confirmOneTimePagePayment(
            { instanceId: instance.id, chargeId: second.chargeId },
            s.ports
        );
        expect(await markEventsOf(instance.id)).toHaveLength(3);
    });

    it.skipIf(skip)(
        'marks another amount as a divergence even after the purchase was abandoned',
        async () => {
            const s = await setup();
            const { instance, paymentPageId } = await bought(s);
            const paid = s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
            await getServiceTestDb()
                .update(addonProducts)
                .set({ price: 12000 })
                .where(eq(addonProducts.id, instance.productId));
            await abandonOneTimeAddon({
                instanceId: instance.id,
                expectedProviderOrderId: null,
                now: s.f.ports.clock.now()
            });
            expect(
                await confirmOneTimePagePayment(
                    { instanceId: instance.id, chargeId: paid.chargeId },
                    s.ports
                )
            ).toEqual({ outcome: 'AMOUNT_MISMATCH' });
            expect(await marksOf(instance.id)).toEqual([
                { reason: 'DIVERGENCIA_DE_MONTO', liftedAt: null }
            ]);
        }
    );

    it.skipIf(skip)('leaves another amount undecided when its mark cannot open', async () => {
        const s = await setup();
        const { instance, paymentPageId } = await bought(s);
        const paid = s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
        await getServiceTestDb()
            .update(addonProducts)
            .set({ price: 12000 })
            .where(eq(addonProducts.id, instance.productId));
        await refuseMarksFor(instance.id, async () => {
            expect(
                await confirmOneTimePagePayment(
                    { instanceId: instance.id, chargeId: paid.chargeId },
                    s.ports
                )
            ).toEqual({ outcome: 'UNKNOWN' });
        });
        expect((await instanceOf(instance.id)).status).toBe('PENDING_AUTHORIZATION');
        expect(await marksOf(instance.id)).toHaveLength(0);
    });

    it.skipIf(skip)('refuses a payment of another purchase', async () => {
        const s = await setup();
        const { instance } = await bought(s);
        const t = await setup();
        const foreign = await bought(t);
        const paid = t.f.fake.payOnPage({
            paymentPageId: foreign.paymentPageId,
            outcome: 'approved'
        });
        const sharedFake = { ...s.ports, provider: t.f.fake };
        expect(
            await confirmOneTimePagePayment(
                { instanceId: instance.id, chargeId: paid.chargeId },
                sharedFake
            )
        ).toEqual({ outcome: 'NOT_THIS_PURCHASE' });
        expect((await instanceOf(instance.id)).status).toBe('PENDING_AUTHORIZATION');
    });

    it.skipIf(skip)('refuses a payment that hangs from an authorization', async () => {
        const s = await setup();
        const { instance, paymentPageId } = await bought(s);
        const paid = s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
        const original = s.f.fake.readCharge.bind(s.f.fake);
        vi.spyOn(s.f.fake, 'readCharge').mockImplementationOnce(async (ref) => {
            const read = await original(ref);
            return { ...read, snapshot: { ...read.snapshot, authorizationId: 'auth-1' } };
        });
        expect(
            await confirmOneTimePagePayment(
                { instanceId: instance.id, chargeId: paid.chargeId },
                s.ports
            )
        ).toEqual({ outcome: 'NOT_THIS_PURCHASE' });
        expect(await paymentsOf(instance.id)).toHaveLength(0);
    });

    it.skipIf(skip)('decides nothing when the read does not answer', async () => {
        const s = await setup();
        const { instance } = await bought(s);
        expect(
            await confirmOneTimePagePayment(
                { instanceId: instance.id, chargeId: 'charge-unknown' },
                s.ports
            )
        ).toEqual({ outcome: 'UNKNOWN' });
        expect((await instanceOf(instance.id)).status).toBe('PENDING_AUTHORIZATION');
    });
});

describe('HOS-2179 §5.4 A3 confirms by search and re-read, or abandons and closes', () => {
    const windowEnd = () => new Date(purchaseNow.getTime() + 120 * MINUTE);

    it.skipIf(skip)('leaves the purchase alone until page plus margin elapsed', async () => {
        const s = await setup();
        const { instance } = await bought(s);
        s.f.advanceTo(new Date(windowEnd().getTime() - 1));
        const search = vi.spyOn(s.f.fake, 'searchCharges');
        await expireAddonAuthorizationWindows(100, s.ports);
        expect(search).not.toHaveBeenCalled();
        expect((await instanceOf(instance.id)).status).toBe('PENDING_AUTHORIZATION');
    });

    it.skipIf(skip)('abandons with no approved payment and closes the page', async () => {
        const s = await setup();
        const { instance, paymentPageId } = await bought(s);
        s.f.fake.payOnPage({ paymentPageId, outcome: 'rejected' });
        s.f.advanceTo(windowEnd());
        const close = vi.spyOn(s.f.fake, 'closeOneTimePayment');
        const search = vi.spyOn(s.f.fake, 'searchCharges');
        const summary = await expireAddonAuthorizationWindows(100, s.ports);
        expect(summary.abandoned).toBeGreaterThanOrEqual(1);
        expect(search).toHaveBeenCalledWith({
            reference: s.request.orderRequestId,
            createdFrom: new Date(purchaseNow.getTime() - 60 * MINUTE).toISOString(),
            createdTo: windowEnd().toISOString()
        });
        expect((await instanceOf(instance.id)).status).toBe('ABANDONED');
        // The page had expired on its own (60 min) before the window: nothing to close.
        expect(close).not.toHaveBeenCalled();
    });

    it.skipIf(skip)(
        'keeps a page purchase whose stored expiry has not passed when PLAZO 21 drops',
        async () => {
            const s = await setup();
            const { instance } = await bought(s);
            const current = await getCurrentBillingDeadlines();
            const lowered = {
                ...current,
                values: { ...current.values, '21': { pageMinutes: 10, windowMarginMinutes: 30 } }
            };
            // Today's PLAZO 21 would end the window at +40 min; the stored expiry (+60) plus the
            // margin (+30) ends it at +90.
            s.f.advanceTo(new Date(purchaseNow.getTime() + 50 * MINUTE));
            const search = vi.spyOn(s.f.fake, 'searchCharges');
            await expireAddonAuthorizationWindows(100, { ...s.ports, deadlines: lowered });
            expect(search).not.toHaveBeenCalled();
            expect((await instanceOf(instance.id)).status).toBe('PENDING_AUTHORIZATION');
            s.f.advanceTo(new Date(purchaseNow.getTime() + 90 * MINUTE));
            await expireAddonAuthorizationWindows(100, { ...s.ports, deadlines: lowered });
            expect((await instanceOf(instance.id)).status).toBe('ABANDONED');
        }
    );

    it.skipIf(skip)('waits for a later read-back expiry before abandoning', async () => {
        const s = await setup();
        const original = s.f.fake.requestOneTimePayment.bind(s.f.fake);
        vi.spyOn(s.f.fake, 'requestOneTimePayment').mockImplementationOnce(async (input) => ({
            ...(await original(input)),
            expiresAt: new Date(purchaseNow.getTime() + 86_400_000).toISOString()
        }));
        const { instance } = await bought(s);
        // A3 waits for the stored expiry plus the margin, not for today's page duration.
        s.f.advanceTo(new Date(purchaseNow.getTime() + 86_400_000 + 60 * MINUTE - 1));
        const early = vi.spyOn(s.f.fake, 'searchCharges');
        await expireAddonAuthorizationWindows(100, s.ports);
        expect(early).not.toHaveBeenCalled();
        expect((await instanceOf(instance.id)).status).toBe('PENDING_AUTHORIZATION');
        s.f.advanceTo(new Date(purchaseNow.getTime() + 86_400_000 + 60 * MINUTE));
        // The stored expiry has passed, so the page already takes no payment: nothing to close.
        const close = vi.spyOn(s.f.fake, 'closeOneTimePayment');
        await expireAddonAuthorizationWindows(100, s.ports);
        expect((await instanceOf(instance.id)).status).toBe('ABANDONED');
        expect(close).not.toHaveBeenCalled();
    });

    it.skipIf(skip)('activates through A2 when the search finds an approved payment', async () => {
        const s = await setup();
        const { instance, paymentPageId } = await bought(s);
        s.f.fake.payOnPage({ paymentPageId, outcome: 'rejected' });
        const paid = s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
        s.f.advanceTo(windowEnd());
        const summary = await expireAddonAuthorizationWindows(100, s.ports);
        expect(summary.activated).toBeGreaterThanOrEqual(1);
        expect((await instanceOf(instance.id)).status).toBe('ACTIVE');
        expect((await paymentsOf(instance.id)).map((p) => p.providerFactId)).toEqual([
            paid.chargeId
        ]);
    });

    it.skipIf(skip)('defers when the search does not answer', async () => {
        const s = await setup();
        const { instance } = await bought(s);
        s.f.advanceTo(windowEnd());
        vi.spyOn(s.f.fake, 'searchCharges').mockRejectedValue(
            new PaymentProviderError({ code: 'UNAVAILABLE', capability: 'read', message: 'down' })
        );
        const summary = await expireAddonAuthorizationWindows(100, s.ports);
        expect(summary.deferred).toBeGreaterThanOrEqual(1);
        expect((await instanceOf(instance.id)).status).toBe('PENDING_AUTHORIZATION');
    });

    it.skipIf(skip)('defers another amount whose mark cannot open', async () => {
        const s = await setup();
        const { instance, paymentPageId } = await bought(s);
        s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
        await getServiceTestDb()
            .update(addonProducts)
            .set({ price: 12000 })
            .where(eq(addonProducts.id, instance.productId));
        s.f.advanceTo(windowEnd());
        await refuseMarksFor(instance.id, async () => {
            await expireAddonAuthorizationWindows(100, s.ports);
        });
        expect((await instanceOf(instance.id)).status).toBe('PENDING_AUTHORIZATION');
        expect(await marksOf(instance.id)).toHaveLength(0);
    });

    it.skipIf(skip)(
        'abandons once another amount is marked, instead of waiting forever',
        async () => {
            const s = await setup();
            const { instance, paymentPageId } = await bought(s);
            s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
            await getServiceTestDb()
                .update(addonProducts)
                .set({ price: 12000 })
                .where(eq(addonProducts.id, instance.productId));
            s.f.advanceTo(windowEnd());
            await expireAddonAuthorizationWindows(100, s.ports);
            expect((await instanceOf(instance.id)).status).toBe('ABANDONED');
            expect(await activationPagePayments(instance.id)).toHaveLength(0);
            expect(await heldPagePayments(instance.id)).toHaveLength(1);
            expect(await marksOf(instance.id)).toEqual([
                { reason: 'DIVERGENCIA_DE_MONTO', liftedAt: null }
            ]);
        }
    );
});

describe('HOS-2179 §5.7 closing a page', () => {
    it.skipIf(skip)('never closes the page of a purchase still waiting', async () => {
        const s = await setup();
        const { instance } = await bought(s);
        const close = vi.spyOn(s.f.fake, 'closeOneTimePayment');
        expect(await closeOneTimePaymentPage({ instanceId: instance.id }, s.f.ports)).toBe(
            'NOT_NEEDED'
        );
        expect(close).not.toHaveBeenCalled();
    });

    it.skipIf(skip)('closes an abandoned purchase page and confirms by re-reading', async () => {
        const s = await setup();
        const { instance, paymentPageId } = await bought(s);
        await abandonOneTimeAddon({
            instanceId: instance.id,
            expectedProviderOrderId: null,
            now: s.f.ports.clock.now()
        });
        s.f.advanceTo(new Date(purchaseNow.getTime() + 5 * MINUTE));
        const read = vi.spyOn(s.f.fake, 'readOneTimePayment');
        expect(await closeOneTimePaymentPage({ instanceId: instance.id }, s.f.ports)).toBe(
            'CLOSED'
        );
        expect(read).toHaveBeenCalledWith({ paymentPageId });
        expect((await instanceOf(instance.id)).paymentPageExpiresAt).toEqual(s.f.ports.clock.now());
        expect(await closeOneTimePaymentPage({ instanceId: instance.id }, s.f.ports)).toBe(
            'NOT_NEEDED'
        );
    });

    it.skipIf(skip)('reports an unconfirmed close without touching the instance', async () => {
        const s = await setup();
        const { instance } = await bought(s);
        await abandonOneTimeAddon({
            instanceId: instance.id,
            expectedProviderOrderId: null,
            now: s.f.ports.clock.now()
        });
        vi.spyOn(s.f.fake, 'closeOneTimePayment').mockResolvedValueOnce({
            accepted: true,
            resourceId: instance.paymentPageId ?? ''
        });
        expect(await closeOneTimePaymentPage({ instanceId: instance.id }, s.f.ports)).toBe(
            'UNCONFIRMED'
        );
        expect((await instanceOf(instance.id)).paymentPageExpiresAt).toEqual(
            instance.paymentPageExpiresAt
        );
        vi.spyOn(s.f.fake, 'closeOneTimePayment').mockRejectedValueOnce(new Error('down'));
        expect(await closeOneTimePaymentPage({ instanceId: instance.id }, s.f.ports)).toBe(
            'UNCONFIRMED'
        );
    });
});
