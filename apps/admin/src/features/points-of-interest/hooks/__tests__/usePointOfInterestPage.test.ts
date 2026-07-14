/**
 * Regression tests for `buildPointOfInterestSubmitPayload` (HOS-144
 * judgment-day FIX 1 / FIX 3).
 *
 * Guards against three real bugs that shared one root cause (the original
 * `if (coordinates && typeof coordinates === 'object')` guard skipped
 * `undefined`/`null` coordinates entirely):
 *
 * - Create without touching the map: `coordinates === undefined` must still
 *   emit `{ lat: null, long: null }` — `PointOfInterestCreateInputSchema`
 *   has `lat`/`long` as `.nullable()`, NOT `.optional()`, so omitting the
 *   keys is a 400.
 * - Edit "Clear": `CoordinatesField`'s Clear button calls `onChange(null)` —
 *   must emit `{ lat: null, long: null }` so the PATCH actually clears the
 *   stored coordinate instead of omitting the keys (`.partial()` semantics
 *   = "no change").
 * - Comma-decimal / garbage input must never silently coerce to `null`
 *   (`Number('-32,4825')` is `NaN` without comma normalization) — it must
 *   surface a validation error instead of wiping a real coordinate.
 * - A half-filled pair (one axis entered, the other blank) must also error
 *   instead of persisting a broken coordinate (FIX 3).
 */

import { describe, expect, it } from 'vitest';
import { buildPointOfInterestSubmitPayload } from '../usePointOfInterestPage';

describe('buildPointOfInterestSubmitPayload', () => {
    describe.each(['create', 'edit'] as const)('mode=%s', (mode) => {
        it('splits keywords into a trimmed, non-empty text[]', () => {
            const result = buildPointOfInterestSubmitPayload({
                values: { slug: 'plaza', keywords: '  park \n\n plaza \nverde  ' },
                mode
            });

            expect(result.ok).toBe(true);
            if (!result.ok) throw new Error('expected ok result');
            expect(result.payload.keywords).toEqual(['park', 'plaza', 'verde']);
            expect(result.payload.slug).toBe('plaza');
        });

        it('null coordinates (explicit Clear) always emit { lat: null, long: null }', () => {
            const result = buildPointOfInterestSubmitPayload({
                values: { coordinates: null },
                mode
            });

            expect(result).toEqual({ ok: true, payload: { lat: null, long: null } });
        });

        it('both-empty coordinates object emits { lat: null, long: null }', () => {
            const result = buildPointOfInterestSubmitPayload({
                values: { coordinates: { lat: '', long: '' } },
                mode
            });

            expect(result).toEqual({ ok: true, payload: { lat: null, long: null } });
        });

        it('valid numeric coordinates are converted to numbers', () => {
            const result = buildPointOfInterestSubmitPayload({
                values: { coordinates: { lat: '-32.4825', long: '-58.2372' } },
                mode
            });

            expect(result).toEqual({
                ok: true,
                payload: { lat: -32.4825, long: -58.2372 }
            });
        });

        it('normalizes Argentine comma-decimal input', () => {
            const result = buildPointOfInterestSubmitPayload({
                values: { coordinates: { lat: '-32,4825', long: '-58,2372' } },
                mode
            });

            expect(result).toEqual({
                ok: true,
                payload: { lat: -32.4825, long: -58.2372 }
            });
        });

        it('trims whitespace around coordinate components', () => {
            const result = buildPointOfInterestSubmitPayload({
                values: { coordinates: { lat: '  -32.4825  ', long: '  -58.2372  ' } },
                mode
            });

            expect(result).toEqual({
                ok: true,
                payload: { lat: -32.4825, long: -58.2372 }
            });
        });

        it('returns a validation error for garbage/NaN input instead of nulling the coordinate', () => {
            const result = buildPointOfInterestSubmitPayload({
                values: { coordinates: { lat: 'not-a-number', long: '-58.2372' } },
                mode
            });

            expect(result.ok).toBe(false);
            if (result.ok) throw new Error('expected error result');
            expect(result.error).toMatch(/valid numbers/i);
        });

        it('returns a validation error for a lat-only partial pair (long blank)', () => {
            const result = buildPointOfInterestSubmitPayload({
                values: { coordinates: { lat: '-32.4825', long: '' } },
                mode
            });

            expect(result.ok).toBe(false);
            if (result.ok) throw new Error('expected error result');
            expect(result.error).toMatch(/both latitude and longitude/i);
        });

        it('returns a validation error for a long-only partial pair (lat blank)', () => {
            const result = buildPointOfInterestSubmitPayload({
                values: { coordinates: { lat: '', long: '-58.2372' } },
                mode
            });

            expect(result.ok).toBe(false);
            if (result.ok) throw new Error('expected error result');
            expect(result.error).toMatch(/both latitude and longitude/i);
        });
    });

    // ------------------------------------------------------------------
    // Mode-specific: undefined coordinates (field never touched)
    // ------------------------------------------------------------------

    it('create + undefined coordinates emits { lat: null, long: null } (nullable, not optional)', () => {
        const result = buildPointOfInterestSubmitPayload({
            values: { slug: 'plaza' },
            mode: 'create'
        });

        expect(result).toEqual({ ok: true, payload: { slug: 'plaza', lat: null, long: null } });
    });

    it('edit + undefined coordinates omits lat/long entirely (partial update = no change)', () => {
        const result = buildPointOfInterestSubmitPayload({
            values: { slug: 'plaza' },
            mode: 'edit'
        });

        expect(result).toEqual({ ok: true, payload: { slug: 'plaza' } });
        if (result.ok) {
            expect(result.payload).not.toHaveProperty('lat');
            expect(result.payload).not.toHaveProperty('long');
        }
    });
});
