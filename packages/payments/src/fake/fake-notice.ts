/**
 * The wire formats of the fake provider's notices: a body carrying only what a
 * notice may carry (kind, id, version), validated on the way in.
 *
 * Two formats, because the real provider sends two (M6: a refund arrives as
 * three deliveries in two formats): a JSON body, and a form-encoded one. The
 * `content-type` header says which. Either way, unknown fields are refused: a
 * notice never carries state (GUARD:G17).
 */
import { z } from 'zod';
import { PaymentProviderError } from '../provider/errors';
import type { NoticeDelivery, ProviderNotice } from '../provider/payment-provider';

/** The two body formats the fake sends. */
export type FakeNoticeFormat = 'json' | 'form';

/** The content type of each format. */
export const FAKE_NOTICE_CONTENT_TYPES: Readonly<Record<FakeNoticeFormat, string>> = Object.freeze({
    json: 'application/json',
    form: 'application/x-www-form-urlencoded'
});

/** A notice as the fake serialises it. Unknown fields are refused. */
export const FakeNoticeBodySchema: z.ZodType<ProviderNotice> = z.strictObject({
    resourceKind: z.enum(['authorization', 'charge', 'refund']),
    resourceId: z.string().trim().min(1),
    version: z.string().trim().min(1)
});

/**
 * Serialises a notice into a JSON delivery body.
 *
 * @param args.notice - The notice to send
 * @returns The JSON body
 */
export function encodeFakeNoticeBody(args: { readonly notice: ProviderNotice }): {
    readonly body: string;
} {
    return { body: JSON.stringify(args.notice) };
}

/**
 * Serialises a notice into a body of the given format.
 *
 * @param args.notice - The notice to send
 * @param args.format - The body format
 * @returns The body and its content type
 */
export function encodeFakeNotice(args: {
    readonly notice: ProviderNotice;
    readonly format: FakeNoticeFormat;
}): { readonly body: string; readonly contentType: string } {
    const body =
        args.format === 'json'
            ? encodeFakeNoticeBody({ notice: args.notice }).body
            : new URLSearchParams({ ...args.notice }).toString();
    return { body, contentType: FAKE_NOTICE_CONTENT_TYPES[args.format] };
}

/**
 * Parses a JSON delivery body back into a notice.
 *
 * @param args.body - The raw body
 * @returns The notice
 * @throws PaymentProviderError with code `INVALID_NOTICE` for anything else
 */
export function decodeFakeNoticeBody(args: { readonly body: string }): {
    readonly notice: ProviderNotice;
} {
    let parsed: unknown;
    try {
        parsed = JSON.parse(args.body);
    } catch (cause) {
        throw invalidNotice({ message: 'the body is not JSON', cause });
    }
    return { notice: validated({ parsed }) };
}

/**
 * Parses a delivery of either format back into a notice, by its content type.
 *
 * @param args.delivery - The delivery as it reached the receiver
 * @returns The notice
 * @throws PaymentProviderError with code `INVALID_NOTICE` for anything else
 */
export function decodeFakeNotice(args: { readonly delivery: NoticeDelivery }): {
    readonly notice: ProviderNotice;
} {
    const contentType = Object.entries(args.delivery.headers).find(
        ([name]) => name.toLowerCase() === 'content-type'
    )?.[1];
    if (contentType?.startsWith(FAKE_NOTICE_CONTENT_TYPES.form)) {
        return {
            notice: validated({
                parsed: Object.fromEntries(new URLSearchParams(args.delivery.body))
            })
        };
    }
    return decodeFakeNoticeBody({ body: args.delivery.body });
}

function validated(args: { readonly parsed: unknown }): ProviderNotice {
    const result = FakeNoticeBodySchema.safeParse(args.parsed);
    if (!result.success) {
        throw invalidNotice({ message: z.prettifyError(result.error), cause: result.error });
    }
    return result.data;
}

function invalidNotice(args: {
    readonly message: string;
    readonly cause: unknown;
}): PaymentProviderError {
    return new PaymentProviderError({
        code: 'INVALID_NOTICE',
        capability: 'notify',
        message: args.message,
        cause: args.cause
    });
}
