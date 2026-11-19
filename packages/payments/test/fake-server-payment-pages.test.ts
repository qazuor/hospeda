/**
 * HOS-2179 §7.3 (T-1): the Mercado Pago adapter against the fake HTTP server's
 * preference routes and its fake payment screen. Paying on the screen redirects with
 * the RP20 parameters; a second payment gets its own merchant order (RP18); a closed
 * page shows the fatal screen and creates no payment (RP19).
 */
import { createAdjustableClock } from '@repo/test-clock';
import { afterEach, describe, expect, it } from 'vitest';
import { FakePaymentProvider } from '../src/fake';
import { startFakeProviderServer } from '../src/fake-server';
import { handlePaymentPagesRoute } from '../src/fake-server/payment-pages-route';
import { MercadoPagoPaymentProvider } from '../src/index';

const START = new Date('2026-11-19T12:00:00.000Z');
const RETURN = 'https://hospeda.example/mi-cuenta/complementos/?compra=purchase-1';
const servers: Array<{ close(): Promise<void> }> = [];
afterEach(async () => Promise.all(servers.splice(0).map((server) => server.close())));

async function setup() {
    const clock = createAdjustableClock({ start: START });
    const fake = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
    const server = await startFakeProviderServer({ provider: fake, clock });
    servers.push(server);
    const adapter = new MercadoPagoPaymentProvider({
        clock,
        accessToken: 'test-token',
        baseUrl: server.url
    });
    const page = await adapter.requestOneTimePayment({
        reference: 'purchase-1',
        idempotencyKey: 'page:purchase-1',
        amount: { amountMinor: 1_250_000, currency: 'ARS' },
        reason: 'Destacado <7 días>',
        returnUrl: RETURN,
        expiresAt: new Date(START.getTime() + 60 * 60_000).toISOString()
    });
    return { clock, fake, server, adapter, page };
}

/** Presses one button of the fake payment screen, as a browser would. */
async function pay(approvalUrl: string, outcome: 'approved' | 'rejected') {
    return fetch(`${approvalUrl}/pay?outcome=${outcome}`, { method: 'POST', redirect: 'manual' });
}

describe('the fake HTTP server serves one-time payment pages', () => {
    it('creates and reads a page through the adapter, linking to its own payment screen', async () => {
        // Arrange
        const { server, adapter, page } = await setup();

        // Act
        const read = await adapter.readOneTimePayment({ paymentPageId: page.paymentPageId });
        const screen = await fetch(page.approvalUrl);

        // Assert
        expect(page.approvalUrl).toBe(`${server.url}/fake-checkout/${page.paymentPageId}`);
        expect(read.snapshot).toMatchObject({
            paymentPageId: page.paymentPageId,
            reference: 'purchase-1',
            expiresAt: page.expiresAt,
            createdAt: START.toISOString()
        });
        expect(screen.status).toBe(200);
        const html = await screen.text();
        expect(html).toContain('Destacado &#60;7 días&#62;');
        expect(html).toContain('outcome=approved');
        expect(html).toContain('outcome=rejected');
    });

    it('redirects an approved payment with the RP20 parameters, each payment its own merchant order (RP18)', async () => {
        // Arrange
        const { adapter, page } = await setup();

        // Act
        const first = await pay(page.approvalUrl, 'approved');
        const second = await pay(page.approvalUrl, 'approved');

        // Assert
        expect(first.status).toBe(302);
        const back = new URL(first.headers.get('location') ?? '');
        expect(`${back.origin}${back.pathname}`).toBe(
            'https://hospeda.example/mi-cuenta/complementos/'
        );
        expect(back.searchParams.get('compra')).toBe('purchase-1');
        expect(back.searchParams.get('status')).toBe('approved');
        expect(back.searchParams.get('external_reference')).toBe('purchase-1');
        expect(back.searchParams.get('preference_id')).toBe(page.paymentPageId);
        const paymentId = back.searchParams.get('payment_id') ?? '';
        const again = new URL(second.headers.get('location') ?? '');
        expect(again.searchParams.get('merchant_order_id')).not.toBe(
            back.searchParams.get('merchant_order_id')
        );
        const charge = await adapter.readCharge({ chargeId: paymentId });
        expect(charge.snapshot).toMatchObject({
            status: 'approved',
            reference: 'purchase-1',
            authorizationId: null,
            purpose: 'charge',
            amount: { amountMinor: 1_250_000, currency: 'ARS' }
        });
        const found = await adapter.searchCharges({
            reference: 'purchase-1',
            createdFrom: START.toISOString(),
            createdTo: new Date(START.getTime() + 60_000).toISOString()
        });
        expect(found.chargeIds).toEqual([paymentId, again.searchParams.get('payment_id')]);
    });

    it('keeps the customer on the screen after a rejection, with a way back', async () => {
        const { adapter, page } = await setup();
        const response = await pay(page.approvalUrl, 'rejected');
        expect(response.status).toBe(200);
        const html = await response.text();
        expect(html).toContain('role="alert"');
        expect(html).toContain('status=rejected');
        const found = await adapter.searchCharges({
            reference: 'purchase-1',
            createdFrom: START.toISOString(),
            createdTo: START.toISOString()
        });
        expect(found.chargeIds).toHaveLength(1);
        const [chargeId] = found.chargeIds;
        expect((await adapter.readCharge({ chargeId: chargeId ?? '' })).snapshot.status).toBe(
            'rejected'
        );
    });

    it('closes a page through the adapter; the screen turns fatal and takes no payment (RP19)', async () => {
        // Arrange
        const { clock, adapter, page } = await setup();
        clock.advance({ ms: 5 * 60_000 });

        // Act
        await adapter.closeOneTimePayment({ paymentPageId: page.paymentPageId });
        const read = await adapter.readOneTimePayment({ paymentPageId: page.paymentPageId });
        const screen = await fetch(page.approvalUrl);
        const attempt = await pay(page.approvalUrl, 'approved');

        // Assert
        expect(read.snapshot.expiresAt).toBe(clock.now().toISOString());
        expect(await screen.text()).toContain('Algo salió mal');
        expect(attempt.status).toBe(200);
        const found = await adapter.searchCharges({
            reference: 'purchase-1',
            createdFrom: START.toISOString(),
            createdTo: clock.now().toISOString()
        });
        expect(found.chargeIds).toEqual([]);
    });

    it('refuses a preference update that is not a close', async () => {
        const { fake, page } = await setup();
        const answer = await handlePaymentPagesRoute({
            provider: fake,
            method: 'PUT',
            url: new URL(`http://fake.invalid/checkout/preferences/${page.paymentPageId}`),
            headers: {},
            body: { expiration_date_to: '2027-01-01T00:00:00.000Z' },
            now: START
        });
        expect(answer?.status).toBe(400);
        expect(
            (await fake.readOneTimePayment({ paymentPageId: page.paymentPageId })).snapshot
                .expiresAt
        ).toBe(page.expiresAt);
    });

    it('still requires credentials on the preference API, though not on the screen', async () => {
        const { server, page } = await setup();
        const response = await fetch(`${server.url}/checkout/preferences/${page.paymentPageId}`);
        expect(response.status).toBe(401);
    });
});
