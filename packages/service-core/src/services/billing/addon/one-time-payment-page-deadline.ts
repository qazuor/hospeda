import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../../types';
import type { getCurrentBillingDeadlines } from '../deadlines/billing-deadlines.service';

/** The billing deadline version as the services read it. */
export type BillingDeadlinesRow = Awaited<ReturnType<typeof getCurrentBillingDeadlines>>;

const MINUTE_MS = 60_000;

/** The one-time payment page timing of PLAZO:21 (HOS-2179 §5.2, P-2), in milliseconds. */
export interface PaymentPageTiming {
    /** How long a page takes payments after the purchase is created. */
    readonly pageMs: number;
    /** How long the purchase waits once the page stopped taking payments. */
    readonly windowMarginMs: number;
}

/**
 * Reads PLAZO:21 from a deadline version. The values live only in the catalog (G7): a version
 * without them cannot open a page, and that is a configuration failure, not a constant default.
 *
 * @param deadlines - The deadline version in force
 * @returns The page duration and the window margin, in milliseconds
 * @throws ServiceError `CONFIGURATION_ERROR` (`PAYMENT_PAGE_DEADLINE_MISSING`) without PLAZO:21
 */
export function paymentPageTiming(deadlines: BillingDeadlinesRow): PaymentPageTiming {
    const timing = optionalPaymentPageTiming(deadlines);
    if (!timing)
        throw new ServiceError(
            ServiceErrorCode.CONFIGURATION_ERROR,
            'The billing deadlines carry no one-time payment page timing (PLAZO 21)',
            undefined,
            'PAYMENT_PAGE_DEADLINE_MISSING'
        );
    return timing;
}

/**
 * PLAZO:21 when the version carries it, otherwise null. A3 uses this form: without the
 * timing it cannot tell when a page purchase ends, so it leaves those purchases pending.
 *
 * @param deadlines - The deadline version in force
 * @returns The timing, or null when the version has no PLAZO:21
 */
export function optionalPaymentPageTiming(
    deadlines: BillingDeadlinesRow
): PaymentPageTiming | null {
    const value = deadlines.values['21'];
    if (!value) return null;
    return {
        pageMs: value.pageMinutes * MINUTE_MS,
        windowMarginMs: value.windowMarginMinutes * MINUTE_MS
    };
}

/**
 * When a page purchase's page stops taking payments: its creation plus the page duration.
 * Derived from the instance, never from the clock at the call, so a repeated creation after a
 * lost answer sends the same expiry (§5.6).
 *
 * @param input.createdAt - When the purchase instance was created
 * @param input.timing - PLAZO:21
 * @returns The page expiry
 */
export function paymentPageExpiry(input: {
    readonly createdAt: Date;
    readonly timing: PaymentPageTiming;
}): Date {
    return new Date(input.createdAt.getTime() + input.timing.pageMs);
}
