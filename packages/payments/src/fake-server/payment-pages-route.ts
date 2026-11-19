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

const CreateBodySchema = z.object({
    external_reference: z.string().min(1),
    items: z
        .array(
            z.object({
                title: z.string().min(1),
                quantity: z.literal(1),
                unit_price: z.number().positive(),
                currency_id: z.string().regex(/^[A-Z]{3}$/)
            })
        )
        .length(1),
    back_urls: z.object({ success: z.url() }),
    expires: z.literal(true),
    expiration_date_to: z.string().min(1)
});

const UpdateBodySchema = z.strictObject({
    expires: z.literal(true).optional(),
    expiration_date_to: z.string().min(1)
});

/** The screen link for a page, on the host the request came to. */
export function fakePaymentScreenUrl(args: {
    readonly headers: IncomingHttpHeaders;
    readonly paymentPageId: string;
}): string {
    const host = args.headers.host ?? '127.0.0.1';
    return `http://${host}${FAKE_PAYMENT_SCREEN_PATH}${encodeURIComponent(args.paymentPageId)}`;
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
}): Promise<{ readonly status: number; readonly body: unknown } | null> {
    const { provider, headers } = args;
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
        const initPoint = fakePaymentScreenUrl({ headers, paymentPageId });
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
    const initPoint = fakePaymentScreenUrl({ headers, paymentPageId });
    return { status: 200, body: serializePage({ snapshot: read.snapshot, initPoint }) };
}
