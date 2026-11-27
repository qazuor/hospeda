import { QrCodeCenterLogoEnum } from '../../enums/qr-code-center-logo.enum.js';
import { QrCodeErrorCorrectionLevelEnum } from '../../enums/qr-code-error-correction-level.enum.js';

// ============================================================================
// CENTRE LOGO — the geometry that decides whether one is affordable
// ============================================================================

/**
 * @deprecated Since HOS-2672 the centre mark is a DISC whose diameter depends on
 * the correction level: use {@link QR_CODE_CENTER_LOGO_DIAMETER_RATIO}. Kept
 * (additive-only schema policy) with its historical value, the side of the
 * square plate this constant used to size. Nothing in the repository reads it
 * any more.
 */
export const QR_CODE_CENTER_LOGO_SIZE_RATIO = 0.2;

/**
 * @deprecated Square-plate bound (`SIZE_RATIO` squared). Superseded by the
 * per-level disc ratios; kept only so the public export does not disappear.
 */
export const QR_CODE_CENTER_LOGO_MAX_COVERAGE =
    QR_CODE_CENTER_LOGO_SIZE_RATIO * QR_CODE_CENTER_LOGO_SIZE_RATIO;

/**
 * The largest disc, as a fraction of the symbol's side, at which EVERY sampled
 * render still decoded, per correction level. The CEILING the budget is measured
 * against.
 *
 * MEASURED, not quoted. Re-measured on 2026-11-27 for the DISC with the real
 * isotipo painted inside it (HOS-2672), because the ceilings it replaces were
 * measured with a square plate and a three-bar `H`, and a different shape and
 * different ink do not owe the old numbers anything. TEN `/q/` and `/qr/` URLs
 * across two hosts, with slugs from 4 up to the 64-character maximum
 * (`QR_CODE_SLUG_MAX_LENGTH`; the largest symbol the product can emit, 57 modules
 * at H), at 256, 384, 512, 768 and 1024 px, so 50 renders per step, the disc swept
 * in steps of 0.01 of the symbol's side exactly as the renderer paints it, each
 * result fed to a real decoder (`jsqr`). The sweep is a script in the repo and
 * MUST be re-run whenever the mark changes:
 * `apps/api/scripts/qr-center-logo-sweep.ts`.
 *
 * "Coverage" is the fraction of MODULES whose square intersects the disc
 * (`centerLogoCoverage` in `apps/api/src/utils/qr-center-logo.ts`), the
 * conservative reading: a module the disc only grazes is lost to the decoder as
 * surely as one it covers. The disc's plain area (`pi r^2 / n^2`) is shown next to
 * it. Raw, per level, around the last clean step (`diameter / side`, area, mean
 * intersected modules, decoded):
 *
 * ```
 * L  0.21   3.46%   4.98%  50/50  <- last clean
 *    0.22   3.80%   5.28%  45/50     0.26  5.31%  7.00%  22/50
 *    0.23   4.15%   5.28%  44/50     0.27  5.73%  7.65%  14/50
 *    0.24   4.52%   5.66%  43/50     0.28  6.16%  8.10%   1/50
 *    0.25   4.91%   6.77%  31/50     0.29  6.61%  8.25%   0/50
 * M  0.30   7.07%   8.96%  50/50  <- last clean
 *    0.31   7.55%   9.19%  48/50     0.36 10.18% 12.32%  27/50
 *    0.32   8.04%  10.19%  48/50     0.37 10.75% 12.94%  21/50
 *    0.33   8.55%  10.74%  49/50     0.38 11.34% 13.41%  16/50
 *    0.34   9.08%  11.10%  48/50     0.39 11.95% 14.17%  12/50
 *    0.35   9.62%  11.74%  33/50     0.40 12.57% 15.23%   0/50
 * Q  0.40  12.57%  14.73%  50/50  <- last clean
 *    0.41  13.20%  15.44%  47/50     0.46 16.62% 18.73%   8/50
 *    0.42  13.85%  15.91%  45/50     0.47 17.35% 20.01%   5/50
 *    0.43  14.52%  16.91%  41/50     0.48 18.10% 21.08%   5/50
 *    0.44  15.21%  17.46%  30/50     0.49 18.86% 21.37%   2/50
 *    0.45  15.90%  18.19%  25/50     0.50 19.63% 21.93%   0/50
 * H  0.45  15.90%  18.11%  50/50  <- last clean
 *    0.46  16.62%  18.63%  45/50     0.51 20.43% 22.49%  20/50
 *    0.47  17.35%  19.63%  45/50     0.52 21.24% 23.93%  20/50
 *    0.48  18.10%  20.74%  43/50     0.53 22.06% 24.64%  15/50
 *    0.49  18.86%  21.29%  32/50     0.54 22.90% 25.66%  10/50
 *    0.50  19.63%  21.77%  21/50     0.55 23.76% 26.20%   0/50
 * ```
 *
 * ## The transition is NOT a cliff
 *
 * There is a long degradation band above every ceiling, and where it starts
 * depends on the string being encoded, because the string decides the QR version
 * and therefore how many codewords a given area destroys. Treat these as "the last
 * step nothing failed at", not as a threshold with cliff edges, and re-run the
 * sweep over your own corpus before reading a headroom off these four numbers.
 *
 * ## They are roughly HALF the level's nominal percentage, and that is the point
 *
 * The QR standard's familiar "L=7%, M=15%, Q=25%, H=30%" describes CODEWORDS a
 * decoder can repair, and repairing a codeword whose position is unknown costs two
 * error-correction codewords, not one. A contiguous blob also destroys whole
 * codewords at its edges that it only partly covers. So reading those percentages
 * as an area budget overstates what a logo can spend by about a factor of two:
 * measured here, H's nominal 30% first loses renders at 18.63% of modules, Q's
 * nominal 25% at 15.44%.
 */
export const QR_CODE_CENTER_LOGO_CEILING_DIAMETER_RATIO: Readonly<
    Record<QrCodeErrorCorrectionLevelEnum, number>
> = {
    [QrCodeErrorCorrectionLevelEnum.L]: 0.21,
    [QrCodeErrorCorrectionLevelEnum.M]: 0.3,
    [QrCodeErrorCorrectionLevelEnum.Q]: 0.4,
    [QrCodeErrorCorrectionLevelEnum.H]: 0.45
} as const;

/**
 * The mean fraction of modules the ceiling disc intersected on the sweep corpus,
 * per correction level: the last clean row of the table above, floored to three
 * decimals.
 *
 * INFORMATIONAL. It is the corpus-wide summary of how much damage the ceiling
 * represents (roughly half the level's nominal percentage), kept under its
 * original name for compatibility. The budget is NOT enforced on this mean but
 * per symbol, against the ceiling disc's damage on that same symbol: see
 * {@link QR_CODE_CENTER_LOGO_DIAMETER_RATIO}.
 */
export const QR_CODE_ERROR_CORRECTION_DECODE_CEILING: Readonly<
    Record<QrCodeErrorCorrectionLevelEnum, number>
> = {
    [QrCodeErrorCorrectionLevelEnum.L]: 0.049,
    [QrCodeErrorCorrectionLevelEnum.M]: 0.089,
    [QrCodeErrorCorrectionLevelEnum.Q]: 0.147,
    [QrCodeErrorCorrectionLevelEnum.H]: 0.181
} as const;

/**
 * How much of a level's measured tolerance the mark is allowed to consume.
 *
 * A judgment call, stated as one: half. The ceilings above were measured on a
 * PRISTINE render, and error correction does not exist to pay for decoration:
 * it exists to survive a scuffed sticker, a folded brochure, a bad camera and
 * poor light. Spending everything the ceiling allows would leave a symbol that
 * decodes perfectly on the day it is printed and nowhere afterwards, which is
 * the failure this whole entity exists to avoid: a printed code cannot be
 * corrected. Half to the mark, half to the world.
 */
export const QR_CODE_CENTER_LOGO_DAMAGE_BUDGET_SHARE = 0.5;

/**
 * Diameter of the centre disc as a fraction of the symbol's side (quiet zone
 * excluded), per correction level.
 *
 * DERIVED from {@link QR_CODE_CENTER_LOGO_CEILING_DIAMETER_RATIO} and
 * {@link QR_CODE_CENTER_LOGO_DAMAGE_BUDGET_SHARE}, and what it GUARANTEES is
 * exact: for EVERY symbol of the sweep corpus individually (ten URLs, 29 to 57
 * modules across the four levels), the disc intersects at most `share` (one half)
 * of the modules the CEILING disc intersected on that same symbol. Each value is
 * the largest ratio on a 0.005 grid satisfying that, rounded DOWN. It is a
 * per-symbol bound, not a mean: an average would let a small symbol spend more
 * than its half as long as a large one spent less.
 *
 * What it does NOT guarantee: anything about symbols outside the corpus' range
 * (the URL shape the product emits cannot produce a smaller one than 29 modules or
 * a larger one than the 64-character-slug version 10 at H), nor a bound on
 * AREAS (the ratio of intersected MODULES on a given symbol is what is bounded; the
 * disc-area ratio is lower still, 0.35 to 0.44, because the ratios are rounded
 * down). The sweep script prints these as `SAFE RATIO`,
 * and `qr-center-logo.test.ts` in `apps/api` recomputes them from the geometry,
 * so editing a ceiling without these (or the reverse) is a red test. Not snapped
 * to whole modules: the disc's area is the same fraction of the symbol at every QR
 * version.
 *
 * | Level | Ceiling ratio | Ratio |
 * |-------|---------------|-------|
 * | L     | 0.21          | 0.125 |
 * | M     | 0.30          | 0.190 |
 * | Q     | 0.40          | 0.265 |
 * | H     | 0.45          | 0.295 |
 */
export const QR_CODE_CENTER_LOGO_DIAMETER_RATIO: Readonly<
    Record<QrCodeErrorCorrectionLevelEnum, number>
> = {
    [QrCodeErrorCorrectionLevelEnum.L]: 0.125,
    [QrCodeErrorCorrectionLevelEnum.M]: 0.19,
    [QrCodeErrorCorrectionLevelEnum.Q]: 0.265,
    [QrCodeErrorCorrectionLevelEnum.H]: 0.295
} as const;

/**
 * Smallest disc, as a fraction of the symbol's side, still worth drawing.
 *
 * Below this the mark is a smudge, not a logo. 0.15 is about 4.4 modules across
 * on the smallest symbol a real URL produces (29 modules), and the isotipo, which
 * fills 0.9 of the disc's radius, needs roughly four modules to keep its three
 * shapes and the sun distinguishable: at the default 256 px render that is a
 * mark about 30 px wide, the least a phone screenshot can still show as a logo.
 * A level whose budgeted ratio falls short of it is refused instead of being
 * given a mark nobody can recognise.
 */
export const QR_CODE_CENTER_LOGO_MIN_DIAMETER_RATIO = 0.15;

/**
 * Whether a centre mark is affordable at a given correction level.
 *
 * The gate. It answers `true` when the level's budgeted disc
 * ({@link QR_CODE_CENTER_LOGO_DIAMETER_RATIO}) is at least the smallest worth
 * drawing ({@link QR_CODE_CENTER_LOGO_MIN_DIAMETER_RATIO}): `M`, `Q` and `H` at
 * the shipped measurements, `L` refused. It is written as the comparison rather
 * than as that list on purpose, so re-measuring a ceiling moves the line by
 * itself instead of leaving a hardcoded set of levels asserting a safety that no
 * longer holds.
 *
 * @param input - Options object (RO-RO).
 * @param input.centerLogo - Which mark, if any, is requested.
 * @param input.errorCorrectionLevel - The level the symbol will be drawn at.
 * @returns `true` when the pair is safe to draw.
 */
export function qrCodeCenterLogoFits(input: {
    centerLogo: QrCodeCenterLogoEnum;
    errorCorrectionLevel: QrCodeErrorCorrectionLevelEnum;
}): boolean {
    if (input.centerLogo === QrCodeCenterLogoEnum.NONE) return true;

    return (
        QR_CODE_CENTER_LOGO_DIAMETER_RATIO[input.errorCorrectionLevel] >=
        QR_CODE_CENTER_LOGO_MIN_DIAMETER_RATIO
    );
}
