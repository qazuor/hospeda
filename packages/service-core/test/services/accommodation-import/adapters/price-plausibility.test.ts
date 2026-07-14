import { describe, expect, it } from 'vitest';
import {
    isPlausiblePerNightUsd,
    PER_NIGHT_MAX_USD,
    PER_NIGHT_MIN_USD
} from '../../../../src/services/accommodation-import/adapters/price-plausibility.js';

/**
 * Unit tests for the shared per-night price plausibility guard (BETA-169).
 * Pure logic — no adapters, no network.
 */
describe('isPlausiblePerNightUsd', () => {
    it('accepts values inside the plausible band', () => {
        expect(isPlausiblePerNightUsd(1)).toBe(true);
        expect(isPlausiblePerNightUsd(78.65)).toBe(true);
        expect(isPlausiblePerNightUsd(600)).toBe(true);
        expect(isPlausiblePerNightUsd(PER_NIGHT_MAX_USD)).toBe(true);
    });

    it('rejects sub-$1 values (floor guard — mis-parse / placeholder)', () => {
        expect(isPlausiblePerNightUsd(0)).toBe(false);
        expect(isPlausiblePerNightUsd(0.25)).toBe(false);
        expect(isPlausiblePerNightUsd(PER_NIGHT_MIN_USD - 0.01)).toBe(false);
    });

    it('rejects implausibly high values (BETA-169 — actor returned local currency, e.g. ARS)', () => {
        expect(isPlausiblePerNightUsd(PER_NIGHT_MAX_USD + 0.01)).toBe(false);
        // The exact reported BETA-169 value: ~15.964 ARS/night surfaced as "15964.5 USD".
        expect(isPlausiblePerNightUsd(15964.5)).toBe(false);
    });

    it('rejects non-finite values', () => {
        expect(isPlausiblePerNightUsd(Number.NaN)).toBe(false);
        expect(isPlausiblePerNightUsd(Number.POSITIVE_INFINITY)).toBe(false);
    });
});
