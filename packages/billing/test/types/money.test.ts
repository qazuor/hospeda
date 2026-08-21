/**
 * Tests for the branded money units — Centavos / Major (HOS-720).
 *
 * The COMPILE-TIME guarantee (a `Centavos` refusing to satisfy a `Major`
 * parameter and vice versa) is not testable from a runtime suite — it is
 * verified by deliberately writing the wrong assignment and running `tsc`, and
 * the resulting errors are recorded on the HOS-720 PR. What IS testable, and
 * what these tests cover, is the arithmetic the two crossing functions perform:
 * a branded type whose conversion silently truncated or double-applied would be
 * exactly as dangerous as the unbranded `number` it replaced.
 *
 * @module test/types/money
 */

import { describe, expect, it } from 'vitest';
import { asCentavos, asMajor, toCentavos, toMajor } from '../../src/types/money.js';

describe('asCentavos / asMajor', () => {
    it('brands without performing any arithmetic', () => {
        // Arrange / Act / Assert — the branding functions are assertions about a
        // value's unit, never conversions. A caller that expects `asMajor` to
        // divide would produce the HOS-713 bug in the opposite direction.
        expect(asCentavos(15_000)).toBe(15_000);
        expect(asMajor(150)).toBe(150);
        expect(asCentavos(0)).toBe(0);
        expect(asMajor(0)).toBe(0);
    });

    it('preserves negatives, which a refund/adjustment can legitimately carry', () => {
        expect(asCentavos(-2500)).toBe(-2500);
        expect(asMajor(-25)).toBe(-25);
    });
});

describe('toCentavos', () => {
    it('multiplies major units by 100', () => {
        expect(toCentavos(asMajor(150))).toBe(15_000);
        expect(toCentavos(asMajor(0))).toBe(0);
    });

    it('ROUNDS rather than truncating a fractional peso', () => {
        // 19.999 pesos truncated is 1999 centavos — one centavo lost on every
        // such charge. The rounding here is what the qzpay adapter does on the
        // way out, so a value must survive a round trip unchanged.
        expect(toCentavos(asMajor(19.999))).toBe(2000);
        expect(toCentavos(asMajor(0.005))).toBe(1);
        expect(toCentavos(asMajor(123.45))).toBe(12_345);
    });

    it('always yields an integer, which is what billing_payments.amount stores', () => {
        for (const major of [0.1, 1.005, 99.994, 12_345.678]) {
            expect(Number.isInteger(toCentavos(asMajor(major)))).toBe(true);
        }
    });

    it('handles the float artefacts a naive `* 100` leaves behind', () => {
        // 1.1 * 100 === 110.00000000000001 in IEEE-754. Without the rounding,
        // that non-integer would reach an integer DB column.
        expect(toCentavos(asMajor(1.1))).toBe(110);
        expect(toCentavos(asMajor(2.02))).toBe(202);
    });
});

describe('toMajor', () => {
    it('divides centavos by 100', () => {
        expect(toMajor(asCentavos(15_000))).toBe(150);
        expect(toMajor(asCentavos(0))).toBe(0);
    });

    it('does NOT round — a fractional peso is a value MercadoPago can report', () => {
        expect(toMajor(asCentavos(12_345))).toBe(123.45);
        expect(toMajor(asCentavos(1))).toBe(0.01);
    });
});

describe('round trip', () => {
    it('restores the original centavo figure through toMajor → toCentavos', () => {
        // This is the exact path a webhook payment takes: qzpay hands us
        // centavos, the synthetic MP payload carries major, and the ledger row
        // is written back in centavos. The two crossings must cancel out
        // EXACTLY — HOS-713 was one of them going missing, and a lossy pair
        // would be the same class of defect with a smaller blast radius.
        for (const centavos of [1, 100, 15_000, 12_345, 999_999, 350_000_00]) {
            expect(toCentavos(toMajor(asCentavos(centavos)))).toBe(centavos);
        }
    });
});
