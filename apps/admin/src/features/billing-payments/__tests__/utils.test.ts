/**
 * Regression tests for the admin billing payments vocabulary bug.
 *
 * The old `PaymentStatus` union only knew `'completed' | 'pending' | 'failed' |
 * 'refunded'`, but the real `billing_payments.status` column (and the new
 * `AdminPaymentViewStatusSchema` contract) never emits `'completed'` — it emits
 * `'succeeded'`. Looking up an unmapped status in a plain object returns
 * `undefined` at runtime regardless of what TypeScript's types claim, so this
 * silently blanked out the Estado column and the badge for every payment that
 * ever existed.
 *
 * Also covers the second half of the bug: `formatArs` received integer
 * centavos but never divided by 100, so a real payment (1800000 centavos =
 * $18.000,00 ARS) rendered as "$ 1.800.000,00".
 */

import type { AdminPaymentViewStatus } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { formatArsFromCents, getStatusLabel, getStatusVariant } from '../utils';

/** Every status value the contract actually declares (AdminPaymentViewStatusSchema). */
const ALL_PAYMENT_STATUSES: AdminPaymentViewStatus[] = [
    'succeeded',
    'pending',
    'processing',
    'failed',
    'canceled',
    'refunded',
    'partially_refunded'
];

describe('billing-payments utils — status vocabulary', () => {
    it.each(
        ALL_PAYMENT_STATUSES
    )('returns a defined badge variant and label for status "%s"', (status) => {
        expect(getStatusVariant(status)).toBeDefined();
        const label = getStatusLabel(status, (key) => key);
        expect(label).toBeDefined();
        expect(label).not.toBe('');
    });

    it('maps "succeeded" — the value the API actually sends — to the success variant', () => {
        // Regression: the old map only had `completed`, which the API never sends.
        // `succeeded` used to fall through to `undefined`.
        expect(getStatusVariant('succeeded')).toBe('success');
    });
});

describe('billing-payments utils — money is centavos', () => {
    it('divides by 100 before formatting: 1800000 centavos is $18.000,00, not $1.800.000,00', () => {
        const formatted = formatArsFromCents(1800000, 'es-AR');
        expect(formatted).toContain('18.000');
        expect(formatted).not.toContain('1.800.000');
    });

    it('renders "$ 0,00" for zero centavos, and handles null gracefully', () => {
        expect(formatArsFromCents(0, 'es-AR')).toContain('0,00');
        expect(formatArsFromCents(null, 'es-AR')).toContain('0,00');
    });
});
