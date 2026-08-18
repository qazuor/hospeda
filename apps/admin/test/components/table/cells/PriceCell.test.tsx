/**
 * PriceCell tests — currency fallback formatting (H-167).
 *
 * H-167: 2 legacy accommodations in prod store `{"price": N}` with no
 * `currency` sibling. Before this fix, a missing `currency` fell into the
 * `default` branch of `formatPrice`, which is byte-for-byte identical to the
 * `USD` branch (2 decimals) — so `45000` rendered as the bare "45.000,00"
 * (no prefix, comma-decimals) right next to a real ARS row rendering
 * "$ARS 80.000" (prefix, no decimals) in the same admin list column. The fix
 * treats a missing currency as ARS for rendering — the same fallback the
 * public sidebar already uses (`PricingSidebar.astro`'s `?? 'ARS'`) — so both
 * rows render identically.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PriceCell } from '@/components/table/cells/PriceCell';

describe('PriceCell — currency fallback formatting (H-167)', () => {
    it('formats an explicit ARS price with no decimals and a currency prefix', () => {
        render(<PriceCell value={{ price: 80000, currency: 'ARS' }} />);

        expect(screen.getByText('$ARS')).toBeInTheDocument();
        expect(screen.getByText('80.000')).toBeInTheDocument();
    });

    it('formats a price with a missing currency the SAME way as an explicit ARS price', () => {
        render(<PriceCell value={{ price: 45000 }} />);

        expect(screen.getByText('$ARS')).toBeInTheDocument();
        expect(screen.getByText('45.000')).toBeInTheDocument();
        // Regression guard: the old `default` branch produced 2-decimal output
        // (e.g. "45.000,00"), which would fail the exact-match assertion above.
        expect(screen.queryByText('45.000,00')).not.toBeInTheDocument();
    });

    it('still formats USD with 2 decimals (unaffected by the ARS fallback)', () => {
        render(<PriceCell value={{ price: 199.5, currency: 'USD' }} />);

        expect(screen.getByText('$USD')).toBeInTheDocument();
        expect(screen.getByText('199,50')).toBeInTheDocument();
    });
});
