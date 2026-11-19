/**
 * Mercado Pago-shaped Checkout Pro preferences over the fake (HOS-2179 §7.3):
 * `POST /checkout/preferences`, `GET` and `PUT /checkout/preferences/{id}`. The
 * `init_point` points at this server's own fake payment screen
 * (`payment-page-screen.ts`), so an e2e can pay without the real sandbox.
 */
import type { IncomingHttpHeaders } from 'node:http';
import { z } from 'zod';
import type { FakePaymentProvider } from '../fake/fake-payment-provider';
import type { PaymentPageSnapshot } from '../provider/payment-provider';

/** Path prefix of the fake payment screen the `init_point` opens. */
export const FAKE_PAYMENT_SCREEN_PATH = '/fake-checkout/';

const IdListSchema = z.array(z.strictObject({ id: z.string().min(1) }));

/**
 * The exact preference body of HOS-2179 §5.1, strict: an unknown field, a payer
 * (P-8) or a notification url (EX-61) is refused, so a drifting adapter fails here.
 */
const CreateBodySchema = z.strictObject({
    external_reference: z.string().min(1),
    items: z
        .array(
            z.strictObject({
                id: z.string().min(1),
                title: z.string().min(1),
                quantity: z.literal(1),
                unit_price: z.number().positive(),
                currency_id: z.string().regex(/^[A-Z]{3}$/)
            })
        )
        .length(1),
    back_urls: z.strictObject({ success: z.url(), pending: z.url(), failure: z.url() }),
    auto_return: z.literal('approved'),
    binary_mode: z.literal(true),
    payment_methods: z.strictObject({
        installments: z.literal(1),
        excluded_payment_types: IdListSchema,
        excluded_payment_methods: IdListSchema
    }),
    expires: z.literal(true),
    expiration_date_from: z.string().min(1),
    expiration_date_to: z.string().min(1)
});

const UpdateBodySchema = z.strictObject({
    expires: z.literal(true).optional(),
    expiration_date_to: z.string().min(1)
});

/**
 * The origin the `init_point` advertises by default. The approval link must be
 * https (`sanitizeApprovalUrl`, G10) while this server speaks plain http, so it
 * advertises an https origin and the screen is reached in one of two ways:
 * pass a real https origin that proxies to this server (`paymentScreenOrigin`),
 * or let the browser test intercept the advertised origin and forward each request
 * to `${server.url}` with the same path, keeping redirects unfollowed so the 302
 * back to the site reaches the browser (Playwright: `page.route(origin + '/**',
 * ...)` with `route.fetch({ url, maxRedirects: 0 })`). The screen's forms use
 * relative paths, so the interception also covers approve and reject.
 */
export const DEFAULT_FAKE_PAYMENT_SCREEN_ORIGIN = 'https://payments-fake.invalid';

/**
 * Validates a payment screen origin: an absolute https origin, nothing after the
 * host. Fails at server start rather than at the first payment.
 *
 * @throws {TypeError} When the origin is not https, carries a path, query or credentials
 */
export function fakePaymentScreenOrigin(origin?: string): string {
    const value = origin ?? DEFAULT_FAKE_PAYMENT_SCREEN_ORIGIN;
    const parsed = URL.canParse(value) ? new URL(value) : null;
    // A URL's origin drops credentials, path and query, so equality refuses all three.
    if (
        parsed === null ||
        parsed.protocol !== 'https:' ||
        parsed.origin !== value.replace(/\/$/, '')
    )
        throw new TypeError(`The fake payment screen origin must be a bare https origin: ${value}`);
    return parsed.origin;
}

/** The screen link for a page, on the advertised https origin. */
export function fakePaymentScreenUrl(args: {
    readonly origin: string;
    readonly paymentPageId: string;
}): string {
    return `${args.origin}${FAKE_PAYMENT_SCREEN_PATH}${encodeURIComponent(args.paymentPageId)}`;
}

function serializePage(args: {
    readonly snapshot: PaymentPageSnapshot;
    readonly initPoint: string;
}): Readonly<Record<string, unknown>> {
    const { snapshot } = args;
    return {
        id: snapshot.paymentPageId,
        external_reference: snapshot.reference,
        date_created: snapshot.createdAt,
        expires: snapshot.expiresAt !== null,
        expiration_date_from: snapshot.createdAt,
        expiration_date_to: snapshot.expiresAt,
        init_point: args.initPoint,
        sandbox_init_point: args.initPoint
    };
}

/** Serves the three preference routes; anything else is not this route's. */
export async function handlePaymentPagesRoute(args: {
    readonly provider: FakePaymentProvider;
    readonly method: string;
    readonly url: URL;
    readonly headers: IncomingHttpHeaders;
    readonly body: unknown;
    readonly now: Date;
    /** A bare https origin (`fakePaymentScreenOrigin`); defaults to the `.invalid` one. */
    readonly paymentScreenOrigin?: string;
}): Promise<{ readonly status: number; readonly body: unknown } | null> {
    const { provider, headers } = args;
    const origin = args.paymentScreenOrigin ?? DEFAULT_FAKE_PAYMENT_SCREEN_ORIGIN;
    if (args.method === 'POST' && args.url.pathname === '/checkout/preferences') {
        const parsed = CreateBodySchema.safeParse(args.body);
        if (!parsed.success) return { status: 400, body: { message: 'invalid_body' } };
        const body = parsed.data;
        const item = body.items[0];
        if (!item) return { status: 400, body: { message: 'invalid_body' } };
        const key = headers['x-idempotency-key'];
        const created = await provider.requestOneTimePayment({
            reference: body.external_reference,
            idempotencyKey: typeof key === 'string' && key.length > 0 ? key : crypto.randomUUID(),
            amount: { amountMinor: Math.round(item.unit_price * 100), currency: item.currency_id },
            reason: item.title,
            returnUrl: body.back_urls.success,
            expiresAt: body.expiration_date_to
        });
        const { paymentPageId } = created;
        const read = await provider.readOneTimePayment({ paymentPageId });
        const initPoint = fakePaymentScreenUrl({ origin, paymentPageId });
        return { status: 201, body: serializePage({ snapshot: read.snapshot, initPoint }) };
    }
    const match = /^\/checkout\/preferences\/([^/?]+)$/.exec(args.url.pathname);
    if (!match) return null;
    const paymentPageId = decodeURIComponent(match[1] ?? '');
    if (args.method === 'PUT') {
        const parsed = UpdateBodySchema.safeParse(args.body);
        // The fake supports only closing: moving the expiry to now or earlier.
        if (!parsed.success || Date.parse(parsed.data.expiration_date_to) > args.now.getTime())
            return { status: 400, body: { message: 'invalid_body' } };
        await provider.closeOneTimePayment({ paymentPageId });
    } else if (args.method !== 'GET') return null;
    const read = await provider.readOneTimePayment({ paymentPageId });
    const initPoint = fakePaymentScreenUrl({ origin, paymentPageId });
    return { status: 200, body: serializePage({ snapshot: read.snapshot, initPoint }) };
}
