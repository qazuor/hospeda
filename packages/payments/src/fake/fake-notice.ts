/**
 * The wire format of the fake provider's notices: a JSON body carrying only
 * what a notice may carry (kind, id, version), validated on the way in.
 */
import { z } from 'zod';
import { PaymentProviderError } from '../provider/errors';
import type { ProviderNotice } from '../provider/payment-provider';

/** A notice as the fake serialises it. Unknown fields are refused. */
export const FakeNoticeBodySchema: z.ZodType<ProviderNotice> = z.strictObject({
    resourceKind: z.enum(['authorization', 'charge', 'refund']),
    resourceId: z.string().trim().min(1),
    version: z.string().trim().min(1)
});

/**
 * Serialises a notice into a delivery body.
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
 * Parses a delivery body back into a notice.
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
    const result = FakeNoticeBodySchema.safeParse(parsed);
    if (!result.success) {
        throw invalidNotice({ message: z.prettifyError(result.error), cause: result.error });
    }
    return { notice: result.data };
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
