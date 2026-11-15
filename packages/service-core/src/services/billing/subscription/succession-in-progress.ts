/** The successor state that keeps the predecessor checkout open. */
export const SUCCESSION_CHECKOUT_OPEN_STATUS = 'PENDING_AUTHORIZATION' as const;

/** Classify the successor state used by S1 when opening a checkout. */
export function isSuccessionCheckoutOpen(status: string | null): boolean {
    return status === SUCCESSION_CHECKOUT_OPEN_STATUS;
}
