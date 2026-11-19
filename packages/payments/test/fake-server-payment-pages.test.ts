/**
 * HOS-2179 §7.3 (T-1): the Mercado Pago adapter against the fake HTTP server's
 * preference routes and its fake payment screen. Paying on the screen redirects with
 * the RP20 parameters; a second payment gets its own merchant order (RP18); a closed
 * page shows the fatal screen and creates no payment (RP19).
 */
import { createAdjustableClock } from '@repo/test-clock';
import { afterEach, describe, expect, it } from 'vitest';
import { buildMercadoPagoPaymentPageBody } from '../src/adapters/mercadopago/mercadopago-payment-page';
import { FakePaymentProvider } from '../src/fake';
import { DEFAULT_FAKE_PAYMENT_SCREEN_ORIGIN, startFakeProviderServer } from '../src/fake-server';
import { handlePaymentPagesRoute } from '../src/fake-server/payment-pages-route';
import { MercadoPagoPaymentProvider, sanitizeApprovalUrl } from '../src/index';

const START = new Date('2026-11-19T12:00:00.000Z');
const RETURN = 'https://hospeda.example/mi-cuenta/complementos/?compra=purchase-1';
const servers: Array<{ close(): Promise<void> }> = [];
afterEach(async () => Promise.all(servers.splice(0).map((server) => server.close())));

async function setup(args: { readonly paymentScreenOrigin?: string } = {}) {
    const clock = createAdjustableClock({ start: START });
    const fake = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
    const server = await startFakeProviderServer({ provider: fake, clock, ...args });
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
    /** The advertised https link forwarded to this server, as the browser test intercepts it. */
    const screen = (path = '') => {
        const advertised = new URL(`${page.approvalUrl}${path}`);
        return `${server.url}${advertised.pathname}${advertised.search}`;
    };
    return { clock, fake, server, adapter, page, screen };
}

/** Presses one button of the fake payment screen, as a browser would. */
async function pay(screen: (path?: string) => string, outcome: 'approved' | 'rejected') {
    return fetch(screen(`/pay?outcome=${outcome}`), { method: 'POST', redirect: 'manual' });
}

describe('the fake HTTP server serves one-time payment pages', () => {
    it('creates and reads a page through the adapter, linking to its own payment screen', async () => {
        // Arrange
        const { adapter, page, screen: link } = await setup();

        // Act
        const read = await adapter.readOneTimePayment({ paymentPageId: page.paymentPageId });
        const screen = await fetch(link());

        // Assert
        expect(page.approvalUrl).toBe(
            `${DEFAULT_FAKE_PAYMENT_SCREEN_ORIGIN}/fake-checkout/${page.paymentPageId}`
        );
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
        const { adapter, page, screen } = await setup();

        // Act
        const first = await pay(screen, 'approved');
        const second = await pay(screen, 'approved');

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
        const { adapter, screen } = await setup();
        const response = await pay(screen, 'rejected');
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
        const { clock, adapter, page, screen: link } = await setup();
        clock.advance({ ms: 5 * 60_000 });

        // Act
        await adapter.closeOneTimePayment({ paymentPageId: page.paymentPageId });
        const read = await adapter.readOneTimePayment({ paymentPageId: page.paymentPageId });
        const screen = await fetch(link());
        const attempt = await pay(link, 'approved');

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

    it('advertises an https link that passes sanitizeApprovalUrl unchanged (G10)', async () => {
        const { page } = await setup();
        expect(sanitizeApprovalUrl(page)).toEqual({ url: page.approvalUrl });
    });

    it('advertises a configured https origin, still accepted by the sanitizer', async () => {
        const { page } = await setup({ paymentScreenOrigin: 'https://pay.e2e.test:8443' });
        expect(page.approvalUrl).toBe(
            `https://pay.e2e.test:8443/fake-checkout/${page.paymentPageId}`
        );
        expect(sanitizeApprovalUrl(page).url).toBe(page.approvalUrl);
    });

    it.each([
        'http://127.0.0.1:18090',
        'https://pay.e2e.test/base',
        'https://pay.e2e.test/?x=1',
        'https://user:pass@pay.e2e.test',
        'not a url'
    ])('refuses to start with the screen origin %s', async (paymentScreenOrigin) => {
        const clock = createAdjustableClock({ start: START });
        const fake = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
        await expect(
            startFakeProviderServer({ provider: fake, clock, paymentScreenOrigin })
        ).rejects.toThrow(/must be a bare https origin/);
    });
});

describe('the fake refuses a preference body that drifts from §5.1', () => {
    const exact = buildMercadoPagoPaymentPageBody({
        input: {
            reference: 'purchase-9',
            idempotencyKey: 'page:purchase-9',
            amount: { amountMinor: 10_000, currency: 'ARS' },
            reason: 'Destacado',
            returnUrl: RETURN,
            expiresAt: new Date(START.getTime() + 60 * 60_000).toISOString()
        },
        now: START
    });
    async function create(body: unknown) {
        const clock = createAdjustableClock({ start: START });
        const fake = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
        return handlePaymentPagesRoute({
            provider: fake,
            method: 'POST',
            url: new URL('http://fake.invalid/checkout/preferences'),
            headers: {},
            body,
            now: START
        });
    }

    it('accepts the exact body the adapter builds', async () => {
        expect((await create(exact))?.status).toBe(201);
    });

    it.each([
        ['a payer (P-8)', { ...exact, payer: { email: 'someone@example.test' } }],
        ['a notification url (EX-61)', { ...exact, notification_url: 'https://x.example/hook' }],
        ['an unknown field', { ...exact, statement_descriptor: 'HOSPEDA' }],
        ['no binary mode (P-6)', { ...exact, binary_mode: undefined }],
        [
            'more than one installment (P-10)',
            {
                ...exact,
                payment_methods: { ...(exact.payment_methods as object), installments: 3 }
            }
        ],
        [
            'a pending back url missing',
            { ...exact, back_urls: { success: RETURN, failure: RETURN } }
        ]
    ])('refuses %s', async (_, body) => {
        expect(await create(body)).toEqual({ status: 400, body: { message: 'invalid_body' } });
    });
});
