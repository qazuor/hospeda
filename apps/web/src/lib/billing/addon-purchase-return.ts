import { z } from 'zod';

const OrderRequestId = z.uuid();

/** Parse the owner purchase identity from a return URL. */
export function parseReturnOrderRequestId(input: { readonly search: string }): string | null {
    const value = new URLSearchParams(input.search).get('compra');
    const parsed = OrderRequestId.safeParse(value);
    return parsed.success ? parsed.data : null;
}
