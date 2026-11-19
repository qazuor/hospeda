/**
 * The fake payment screen the fake `init_point` opens (HOS-2179 §7.3): two buttons,
 * approve and reject, so a Playwright e2e can pay a page without the real sandbox.
 * It needs no `Authorization` header: a browser opens it, like Mercado Pago's page.
 *
 * - An approved payment redirects to the page's return link with the parameters
 *   Mercado Pago adds (RP20). They are what the browser writes, so the domain
 *   ignores them and re-reads the payment by id.
 * - A rejected payment stays on the screen to retry (binary mode, P-6), with a link
 *   back carrying `status=rejected`.
 * - An expired page shows a fatal screen and creates no payment (RP19).
 */
import type { FakePaymentProvider } from '../fake/fake-payment-provider';
import { PaymentProviderError } from '../provider/errors';
import { FAKE_PAYMENT_SCREEN_PATH } from './payment-pages-route';

/** What the screen answers: an HTML page or a redirect. */
export interface PaymentScreenResponse {
    readonly status: number;
    readonly headers: Readonly<Record<string, string>>;
    readonly body: string;
}

const HTML = { 'content-type': 'text/html; charset=utf-8' } as const;

function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

/** The return link with the RP20 parameters, as Mercado Pago builds it. */
export function fakeReturnUrl(args: {
    readonly returnUrl: string;
    readonly chargeId: string;
    readonly status: string;
    readonly reference: string;
    readonly paymentPageId: string;
}): string {
    const url = new URL(args.returnUrl);
    url.searchParams.set('payment_id', args.chargeId);
    url.searchParams.set('status', args.status);
    url.searchParams.set('external_reference', args.reference);
    // RP18: every payment has its own merchant order.
    url.searchParams.set('merchant_order_id', `fake-merchant-order-${args.chargeId}`);
    url.searchParams.set('preference_id', args.paymentPageId);
    return url.toString();
}

function screen(args: {
    readonly title: string;
    readonly paymentPageId: string;
    readonly notice?: string;
    readonly back?: string;
}): string {
    const action = `${FAKE_PAYMENT_SCREEN_PATH}${encodeURIComponent(args.paymentPageId)}/pay`;
    return [
        '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Fake payment</title></head><body>',
        `<h1>${escapeHtml(args.title)}</h1>`,
        args.notice ? `<p role="alert">${escapeHtml(args.notice)}</p>` : '',
        `<form method="post" action="${action}?outcome=approved"><button type="submit">Aprobar pago</button></form>`,
        `<form method="post" action="${action}?outcome=rejected"><button type="submit">Rechazar pago</button></form>`,
        args.back ? `<a href="${escapeHtml(args.back)}">Volver al sitio</a>` : '',
        '</body></html>'
    ].join('');
}

const FATAL: PaymentScreenResponse = {
    status: 200,
    headers: HTML,
    body: '<!doctype html><html lang="es"><body><h1>Algo salió mal</h1></body></html>'
};

/** Serves `GET /fake-checkout/{id}` and `POST /fake-checkout/{id}/pay?outcome=`; null otherwise. */
export function handlePaymentPageScreen(args: {
    readonly provider: FakePaymentProvider;
    readonly method: string;
    readonly url: URL;
    readonly now: Date;
}): PaymentScreenResponse | null {
    if (!args.url.pathname.startsWith(FAKE_PAYMENT_SCREEN_PATH)) return null;
    const match = /^\/fake-checkout\/([^/]+)(\/pay)?$/.exec(args.url.pathname);
    if (!match) return null;
    const paymentPageId = decodeURIComponent(match[1] ?? '');
    try {
        const page = args.provider.paymentPage({ paymentPageId });
        const expiresAt = page.snapshot.expiresAt;
        if (expiresAt !== null && Date.parse(expiresAt) <= args.now.getTime()) return FATAL;
        if (!match[2] && args.method === 'GET')
            return {
                status: 200,
                headers: HTML,
                body: screen({ title: page.reason, paymentPageId })
            };
        const outcome = args.url.searchParams.get('outcome');
        if (args.method !== 'POST' || (outcome !== 'approved' && outcome !== 'rejected'))
            return { status: 400, headers: HTML, body: 'invalid payment request' };
        const paid = args.provider.payOnPage({ paymentPageId, outcome });
        const back = fakeReturnUrl({ ...paid, paymentPageId });
        if (paid.status === 'approved')
            return { status: 302, headers: { location: back }, body: '' };
        const notice = 'Tu pago fue rechazado. Podés intentar con otro medio.';
        return {
            status: 200,
            headers: HTML,
            body: screen({ title: page.reason, paymentPageId, notice, back })
        };
    } catch (error) {
        if (!(error instanceof PaymentProviderError)) throw error;
        if (error.code === 'NOT_FOUND') return { status: 404, headers: HTML, body: 'not found' };
        // RP19: an expired page takes no payment.
        return FATAL;
    }
}
