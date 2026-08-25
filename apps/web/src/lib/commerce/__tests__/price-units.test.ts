/**
 * @file price-units.test.ts
 * @description Unit coverage for the peso ↔ centavo boundary of the experience
 * price field (HOS-809).
 *
 * The assertion that matters is the ROUND TRIP: a value typed in pesos,
 * converted for storage and read back for display must come out as the same
 * number. Testing only the write direction is what let the original bug ship —
 * a form that multiplies on save but never divides on load multiplies the
 * stored price by 100 every time the owner opens and saves the listing.
 *
 * @module lib/commerce/__tests__/price-units
 */
import { describe, expect, it } from 'vitest';
import { centsToPesosInputValue, parsePesosInputToCents } from '../price-units';

describe('parsePesosInputToCents', () => {
    it('converts whole pesos into centavos', () => {
        expect(parsePesosInputToCents({ raw: '15000' })).toBe(1500000);
    });

    it('converts the smallest meaningful price', () => {
        expect(parsePesosInputToCents({ raw: '1' })).toBe(100);
    });

    it('maps an empty field to null, not to zero', () => {
        // `Number('')` is 0 — an empty field must not read as a free experience.
        expect(parsePesosInputToCents({ raw: '' })).toBeNull();
        expect(parsePesosInputToCents({ raw: '   ' })).toBeNull();
    });

    it('keeps an explicit zero as zero', () => {
        // 0 is the value the price-on-request branch stores, so it is a real
        // amount and must survive the conversion instead of collapsing to null.
        expect(parsePesosInputToCents({ raw: '0' })).toBe(0);
    });

    it('maps a non-numeric value to null rather than NaN', () => {
        expect(parsePesosInputToCents({ raw: 'abc' })).toBeNull();
    });

    it('floors a fractional peso amount to whole pesos', () => {
        // The field is whole-pesos (`step={1}`) and the public tag renders with
        // `maximumFractionDigits: 0`, so partial centavos have nowhere to show.
        expect(parsePesosInputToCents({ raw: '750.9' })).toBe(75000);
    });

    it('produces an integer for every input (the schema demands z.number().int())', () => {
        for (const raw of ['0.29', '1.005', '99.999', '3500']) {
            const cents = parsePesosInputToCents({ raw });
            expect(Number.isInteger(cents)).toBe(true);
        }
    });
});

describe('centsToPesosInputValue', () => {
    it('converts stored centavos into pesos', () => {
        expect(centsToPesosInputValue({ cents: 1500000 })).toBe(15000);
    });

    it('renders the kayak listing from the bug report at its real price', () => {
        // `alquiler-kayak-colon-termas` stores 350000 and the public card shows
        // $ 3.500 — the editor must agree with the public card.
        expect(centsToPesosInputValue({ cents: 350000 })).toBe(3500);
    });

    it('maps an absent price to the empty string, not to zero', () => {
        // A controlled `<input type="number">` given `null` renders `0`, which
        // reads as "this experience is free".
        expect(centsToPesosInputValue({ cents: null })).toBe('');
    });

    it('keeps an explicit zero visible', () => {
        expect(centsToPesosInputValue({ cents: 0 })).toBe(0);
    });

    it('shows a legacy non-round amount exactly rather than rounding it', () => {
        expect(centsToPesosInputValue({ cents: 8550 })).toBe(85.5);
    });
});

describe('round trip', () => {
    it('returns the typed amount unchanged after a store-and-reload cycle', () => {
        for (const typed of ['1', '150', '3500', '15000']) {
            const stored = parsePesosInputToCents({ raw: typed });
            expect(stored).not.toBeNull();
            expect(centsToPesosInputValue({ cents: stored })).toBe(Number(typed));
        }
    });

    it('does not drift when the same value is saved repeatedly', () => {
        // Open, save, reopen, save: the price an owner never touched must not
        // grow by a factor of 100 per visit.
        let stored = parsePesosInputToCents({ raw: '15000' });
        for (let i = 0; i < 3; i++) {
            const shown = centsToPesosInputValue({ cents: stored });
            stored = parsePesosInputToCents({ raw: String(shown) });
        }
        expect(stored).toBe(1500000);
    });
});
