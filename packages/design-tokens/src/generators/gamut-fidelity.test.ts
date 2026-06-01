/**
 * @file generators/gamut-fidelity.test.ts
 * @description SPEC-176 T-005 part A — Permanent gamut-fidelity guard.
 *
 * The SPEC-176 fallback strategy emits, for every variant token, an sRGB
 * `rgb(R G B)` value that older browsers use in place of the modern
 * `oklch(from ...)` relative color. This test guarantees that the sRGB fallback
 * is a FAITHFUL perceptual match of the true OKLCH value — i.e. that no token
 * silently drifts in color when the fallback path is taken.
 *
 * ## Method
 *
 * For every entry in `VARIANT_TOKEN_MAP`:
 * 1. Compute the effective OKLCH the token represents:
 *    - `alpha`              → base color unchanged (alpha does not move l/c/h).
 *    - `lightness-multiply` → `l := clamp01(base.l * param)`.
 *    - `lightness-subtract` → `l := max(0, base.l - param)`.
 *    - `lightness-add`      → `l := min(1, base.l + param)`.
 *    - base `white`         → fixed `{ l: 1, c: 0, h: 0 }`.
 * 2. Convert that OKLCH to the emitted sRGB fallback exactly as the generator
 *    does: `clampChroma(color, 'oklch', 'rgb')` → `converter('rgb')` → round
 *    each channel to an integer 0–255.
 * 3. Round-trip the integer sRGB back into OKLab.
 * 4. Measure perceptual ΔE-OK (`differenceEuclidean('oklab')`) between the true
 *    OKLCH and the round-tripped fallback.
 *
 * ## Threshold
 *
 * In-gamut tokens MUST be within ΔE ≤ 0.02 (the user's hard fidelity bar —
 * imperceptible). Some high-chroma tokens at extreme lightness are physically
 * OUTSIDE the sRGB gamut; for those, `clampChroma` reduces chroma to fit, so a
 * larger ΔE is the unavoidable cost of sRGB's smaller volume — NOT a bug. Those
 * are detected (the gamut-mapped chroma differs from the requested chroma),
 * reported with their ΔE, and asserted only to be finite. The in-gamut hard
 * assertion is never loosened.
 *
 * @see srgb.ts — the generator's OKLCH→sRGB conversion this test mirrors.
 * @see emit-variant-tokens.ts — per-family lightness transforms + white case.
 * @see variant-tokens.ts — VARIANT_TOKEN_MAP (the tokens under test).
 */

import { type Oklch, clampChroma, converter, differenceEuclidean } from 'culori';
import { describe, expect, it } from 'vitest';

import type { OKLCH } from '../tokens/colors.js';
import { resolveBaseToOklch } from './resolve-base-oklch.js';
import type { VariantTokenEntry } from './variant-token-schema.js';
import { VARIANT_TOKEN_MAP } from './variant-tokens.js';

// ============================================================================
// Converters (created once)
// ============================================================================

const toRgb = converter('rgb');
const toOklab = converter('oklab');
const deltaEOk = differenceEuclidean('oklab');

/** Hard fidelity bar for in-gamut tokens (imperceptible per SPEC-176). */
const IN_GAMUT_DELTA_E = 0.02;

/**
 * Chroma tolerance for deciding whether a token sits OUTSIDE the sRGB gamut.
 * If `clampChroma` had to reduce chroma by more than this, the requested color
 * is not representable in sRGB and a larger ΔE is physically unavoidable.
 */
const GAMUT_CLAMP_TOLERANCE = 1e-4;

// ============================================================================
// Base OKLCH resolver — delegates to the shared resolve-base-oklch module.
//
// Previously this file contained an inline one-level resolver. It is now
// replaced by `resolveBaseToOklch` from `resolve-base-oklch.ts` (T-006) so
// both the emitter and the fidelity test always use the same resolution logic
// and cannot diverge. The shared resolver handles: white keyword, direct
// OKLCH entries, one-level var() to theme OKLCH, and two-level var() to
// palette OKLCH (for domain tokens like `accommodation-type-hotel`).
// ============================================================================

/**
 * Resolve a variant token `base` to its OKLCH triple.
 *
 * Thin wrapper over the shared {@link resolveBaseToOklch} so the existing
 * call-site below (`resolveBase(entry.base)`) works unchanged.
 *
 * @param base - Base token name (without `--`), or the `white` keyword.
 * @returns The resolved OKLCH triple.
 */
function resolveBase(base: string): OKLCH {
    return resolveBaseToOklch(base);
}

/**
 * Compute the effective OKLCH a variant token represents (after its transform).
 *
 * @param entry - The variant token entry.
 * @returns The effective OKLCH triple.
 */
function effectiveOklch(entry: VariantTokenEntry): OKLCH {
    const base = resolveBase(entry.base);
    switch (entry.family) {
        case 'alpha':
            return base;
        case 'lightness-multiply':
            return { l: Math.min(1, Math.max(0, base.l * entry.param)), c: base.c, h: base.h };
        case 'lightness-subtract':
            return { l: Math.max(0, base.l - entry.param), c: base.c, h: base.h };
        case 'lightness-add':
            return { l: Math.min(1, base.l + entry.param), c: base.c, h: base.h };
    }
}

/**
 * Convert an OKLCH triple to the emitted integer sRGB channels, mirroring
 * `formatSRGB` exactly (clampChroma → rgb → clamp [0,1] → ×255 → round).
 *
 * @param value - OKLCH triple.
 * @returns Object with `r`, `g`, `b` integer channels (0–255) and a flag
 *   indicating whether chroma had to be reduced to fit sRGB.
 */
function toIntegerSrgb(value: OKLCH): {
    readonly r: number;
    readonly g: number;
    readonly b: number;
    readonly outOfGamut: boolean;
} {
    const oklchColor: Oklch = { mode: 'oklch', l: value.l, c: value.c, h: value.h };
    const mapped = clampChroma(oklchColor, 'oklch', 'rgb') as Oklch;
    const outOfGamut = value.c - (mapped.c ?? 0) > GAMUT_CLAMP_TOLERANCE;

    const rgb = toRgb(mapped);
    const r = Math.round(Math.max(0, Math.min(1, rgb?.r ?? 0)) * 255);
    const g = Math.round(Math.max(0, Math.min(1, rgb?.g ?? 0)) * 255);
    const b = Math.round(Math.max(0, Math.min(1, rgb?.b ?? 0)) * 255);
    return { r, g, b, outOfGamut };
}

/**
 * Round-trip an integer sRGB triple back to OKLab and measure perceptual ΔE-OK
 * from the supplied true OKLCH.
 *
 * @param trueOklch - The token's true (pre-fallback) OKLCH triple.
 * @param srgb - The emitted integer sRGB channels (0–255).
 * @returns The Euclidean OKLab ΔE between the two colors.
 */
function deltaEFor(
    trueOklch: OKLCH,
    srgb: { readonly r: number; readonly g: number; readonly b: number }
): number {
    const fallbackOklab = toOklab({
        mode: 'rgb',
        r: srgb.r / 255,
        g: srgb.g / 255,
        b: srgb.b / 255
    });
    const trueColor: Oklch = {
        mode: 'oklch',
        l: trueOklch.l,
        c: trueOklch.c,
        h: trueOklch.h
    };
    return deltaEOk(trueColor, fallbackOklab);
}

// ============================================================================
// Tests
// ============================================================================

describe('gamut-fidelity (SPEC-176 — sRGB fallback faithfully matches oklch)', () => {
    /**
     * Per-token fidelity: every in-gamut token's sRGB fallback must round-trip
     * to within ΔE-OK ≤ 0.02 of its true OKLCH. Out-of-gamut tokens are exempt
     * from the hard bar (sRGB physical limit) but must still produce a finite
     * ΔE — they are reported separately below.
     */
    it('every in-gamut token fallback matches its oklch within ΔE ≤ 0.02', () => {
        for (const entry of VARIANT_TOKEN_MAP) {
            const trueOklch = effectiveOklch(entry);
            const { r, g, b, outOfGamut } = toIntegerSrgb(trueOklch);
            const dE = deltaEFor(trueOklch, { r, g, b });

            expect(Number.isFinite(dE), `Token '${entry.name}': ΔE is not finite`).toBe(true);

            if (!outOfGamut) {
                expect(
                    dE,
                    `Token '${entry.name}' (in-gamut) ΔE=${dE.toFixed(4)} exceeds ${IN_GAMUT_DELTA_E}`
                ).toBeLessThanOrEqual(IN_GAMUT_DELTA_E);
            }
        }
    });

    /**
     * Max-ΔE guard: the maximum ΔE across all IN-GAMUT tokens must stay within
     * the hard bar. Out-of-gamut tokens are logged with their ΔE (physical sRGB
     * limit, not a bug). If any token unexpectedly exceeds the bar, the assertion
     * fails AND the offending tokens are named in the message.
     */
    it('max in-gamut ΔE ≤ 0.02; out-of-gamut tokens reported, never silently loosened', () => {
        let maxInGamut = 0;
        const inGamutOffenders: string[] = [];
        const outOfGamutReport: string[] = [];

        for (const entry of VARIANT_TOKEN_MAP) {
            const trueOklch = effectiveOklch(entry);
            const { r, g, b, outOfGamut } = toIntegerSrgb(trueOklch);
            const dE = deltaEFor(trueOklch, { r, g, b });

            if (outOfGamut) {
                outOfGamutReport.push(`${entry.name} ΔE=${dE.toFixed(4)}`);
            } else {
                maxInGamut = Math.max(maxInGamut, dE);
                if (dE > IN_GAMUT_DELTA_E) {
                    inGamutOffenders.push(`${entry.name} ΔE=${dE.toFixed(4)}`);
                }
            }
        }

        if (outOfGamutReport.length > 0) {
            // Physical sRGB-gamut limit, not a defect — surfaced for visibility.
            console.info(
                `[gamut-fidelity] out-of-gamut tokens (sRGB physical limit): ${outOfGamutReport.join(', ')}`
            );
        }

        expect(
            inGamutOffenders,
            `In-gamut tokens exceeding ΔE ${IN_GAMUT_DELTA_E}: ${inGamutOffenders.join(', ')}`
        ).toEqual([]);
        expect(maxInGamut).toBeLessThanOrEqual(IN_GAMUT_DELTA_E);
    });

    /**
     * The white-origin token specifically must be a perfect (ΔE ≈ 0) match:
     * white is in-gamut and achromatic, so the fallback is exact.
     */
    it('white-a75 fallback matches white exactly (ΔE ≈ 0)', () => {
        const entry = VARIANT_TOKEN_MAP.find((e) => e.name === 'white-a75');
        expect(entry, 'white-a75 must exist in VARIANT_TOKEN_MAP').toBeDefined();
        if (entry === undefined) return;

        const trueOklch = effectiveOklch(entry);
        const { r, g, b } = toIntegerSrgb(trueOklch);
        expect({ r, g, b }).toEqual({ r: 255, g: 255, b: 255 });
        expect(deltaEFor(trueOklch, { r, g, b })).toBeLessThanOrEqual(IN_GAMUT_DELTA_E);
    });
});
