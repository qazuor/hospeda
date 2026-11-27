/**
 * @file qr-center-logo-sweep-corpus.ts
 * @description The URL corpus and the coverage arithmetic shared by the centre
 * disc sweep (`qr-center-logo-sweep.ts`) and the test that ties the shipped
 * per-level ratios back to its measurements (HOS-2672).
 *
 * Kept free of side effects so a test can import it without starting a sweep.
 *
 * @module scripts/qr-center-logo-sweep-corpus
 */

import type { QrCodeErrorCorrectionLevelEnum } from '@repo/schemas';
import { centerLogoCoverage } from '../src/utils/qr-center-logo';
import { renderQrMatrix } from '../src/utils/qr-render';

/** `QR_CODE_SLUG_MAX_LENGTH`-long slugs: the largest symbols the product can emit. */
const MAX_SLUGS = [
    'hotel-termas-colon-entre-rios-costanera-del-rio-uruguay-suites-2',
    'cabanas-los-aromos-concepcion-del-uruguay-entre-rios-litoral-262',
    'Zq8LmW3xN7vK2pR9tB5yD1fG6hJ4cS0aE8uI3oP7nM2lQ5wX9zV1bC4dF6gH8jK0'
] as const;

/**
 * The corpus: real URL shapes, two hosts, slug lengths from 4 up to the
 * 64-character maximum (the staging `/qr/` one is the largest symbol the product
 * can emit: 57 modules at H, version 10).
 */
export const SWEEP_URLS: readonly string[] = [
    'https://hospeda.com.ar/q/k7Qm2XbT',
    'https://hospeda.com.ar/qr/AB12CD34/',
    'https://hospeda.com.ar/qr/hotel-del-rio-uruguay-colon-2026/',
    'https://staging.hospeda.com.ar/q/Wm4p',
    'https://staging.hospeda.com.ar/qr/mesa-12-restaurante-la-ribera/',
    'https://staging.hospeda.com.ar/q/9fKd3LmQ7xRt2VbN',
    'https://hospeda.com.ar/qr/cabanas-los-aromos-concepcion-del-uruguay-entre-rios/',
    `https://hospeda.com.ar/qr/${MAX_SLUGS[0]}/`,
    `https://staging.hospeda.com.ar/qr/${MAX_SLUGS[1]}/`,
    `https://staging.hospeda.com.ar/q/${MAX_SLUGS[2]}`
];

/**
 * URLs the sweep NEVER saw, for the tests that check the shipped ratios on
 * inputs that did not set them (a decode test run on the corpus that produced the
 * ceilings is circular). Includes maximum-length slugs on both hosts.
 */
export const HOLDOUT_URLS: readonly string[] = [
    'https://hospeda.com.ar/qr/Z6xzPeGb/',
    'https://hospeda.com.ar/q/Rt5nHs2K',
    'https://staging.hospeda.com.ar/qr/ab9x/',
    'https://hospeda.com.ar/qr/apart-hotel-la-costanera-colon-vista-al-rio-wifi-pileta/',
    'https://staging.hospeda.com.ar/q/Hk3Vn8Pq1Zc5Wd7Xe9Rb2Ty4Uj6Mi0Lo',
    `https://hospeda.com.ar/qr/${'x7Kd9Qm2'.repeat(8)}/`,
    `https://staging.hospeda.com.ar/qr/${'Lp4Zr8Tw'.repeat(8)}/`,
    `https://hospeda.com.ar/q/${'Nb6Ys3Va'.repeat(8)}`
];

/** Rendered edges, in pixels, each corpus URL is swept at. */
export const SWEEP_SIZES: readonly number[] = [256, 384, 512, 768, 1024];

/** Granularity the per-level ratios are rounded DOWN to. */
export const SWEEP_RATIO_GRID = 0.005;

/** Module counts of every corpus URL at one level. */
function corpusModuleCounts(input: { level: QrCodeErrorCorrectionLevelEnum }): readonly number[] {
    return SWEEP_URLS.map(
        (url) => renderQrMatrix({ data: url, errorCorrectionLevel: input.level }).size
    );
}

/**
 * Mean, over the corpus, of the fraction of modules a disc of `diameterRatio`
 * intersects, at one correction level. Informational: it is what the schema's
 * ceiling table records, but it is NOT what the budget is enforced on.
 */
export function meanCorpusCoverage(input: {
    level: QrCodeErrorCorrectionLevelEnum;
    diameterRatio: number;
}): number {
    const counts = corpusModuleCounts({ level: input.level });
    let total = 0;
    for (const moduleCount of counts) {
        total += centerLogoCoverage({ moduleCount, diameterRatio: input.diameterRatio });
    }
    return total / counts.length;
}

/**
 * Whether a disc of `diameterRatio` stays within `share` of the damage the CEILING
 * disc did, on EVERY symbol of the corpus individually.
 *
 * The budget is per symbol, not on average: for each module count the corpus
 * produces at the level, `coverage(ratio) <= share x coverage(ceilingRatio)` on
 * that same symbol. An average would let a small symbol spend more than its share
 * as long as a large one spent less.
 */
export function withinPerSymbolBudget(input: {
    level: QrCodeErrorCorrectionLevelEnum;
    diameterRatio: number;
    ceilingRatio: number;
    share: number;
}): boolean {
    return corpusModuleCounts({ level: input.level }).every(
        (moduleCount) =>
            centerLogoCoverage({ moduleCount, diameterRatio: input.diameterRatio }) <=
            input.share * centerLogoCoverage({ moduleCount, diameterRatio: input.ceilingRatio })
    );
}

/**
 * The largest ratio on the {@link SWEEP_RATIO_GRID} that is within the per-symbol
 * budget ({@link withinPerSymbolBudget}), rounded DOWN.
 */
export function largestRatioWithin(input: {
    level: QrCodeErrorCorrectionLevelEnum;
    ceilingRatio: number;
    share: number;
}): number {
    let best = 0;
    for (let step = 1; step * SWEEP_RATIO_GRID < input.ceilingRatio; step += 1) {
        const ratio = Number((step * SWEEP_RATIO_GRID).toFixed(3));
        if (!withinPerSymbolBudget({ ...input, diameterRatio: ratio })) break;
        best = ratio;
    }
    return best;
}
