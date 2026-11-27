/**
 * Frozen fixtures shared by the centre-mark test files (HOS-2672).
 *
 * Not a test file (no `.test.` in the name), so vitest does not collect it.
 *
 * @module test/utils/qr-center-logo.fixtures
 */

import { QrCodeErrorCorrectionLevelEnum } from '@repo/schemas';
import { HOSPEDA_ISOTIPO_ENCLOSING_CIRCLE } from '../../src/utils/qr-hospeda-isotipo.js';

export const DATA = 'https://hospeda.com.ar/q/k7Qm2XbT';
export const MARGIN = 4;

export const L = QrCodeErrorCorrectionLevelEnum.L;
export const M = QrCodeErrorCorrectionLevelEnum.M;
export const Q = QrCodeErrorCorrectionLevelEnum.Q;
export const H = QrCodeErrorCorrectionLevelEnum.H;
export const ALL_LEVELS = [L, M, Q, H] as const;

/**
 * The disc, per correction level, for `DATA`. Frozen, not derived.
 *
 * `moduleCount` is the QR version the string lands on (L and M share one, Q and
 * H a bigger one); `ratio` is the level's diameter ratio restated as a literal;
 * `radius` is `moduleCount x ratio / 2`; `centre` is `moduleCount / 2 + MARGIN`
 * (the symbol's side is odd, so this is the middle of the middle module).
 */
export const FROZEN_DISCS = [
    { level: L, moduleCount: 29, ratio: 0.125, centre: 18.5, radius: 1.8125 },
    { level: M, moduleCount: 29, ratio: 0.19, centre: 18.5, radius: 2.755 },
    { level: Q, moduleCount: 33, ratio: 0.265, centre: 20.5, radius: 4.3725 },
    { level: H, moduleCount: 33, ratio: 0.295, centre: 20.5, radius: 4.8675 }
] as const;

/** The levels the gate lets carry a mark (ratio at or above the 0.15 minimum). */
export const ALLOWED_LEVELS = FROZEN_DISCS.filter(({ ratio }) => ratio >= 0.15);

/** Every QR version's side, in modules: 21, 25, ... 177. */
export const ALL_QR_MODULE_COUNTS = Array.from({ length: 40 }, (_, index) => 21 + 4 * index);

/** The disc `<circle>` read back out of the emitted markup, in module units. */
export type SvgCircle = {
    readonly cx: number;
    readonly cy: number;
    readonly r: number;
    readonly fill: string;
    readonly fillOpacity: number | null;
    readonly shapeRendering: string | null;
};

/** Every `<circle>` in the document, in order. */
export function parseCircles(svg: string): readonly SvgCircle[] {
    return [...svg.matchAll(/<circle ([^>]*)\/>/g)].map((match) => {
        const attributes = match[1] as string;
        const attribute = (name: string): string | null =>
            new RegExp(`${name}="([^"]+)"`).exec(attributes)?.[1] ?? null;
        const opacity = attribute('fill-opacity');

        return {
            cx: Number(attribute('cx')),
            cy: Number(attribute('cy')),
            r: Number(attribute('r')),
            fill: attribute('fill') as string,
            fillOpacity: opacity === null ? null : Number(opacity),
            shapeRendering: attribute('shape-rendering')
        };
    });
}

/** The nested `<svg>` that carries the isotipo, in module units. */
export type LogoBox = {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly viewBox: string;
    readonly shapeRendering: string | null;
};

/**
 * Every nested `<svg x= y= width= height= viewBox=>`. Exactly one is expected;
 * the count is asserted wherever it is used, because a bound checked on zero
 * boxes passes as loudly as a correct one.
 */
export function parseLogoBoxes(svg: string): readonly LogoBox[] {
    return [
        ...svg.matchAll(
            /<svg x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)" viewBox="([^"]+)"(?: shape-rendering="([^"]+)")?>/g
        )
    ].map((match) => ({
        x: Number(match[1]),
        y: Number(match[2]),
        width: Number(match[3]),
        height: Number(match[4]),
        viewBox: match[5] as string,
        shapeRendering: match[6] ?? null
    }));
}

/** Where the isotipo's enclosing circle lands in module units, given its box. */
export function enclosingCircleOf(box: LogoBox): { cx: number; cy: number; r: number } {
    const scale = box.width / 517;
    return {
        cx: box.x + (HOSPEDA_ISOTIPO_ENCLOSING_CIRCLE.cx - 7) * scale,
        cy: box.y + (HOSPEDA_ISOTIPO_ENCLOSING_CIRCLE.cy - 8) * scale,
        r: HOSPEDA_ISOTIPO_ENCLOSING_CIRCLE.radius * scale
    };
}
