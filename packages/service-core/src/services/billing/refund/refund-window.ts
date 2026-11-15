/** DEC-RF-007, MP:RF-3 UNKNOWN: documentation says 180 days from approval. We
 * measure from payment.factAt, which is never after approval, so this can only
 * stop offering a refund slightly early. */
export const PROVIDER_REFUND_WINDOW_DAYS = 180;

/** Returns the provider refund deadline and whether it remains open. */
export function providerRefundWindow(input: { readonly factAt: Date; readonly now: Date }): {
    readonly open: boolean;
    readonly closesAt: Date;
} {
    const closesAt = new Date(input.factAt.getTime() + PROVIDER_REFUND_WINDOW_DAYS * 86400000);
    return { open: input.now.getTime() < closesAt.getTime(), closesAt };
}
